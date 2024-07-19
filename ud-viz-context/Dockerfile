FROM ubuntu:focal

LABEL maintainer "VCityTeam"
LABEL source.repo "https://github.com/VCityTeam/UD-Viz-docker"

RUN apt-get update

# Node version 14 is required. For its installation (on focal) refer to e.g.
#  https://computingforgeeks.com/install-node-js-14-on-ubuntu-debian-linux/
RUN apt-get install -y curl
RUN curl -sL https://deb.nodesource.com/setup_18.x | bash -
RUN apt-get install -y nodejs
RUN node --version
RUN npm --version
RUN apt-get install -y git
RUN git --version

######### Install UD-Viz-Template, a basic web application for UD-Viz projects
WORKDIR /
RUN git clone https://github.com/VCityTeam/UD-Viz-Template.git
WORKDIR /UD-Viz-Template
COPY package.json package.json
RUN npm install
COPY index.html index.html
ADD src src
RUN npm run build

# Add/overwrite default assets
ADD assets assets

EXPOSE 8000
CMD [ "node", "./bin/server.js" ]