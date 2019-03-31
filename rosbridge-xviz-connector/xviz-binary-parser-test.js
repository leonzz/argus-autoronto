const fs = require("fs");
const {parseBinaryXVIZ} = require('@xviz/parser');


// This script is for dev/testing purpose
// to check the xviz sample data for its formatting

let data = fs.readFileSync("./1-frame.glb");
let json = parseBinaryXVIZ(data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength));
console.log(JSON.stringify(json));
