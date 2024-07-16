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
  const frame3DPlanar = new Planar(
    extent,
    configs["config"]["frame3DPlanar"][1]
  );

  // eslint-disable-next-line no-constant-condition
  loadingScreen(frame3DPlanar.itownsView, ["UD-VIZ", "4.3.0"]);

  // add base map layer
  frame3DPlanar.itownsView.addLayer(
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
  frame3DPlanar.itownsView.addLayer(
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
      frame3DPlanar.itownsView,
      new itowns.C3DTilesLayer(
        layerConfig["id"],
        {
          name: layerConfig["id"],
          source: new itowns.C3DTilesSource({
            url: layerConfig["url"],
          }),
        },
        frame3DPlanar.itownsView
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
  frame3DPlanar.domElementUI.appendChild(sparqlWidgetDomElement);

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
            frame3DPlanar.itownsView,
            "gml_id",
            getUriLocalname(featureId)
          );

          if (!featureResult) return;

          const featureCentroid = featureResult.feature
            .computeWorldBox3(undefined)
            .getCenter(new THREE.Vector3());
          console.log(featureResult.feature.getInfo());

          // create and add frame
          const iframe = document.createElement("iframe");
          iframe.src = documentSrc;
          iframe.width = 4000;
          iframe.height = 2000;

          const domElement3D = new DomElement3D(iframe);
          console.log(domElement3D);

          domElement3D.rotation.set(Math.PI * 0.5, 0, 0);
          domElement3D.position.set(featureCentroid.x, featureCentroid.y, 300);

          frame3DPlanar.appendDomElement3D(domElement3D);

          const size = 200;
          domElement3D.scale.set(size, size, size);

          domElement3D.updateMatrixWorld();
          frame3DPlanar.itownsView.notifyChange();
        });
      });

  // Get document data after layers loaded
  frame3DPlanar.itownsView.addEventListener(
    itowns.VIEW_EVENTS.LAYERS_INITIALIZED,
    Add3dDocumentFrames
  );

  //   // TODO add d3 node click functions

  frame3DPlanar.itownsView
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
  frame3DPlanar.domElementUI.appendChild(logoDiv);
  logoDiv.id = "logo-div";
  const img = document.createElement("img");
  logoDiv.appendChild(img);
  img.src = configs["config"]["art"].logo_src;
  img.id = "logoLiris";

  // Create info and help icons
  const iconDiv = document.createElement("div");
  iconDiv.id = "icon-div";
  frame3DPlanar.domElementUI.appendChild(iconDiv);

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

