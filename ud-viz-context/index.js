/** @format */

import {
  SparqlEndpointResponseProvider,
  SparqlQueryWindow,
} from "@ud-viz/widget_sparql";
import {
  loadMultipleJSON,
  initScene,
  getUriLocalname,
} from "@ud-viz/utils_browser";
import { frame3d, Planar, DomElement3D } from "@ud-viz/frame3d";
import * as proj4 from "proj4";
import * as itowns from "itowns";
import * as THREE from "three";
/* eslint-disable no-new */

loadMultipleJSON([
  "./assets/config/crs.json",
  "./assets/config/layer/3DTiles_point_cloud.json",
  "./assets/config/layer/elevation.json",
  "./assets/config/layer/base_maps.json",
  "./assets/config/config.json",
]).then((configs) => {
  proj4.default.defs(configs["crs"][0].name, configs["crs"][0].transform);

  const extent = new itowns.Extent(
    configs["config"]["extents"].name,
    parseInt(configs["config"]["extents"].west),
    parseInt(configs["config"]["extents"].east),
    parseInt(configs["config"]["extents"].south),
    parseInt(configs["config"]["extents"].north)
  );

  // create a itowns planar view
  const viewDomElement = document.createElement("div");
  const domElement3D = new DomElement3D(viewDomElement);
  viewDomElement.classList.add("full_screen");
  document.body.appendChild(viewDomElement);
  const frame3DPlanar = new Planar(extent, configs["config"]["frame3DPlanar"]);

  frame3DPlanar.appendDomElement3D(domElement3D);

  // eslint-disable-next-line no-constant-condition
  if ("RUN_MODE" == "production")
    loadingScreen(frame3DPlanar, ["UD-VIZ", "UDVIZ_VERSION"]);

  // init scene 3D
  // initScene(
  //   frame3DPlanar.camera.camera3D,
  //   frame3DPlanar.mainLoop.gfxEngine.renderer,
  //   frame3DPlanar.scene
  // );

  // add layers
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
  const uiDomElement = document.createElement("div");
  uiDomElement.classList.add("full_screen");
  document.body.appendChild(uiDomElement);
  uiDomElement.appendChild(sparqlWidgetView.domElement);

  sparqlWidgetView.domElement.classList.add("widget_sparql");
  sparqlWidgetView.domElement.getElementsByTagName("input")[0].id =
    "buttonSend";
  sparqlWidgetView.dataView.classList.add("data_view");
  sparqlWidgetView.table.filterSelect.classList.add("table_filter");

  // Get document data
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
      // Add 3DFrames for each document
      response.results.bindings.forEach((element) => {
        // get feature
        const featureId = element.feature;
        const featureResult = fetchC3DTileFeatureWithNodeText(
          frame3DPlanar,
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
        iframe.src = element.uri;

        const domElement3D = new frame3d.DomElement3D(iframe);

        domElement3D.rotation.set(Math.PI * 0.5, 0, 0);
        domElement3D.position.set(featureCentroid.x, featureCentroid.y, 300); // not sure this works
        // domElement3D.position.set(center.x, center.y, 600);

        frame3DPlanar.appendDomElement3D(domElement3D);
      });
    });

  // TODO add click functions

  // Create div to integrate logo image
  const logoDiv = document.createElement("div");
  document.body.appendChild(logoDiv);
  logoDiv.id = "logo-div";
  const img = document.createElement("img");
  logoDiv.appendChild(img);
  img.src = "./assets/img/logo/logo-liris.png";
  img.id = "logoLiris";

  // Create info and help icons
  const iconDiv = document.createElement("div");
  iconDiv.id = "icon-div";
  document.body.appendChild(iconDiv);

  const buttonInfo = document.createElement("a");
  buttonInfo.title = "More information";
  buttonInfo.href = "https://github.com/DiegoVinasco/UD-Demo-DocGraph";
  const iconInfo = document.createElement("img");
  iconInfo.src = "./assets/svg/info-icon.svg";
  iconInfo.id = "iconInfo";
  buttonInfo.appendChild(iconInfo);

  const buttonHelp = document.createElement("a");
  buttonHelp.title = "Help/Tutorial";
  buttonHelp.href = "TODO";
  const iconHelp = document.createElement("img");
  iconHelp.src = "./assets/svg/help-icon.svg";
  iconHelp.id = "iconHelp";
  buttonHelp.appendChild(iconHelp);

  iconDiv.appendChild(buttonInfo);
  iconDiv.appendChild(buttonHelp);
});

/**
 *
 * Add a loading screen which add itself to document.body then remove it self when view layer initialize event it fires
 *
 * @param {itowns.PlanarView} view - itowns view
 * @param {Array<string>} labels - array of label to display
 */
// eslint-disable-next-line no-unused-vars
const loadingScreen = function (view, labels) {
  const root = document.createElement("div");
  root.classList.add("loading_screen");
  document.body.appendChild(root);

  const characterContainer = document.createElement("div");
  characterContainer.classList.add("loading_screen_character_container");
  root.appendChild(characterContainer);

  const characterArray = [];
  const spaceTag = "space_tag";
  labels.forEach((label) => {
    characterArray.push(...label.split(""));
    characterArray.push(spaceTag); // <== add space between label
  });

  const offsetAnimation = 0.05;
  characterArray.forEach((character, index) => {
    const el = document.createElement("div");
    el.classList.add("loading_screen_character");
    if (character == spaceTag) {
      el.style.width = "30px";
    } else {
      el.innerText = character;
    }
    el.style.animationDelay = offsetAnimation * index + "s";
    characterContainer.appendChild(el);
  });

  const removeLoadingScreen = () => {
    if (root.parentElement) {
      root.style.opacity = 0;
      root.addEventListener("transitionend", () => root.remove());
    }
    view.removeEventListener(
      itowns.VIEW_EVENTS.LAYERS_INITIALIZED,
      removeLoadingScreen
    );
  };

  view.addEventListener(
    itowns.VIEW_EVENTS.LAYERS_INITIALIZED,
    removeLoadingScreen
  );

  const timeout = 5000;
  setTimeout(removeLoadingScreen, timeout);
};

