const fs = require("fs");
const {parseBinaryXVIZ} = require('@xviz/parser');


// This script is for dev/testing purpose
// to check the xviz sample data for its formatting

let data = fs.readFileSync("~/project/xviz/data/generated/kitti/2011_09_26/2011_09_26_drive_0005_sync/3-frame.glb");
let json = parseBinaryXVIZ(data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength));
console.log(JSON.stringify(json.data.updates[0].primitives['/tracklets/objects'].polygons[0]));
