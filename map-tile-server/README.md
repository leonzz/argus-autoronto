# map-tile-server

This folder is only for documenting the steps to start a local map tile server. We use a third party package called [http://tileserver.org/](http://tileserver.org/). To install, use the following command:

```
# you need npm and nodejs installed first in your system

sudo npm install --unsafe-perm=true -g tileserver-gl-light
```

A local map data source is also needed. An OpenStreetMap-vector-tiles file is used in this case. For example, the map for Toronto, ON, Canada can be downloaded here at [OpenMapTiles](https://openmaptiles.com/downloads/north-america/canada/toronto/).

Put the map file in the same folder (e.g. `toronto.mbtiles`), and then start the map tile server:

```
ls # make sure the *.mbtiles file in in the working directory
README.md  toronto.mbtiles

# start map tile server on port 10001:
tileserver-gl-light -p 10001
```