/** @format */

import {
  SparqlEndpointResponseProvider,
  SparqlQueryWindow,
} from "@ud-viz/widget_sparql";
import {
  loadMultipleJSON,
  getUriLocalname,
  fetchC3DTileFeatureWithNodeText,
  appendWireframeToObject3D,
  initScene,
  defaultConfigScene,
} from "@ud-viz/utils_browser";
import { Planar, DomElement3D } from "@ud-viz/frame3d";
import { loadingScreen } from "./loadingScreen";
import * as proj4 from "proj4";
import * as itowns from "itowns";
import * as THREE from "three";
/* eslint-disable no-new */

loadMultipleJSON(["./assets/config/config.json"]).then((configs) => {
  proj4.default.defs(
    configs["config"]["crs"].name,
    configs["config"]["crs"].transform
  );

  const extent = new itowns.Extent(
    configs["config"]["extents"].name,
    parseInt(configs["config"]["extents"].west),
    parseInt(configs["config"]["extents"].east),
    parseInt(configs["config"]["extents"].south),
    parseInt(configs["config"]["extents"].north)
  );

  // create a itowns planar view
  const viewDomElement = document.createElement("div");
  viewDomElement.classList.add("full_screen");
  document.body.appendChild(viewDomElement);
  const view = new itowns.PlanarView(viewDomElement, extent);

  // eslint-disable-next-line no-constant-condition
  loadingScreen(view, ["UD-VIZ", "4.3.0"]);

  // init scene 3D
  initScene(
    view.camera.camera3D,
    view.mainLoop.gfxEngine.renderer,
    view.scene
  );

  // add base map layer
  view.addLayer(
    new itowns.ColorLayer(configs["config"]["base_maps"][0]["name"], {
      updateStrategy: {
        type: itowns.STRATEGY_DICHOTOMY,
        options: {},
      },
      source: new itowns.WMSSource({
        extent: extent,
        name: configs["config"]["base_maps"][0].source["name"],
        url: configs["config"]["base_maps"][0].source["url"],
        version: configs["config"]["base_maps"][0].source["version"],
        crs: extent.crs,
        format: configs["config"]["base_maps"][0].source["format"],
      }),
      transparent: true,
    })
  );

  // add elevation layer
  const isTextureFormat =
    configs["config"]["elevation"]["format"] == "image/jpeg" ||
    configs["config"]["elevation"]["format"] == "image/png";
  view.addLayer(
    new itowns.ElevationLayer(configs["config"]["elevation"]["layer_name"], {
      useColorTextureElevation: isTextureFormat,
      colorTextureElevationMinZ: isTextureFormat
        ? configs["config"]["elevation"]["colorTextureElevationMinZ"]
        : null,
      colorTextureElevationMaxZ: isTextureFormat
        ? configs["config"]["elevation"]["colorTextureElevationMaxZ"]
        : null,
      source: new itowns.WMSSource({
        extent: extent,
        url: configs["config"]["elevation"]["url"],
        name: configs["config"]["elevation"]["name"],
        crs: extent.crs,
        heightMapWidth: 256,
        format: configs["config"]["elevation"]["format"],
      }),
    })
  );

  // add 3DTiles layers
  configs["config"]["3DTilesLayers"].forEach((layerConfig) => {
    itowns.View.prototype.addLayer.call(
      view,
      new itowns.C3DTilesLayer(
        layerConfig["id"],
        {
          name: layerConfig["id"],
          source: new itowns.C3DTilesSource({
            url: layerConfig["url"],
          }),
        },
        view
      )
    );
  });

  // //// SPARQL widget
  const sparqlProvider = new SparqlEndpointResponseProvider(
    configs["config"]["server"]
  );

  const sparqlWidgetView = new SparqlQueryWindow(
    sparqlProvider,
    configs["config"]["sparqlModule"]
  );
  sparqlWidgetView.domElement.classList.add("widget_sparql");

  // Add UI
  const sparqlWidgetDomElement = document.createElement("div");
  viewDomElement.appendChild(sparqlWidgetDomElement);

  sparqlWidgetView.domElement.classList.add("widget_sparql");
  sparqlWidgetView.domElement.getElementsByTagName("input")[0].id =
    "buttonSend";
  sparqlWidgetView.dataView.classList.add("data_view");
  sparqlWidgetView.table.filterSelect.classList.add("table_filter");
  sparqlWidgetDomElement.appendChild(sparqlWidgetView.domElement);

  // function for getting document data and adding them to the scene
  const Add3dDocumentFrames = () =>
    sparqlProvider
      .querySparqlEndpointService(
        `
  PREFIX doc: <https://dataset-dl.liris.cnrs.fr/rdf-owl-urban-data-ontologies/Ontologies/Document/3.0/document#>

  SELECT *
  WHERE {
    ?document a doc:Document ;
    	doc:Document.referringTo/doc:Reference.referringTo ?feature ;
  	doc:Document.uri ?uri .

  }
      `
      )
      .then((response) => {
        console.debug("document request recieved", response);
        // Add 3DFrames for each document
        response.results.bindings.forEach((element) => {
          // get feature
          const featureId = element.feature.value;
          const documentSrc = element.uri.value;
          const featureResult = fetchC3DTileFeatureWithNodeText(
            view,
            "gml_id",
            getUriLocalname(featureId)
          );

          if (!featureResult) return;

          const featureCentroid = featureResult.feature
            .computeWorldBox3(undefined)
            .getCenter(new THREE.Vector3());
          console.log(featureResult.feature.getInfo());

          // create sprite
          const texture = new THREE.TextureLoader().load(documentSrc, () => {
            const spriteMaterial = new THREE.SpriteMaterial({
              map: texture,
              color: 0xffffff,
            });
            const scale = configs["config"]["default_scale"]; // this should be defined per image in the DB or calculated dynamically
            const sprite = new THREE.Sprite(spriteMaterial);
            sprite.position.set(
              featureCentroid.x,
              featureCentroid.y,
              featureCentroid.z + 150
            );
            sprite.scale.set(
              texture.image.width * scale,
              texture.image.height * scale,
              0
            );

            // create line
            const lineMaterial = new THREE.LineBasicMaterial({
              color: 0x111111,
            });
            const linePoints = [];
            linePoints.push(
              new THREE.Vector3(
                featureCentroid.x,
                featureCentroid.y,
                featureCentroid.z
              )
            );
            linePoints.push(
              new THREE.Vector3(
                featureCentroid.x,
                featureCentroid.y,
                featureCentroid.z + 149
              )
            );
            const lineGeometry = new THREE.BufferGeometry().setFromPoints(
              linePoints
            );
            const line = new THREE.Line(lineGeometry, lineMaterial);

            // add to scene
            view.scene.add(sprite);
            view.scene.add(line);
            sprite.updateMatrixWorld();
            view.notifyChange();
          });
        });
      });

  // Get document data after layers loaded
  view.addEventListener(
    itowns.VIEW_EVENTS.LAYERS_INITIALIZED,
    Add3dDocumentFrames
  );

  //   // TODO add d3 node click functions

  view
    .getLayers()
    .filter((el) => el.isC3DTilesLayer)
    .forEach((layer) => {
      layer.addEventListener(
        itowns.C3DTILES_LAYER_EVENTS.ON_TILE_CONTENT_LOADED,
        ({ tileContent }) => {
          appendWireframeToObject3D(tileContent);
        }
      );
    });

  // Create div to integrate logo image
  const logoDiv = document.createElement("div");
  viewDomElement.appendChild(logoDiv);
  logoDiv.id = "logo-div";
  const img = document.createElement("img");
  logoDiv.appendChild(img);
  img.src = configs["config"]["art"].logo_src;
  img.id = "logoLiris";

  // Create info and help icons
  const iconDiv = document.createElement("div");
  iconDiv.id = "icon-div";
  viewDomElement.appendChild(iconDiv);

  const buttonInfo = document.createElement("a");
  buttonInfo.title = "More information";
  buttonInfo.href = "https://github.com/DiegoVinasco/UD-Demo-DocGraph";
  const iconInfo = document.createElement("img");
  iconInfo.src = configs["config"]["art"].info_src;
  iconInfo.id = "iconInfo";
  buttonInfo.appendChild(iconInfo);

  const buttonHelp = document.createElement("a");
  buttonHelp.title = "Help/Tutorial";
  buttonHelp.href = "TODO";
  const iconHelp = document.createElement("img");
  iconHelp.src = configs["config"]["art"].help_src;
  iconHelp.id = "iconHelp";
  buttonHelp.appendChild(iconHelp);

  iconDiv.appendChild(buttonInfo);
  iconDiv.appendChild(buttonHelp);
});

