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
  focusCameraOn
} from "@ud-viz/utils_browser";
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

  const modality1 = false;
  
  // create a itowns planar view
  const viewDomElement = document.createElement("div");
  viewDomElement.classList.add("full_screen");
  document.body.appendChild(viewDomElement);
  const view = new itowns.PlanarView(viewDomElement, extent);

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
  sparqlWidgetDomElement.classList.add('full_screen');
  document.body.appendChild(sparqlWidgetDomElement);

  sparqlWidgetView.domElement.classList.add("widget_sparql");
  sparqlWidgetView.domElement.getElementsByTagName("input")[0].id =
    "buttonSend"; //en plus
  sparqlWidgetView.dataView.classList.add("data_view");
  sparqlWidgetView.table.filterSelect.classList.add("table_filter"); //en plus
  sparqlWidgetDomElement.appendChild(sparqlWidgetView.domElement);

  // eslint-disable-next-line no-constant-condition
  loadingScreen(view, ["UD-VIZ", "4.3.0"]); //écran de chargement du début

  // init scene 3D
  initScene(
    view.camera.camera3D,
    view.mainLoop.gfxEngine.renderer,
    view.scene
  );

  const style = new itowns.Style({
    fill: {
      color: function (feature) {
        return feature.userData.selectedColor
          ? feature.userData.selectedColor
          : 'white';
      },
    },
  });

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
          style: style,
          name: layerConfig["id"],
          source: new itowns.C3DTilesSource({
            url: layerConfig["url"],
          }),
        },
        view
      )
    );
  });

  function formateResponse(response){
    const result = []
    response.results.bindings.forEach((element) => {
      const document = result.find((item) => item.document == element.document.value);
      if (document) {
        document.feature.push(element.feature.value);
      } else {
        const new_doc = {};
        new_doc.document = element.document.value;
        new_doc.feature = [element.feature.value];
        new_doc.uri = element.uri.value;
        result.push(new_doc);
      }
    });
    return result;
  }

  const spriteArray = [];

  function CreateDocumentSprite(element){

    return new Promise((resolve) => {
    // get feature
      const documentSrc = element.uri;
      const documentId = element.document;

      const featureCoord = {x:0, y:0, z:0};
      let featureLength = 0;

      element.feature.forEach((featureId) => {
        const featureResult = fetchC3DTileFeatureWithNodeText(
          view,
          "gml_id",
          getUriLocalname(featureId)
        );
        if (featureResult) {
          console.debug("featureResult",featureResult);

          const featureCentroid = featureResult.feature
            .computeWorldBox3(undefined)
            .getCenter(new THREE.Vector3());

          featureResult.feature.userData.selectedColor = 'red';
          featureResult.layer.updateStyle();
          
          featureLength += 1;
          featureCoord.x += featureCentroid.x;
          featureCoord.y += featureCentroid.y;
          featureCoord.z += featureCentroid.z;
        }
      });

      if (featureLength > 0) {
        featureCoord.x = featureCoord.x / featureLength;
        featureCoord.y = featureCoord.y / featureLength;
        featureCoord.z = featureCoord.z / featureLength;
        // create sprite
        const texture = new THREE.TextureLoader().load(documentSrc, async () => {
          const spriteMaterial = new THREE.SpriteMaterial({
            map: texture,
            color: 0xffffff,
          });
          const scale = configs["config"]["default_scale"]; // this should be defined per image in the DB or calculated dynamically
          const sprite = new THREE.Sprite(spriteMaterial);
          sprite.position.set(
            featureCoord.x,
            featureCoord.y,
            featureCoord.z + 150
          );
          sprite.scale.set(
            texture.image.width * scale,
            texture.image.height * scale,
            0
          );
          sprite.userData = {id:getUriLocalname(documentId), associatedFeature:[]};
          spriteArray.push(sprite);

          element.feature.forEach((featureId) => {
            const featureResult = fetchC3DTileFeatureWithNodeText(
              view,
              "gml_id",
              getUriLocalname(featureId)
            );

            sprite.userData.associatedFeature.push(getUriLocalname(featureId));
            if (featureResult) {
              const featureCentroid = featureResult.feature
                .computeWorldBox3(undefined)
                .getCenter(new THREE.Vector3());

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
                  featureCoord.x,
                  featureCoord.y,
                  featureCoord.z + 149
                )
              );
              const lineGeometry = new THREE.BufferGeometry().setFromPoints(
                linePoints
              );
              const line = new THREE.Line(lineGeometry, lineMaterial);
              view.scene.add(line);
            }
          });
          // add to scene
          view.scene.add(sprite);
          sprite.updateMatrixWorld();
          view.notifyChange();
          resolve(sprite);
        });
      }
    });
  }; 

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
        const formated_response = formateResponse(response);
        formated_response.forEach((element) => {
          CreateDocumentSprite(element);
        });
      });

  // Get document data after layers loaded : affichage auto des documents -> modality 1
  if (modality1) {
    view.addEventListener(
      itowns.VIEW_EVENTS.LAYERS_INITIALIZED,
      Add3dDocumentFrames
    );
  }

  // Node click functions
  sparqlWidgetView.d3Graph.addEventListener('click', (event) => {

    event.event.stopPropagation();

    const node = event.datum;
    console.debug('node clicked: ', node);
    const request = `
      PREFIX doc: <https://dataset-dl.liris.cnrs.fr/rdf-owl-urban-data-ontologies/Ontologies/Document/3.0/document#>
      PREFIX gc2018: <https://raw.githubusercontent.com/VCityTeam/UD-Graph/master/Datasets/GratteCiel_2018_split_v3#>

      SELECT *
      WHERE {
        ?document a doc:Document ;
          doc:Document.referringTo/doc:Reference.referringTo ?feature ;
        doc:Document.uri ?uri .
        
        FILTER(?document = gc2018:` + getUriLocalname(node.id) + `)
      }
    `;  
    sparqlProvider
      .querySparqlEndpointService(request)
      .then((response) => {
        console.debug("document request recieved", response);
        const formated_response = formateResponse(response);
        formated_response.forEach((element) => {
          CreateDocumentSprite(element)
          .then((sprite) => {
            console.debug("sprite", sprite)
            focusCameraOn(
              view,
              view.controls,
              sprite.position,
              {
                verticalDistance: 200,
                horizontalDistance: 200,
              }
            );
          });
        });  
      });
  });

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

  view.domElement.onclick = (event) => {
    // get intersects based on the click event

    const raycaster =  new THREE.Raycaster();
    const mouse3D = new THREE.Vector3( ( event.clientX / window.innerWidth ) * 2 - 1,
      -( event.clientY / window.innerHeight ) * 2 + 1,  
      0.5 );                                        
    raycaster.setFromCamera( mouse3D, view.camera.camera3D);
   
    const intersectsRay = raycaster.intersectObjects(spriteArray);
    console.debug("intersectsRay", intersectsRay);

    if (intersectsRay.length) {
      console.debug("sprite",intersectsRay[0].object);
      let featuresList = '';
      for (const featureID of intersectsRay[0].object.userData.associatedFeature) {
        featuresList += ', gc2018:' + featureID;
      }
      sparqlWidgetView.queryTextArea.value = `
        PREFIX doc: <https://dataset-dl.liris.cnrs.fr/rdf-owl-urban-data-ontologies/Ontologies/Document/3.0/document#>
        PREFIX gc2018: <https://raw.githubusercontent.com/VCityTeam/UD-Graph/master/Datasets/GratteCiel_2018_split_v3#>

        SELECT ?subject ?subjectType ?predicate ?object
        WHERE {
          ?subject ?predicate ?object;a ?subjectType .
          FILTER (?subject IN (gc2018:` + intersectsRay[0].object.userData.id + featuresList + `))
          FILTER (?object != owl:NamedIndividual)
          FILTER (?subjectType != owl:NamedIndividual)
        }
    `;
      sparqlWidgetView.d3Graph.clearCanvas();
      sparqlWidgetView.d3Graph.data.clear();
      sparqlWidgetView.sparqlProvider
        .querySparqlEndpointService(sparqlWidgetView.queryTextArea.value)
        .then((response) =>
          sparqlWidgetView.updateDataView(response, sparqlWidgetView.resultSelect.value)
      );

      focusCameraOn(
        view,
        view.controls,
        intersectsRay[0].object.position,
        {
          verticalDistance: 200,
          horizontalDistance: 200,
        }
      );
    }

    const intersects= view.pickObjectsAt(
      event,
      0,
      view.getLayers().filter((el) => el.isC3DTilesLayer)
    );

    console.debug("intersects",intersects);

    if (intersects.length) {
      // get featureClicked
      const featureClicked =
        intersects[0].layer.getC3DTileFeatureFromIntersectsArray(
          intersects
        );
      if (featureClicked)
        console.log(featureClicked.getInfo());
      }
    view.notifyChange(); // need a redraw of the view
    };


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

