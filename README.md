# UD-Demo-Graph-SPARQL

[![Build Status](https://app.travis-ci.com/VCityTeam/UD-Demo-Graph-SPARQL.svg?branch=master)](https://app.travis-ci.com/github/VCityTeam/UD-Demo-Graph-SPARQL)

A template repository for creating demos for visualizing RDF semantic graphs alongside 3D City models using:
* [UD-Viz](https://github.com/VCityTeam/UD-Viz) as a frontend web application for urban data visualization
  * In particular the [SPARQL module](https://github.com/VCityTeam/UD-Viz/tree/master/src/Widgets/Extensions/SPARQL) is used to visualize semantic urban data in the form of RDF
* [Strabon RDF Store](http://www.strabon.di.uoa.gr/) an RDF-Store for storing and serving geospatial semantic graph data in the form of RDF
* [PostGIS](https://postgis.net/) a geospatial database extension of [PostgreSQL](https://www.postgresql.org/) used here as a backend database for Strabon

### Component Diagram
![SPARQL POC Component Diagram](./UD-Demo_SPARQL_POC_Component_Diagram.svg)

## Installation

### Pre-requisites 

* [Install Docker](https://docs.docker.com/engine/install/)
* [Install Docker Compose](https://docs.docker.com/compose/install/)

### Repository setup
To begin create a new Github repository using this template:

![image](https://user-images.githubusercontent.com/23373264/217045942-5f994e2d-431e-4620-bf76-f1cc1f1d7673.png)

Once generated, use the new repository can be cloned:
```
git clone [your new repository URL]
```

### Component Setup
To configure the demo and the components that support it edit the `.env` file to be launched with docker-compose. By default the following ports are used by the following services:
- 8996: `PostGIS`
- 8997: `Strabon`
- 8998: `UD-Viz`

The following sections will describe how to configure this file for each component. 

### Build Images and run containers
First, build the PostGIS, Strabon, and UD-Viz docker images and run their containers:
```
docker-compose up
```

**Note:** Make sure to set the `sparqlModule/url` port in the `./ud-viz-context/config.json` file to the same port for the _Strabon_ container declared in the `.env` file. If these ports are ever changed after building the images, the _UD-Viz_ image must be rebuilt:
```
docker-compose rm udviz
docker-compose build udviz
```

### Upload RDF-Store Dataset
All files in the [data folder](./strabon-context/data) are copied into the Strabon container at `/data`. To upload these files into Strabon to be used by the sparqlModule:
1. Open a web browser and navigate to `localhost:8997/strabon`
2. From the left menu, click *Explore/Modify operations* then *Store*
3. Copy and paste the local path of each file in the data folder as `file:///data/[file to upload]` into the *URI Input* field and click *Store from URI*
   - ⚠️ You may be asked to enter the Strabon administrative credentials here. However, these credentials currently cannot be changed from the `.env` file. See issue [#1](https://github.com/VCityTeam/UD-Demo-Graph-SPARQL/issues/1).

Now the demo is ready and can be accessed from `localhost:8998`
