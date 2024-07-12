FROM ubuntu:focal

LABEL maintainer "VCityTeam"
LABEL source.repo "https://github.com/VCityTeam/UD-Viz-docker"

RUN apt-get update

# Node version 14 is required. For its installation (on focal) refer to e.g.
#  https://computingforgeeks.com/install-node-js-14-on-ubuntu-debian-linux/
RUN apt-get install -y curl
RUN curl -sL https://deb.nodesource.com/setup_14.x | bash -
RUN apt-get install -y nodejs
RUN node --version
RUN npm --version
RUN apt-get install -y git
RUN git --version

######### Install SimpleServer (an ExpressJS based...simple server)
RUN git clone https://github.com/VCityTeam/UD-SimpleServer
WORKDIR /UD-SimpleServer
RUN npm install

######### Install UD-Viz-Template, a basic web application for UD-Viz projects
WORKDIR /
RUN git clone https://github.com/VCityTeam/UD-Viz-Template.git
WORKDIR /UD-Viz-Template
COPY package.json package.json
COPY bootstrap.js src/bootstrap.js
RUN npm install
RUN npm run build

# Add/overwrite default assets
COPY config.json /UD-Viz-Template/assets/config/config.json
COPY sparqlModule.svg /UD-Viz-Template/assets/icons/sparqlModule.svg

WORKDIR /UD-SimpleServer
EXPOSE 80
CMD [ "node", "./index.js", "/UD-Viz-Template", "80" ]