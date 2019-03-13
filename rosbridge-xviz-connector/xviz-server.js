const WebSocket = require('ws');
const process = require('process');

const {XVIZMetadataBuilder, XVIZBuilder, encodeBinaryXVIZ} = require("@xviz/builder");

const xvizMetaBuider = new XVIZMetadataBuilder();
// we only have one stream for pose(location) for now

//where we define the pose of the car based on the navsat data 
xvizMetaBuider.stream('/vehicle_pose')
	.category("pose");
//what we will use to make plot the desired path of the car 
xvizMetaBuider.stream('/vehicle/trajectory')
	.category('primitive')
    .type('polyline');
xvizMetaBuider.stream('/camera/image_01').category("primitive").type("image");
const _metadata = xvizMetaBuider.getMetadata();
console.log("XVIZ server meta-data: ", JSON.stringify(_metadata));
// it turns out we cannot use a constant global builder, as all the primitives keeps adding up
//const xvizBuilder = new XVIZBuilder({
//    metadata: _metadata
//});

//const _mockImage = require('fs').readFileSync("./mock.png");

// Global cache for frames
let _frameCache = new Map();
// Global counter and cache for connections
let _connectionCounter = 1;
let _connectionMap = new Map();
let _connectionMap2 = new Map();
// Global server object
let _wss = null;

function connectionId() {
  const id = _connectionCounter;
  _connectionCounter++;
  return id;
}

// add a new location message 

function addLocationToFrame(frameNum, lat, lng, alt, time) {

    let frame = _frameCache.get(frameNum);
    let lastframe = _frameCache.get(frameNum-1);
    let heading = 0;
    if (lastframe) {
        // calculate heading based on current and previous location
        // ref: http://www.movable-type.co.uk/scripts/latlong.html
        let λ1 = lastframe.pose.longitude * 3.1415926 / 180;
        let λ2 = lng * 3.1415926 / 180;
        let φ1 = lastframe.pose.latitude * 3.1415926 / 180;
        let φ2 = lat * 3.1415926 / 180;
        let y = Math.sin(λ2-λ1) * Math.cos(φ2);
        let x = Math.cos(φ1)*Math.sin(φ2) - Math.sin(φ1)*Math.cos(φ2)*Math.cos(λ2-λ1);
        heading = Math.atan2(y, x);
    }
    if (frame) {
        frame.pose = {
            latitude: lat,
            longitude: lng,
            altitude: alt,
            timestamp: time,
            heading: heading
        };
    } else {
        _frameCache.set(frameNum, {
  	        pose: {
                latitude: lat,
                longitude: lng,
                altitude: alt,
                timestamp: time,
                heading: heading
            }
        });

    }

    console.log("new pose (frame, time, lat, lng, heading): ", frameNum, time, lat, lng, heading)
}


function addCarPathToFrame(frameNum,Vertex){

    let frame =  _frameCache.get(frameNum);

    if (frame) {
        frame.pathplan = {
            polygon: Vertex
        };
    } else {
        _frameCache.set(frameNum, {
            pathplan: {
                polygon: Vertex
            }
        });
    }

    console.log("new path Vector, frame, position  ", frameNum);

}

function tryServeFrame(frameNum){
    let frame = _frameCache.get(frameNum);
    // for now we only have location so as long as location data is ready, mark the frame ready
    //console.log("try serve ", frameNum,frame);
    if (frame && frame.pose /*&& frame.pathplan*/) {
        // frame is ready, serve it to all live connections
        //console.log("serving", frameNum);
        //this line serves the meta data used for the pose of the car
        let xvizBuilder = new XVIZBuilder({metadata: _metadata});
        xvizBuilder.pose('/vehicle_pose').timestamp(frame.pose.timestamp)
            .mapOrigin(frame.pose.longitude, frame.pose.latitude, frame.pose.altitude)
            .position(0,0,0).orientation(0,0,1.57-frame.pose.heading);
        xvizBuilder.primitive('/vehicle/trajectory').polyline([[2*Math.cos(1.57-frame.pose.heading), 2*Math.sin(1.57-frame.pose.heading), 0], [10*Math.cos(1.57-frame.pose.heading), 10*Math.sin(1.57-frame.pose.heading), 0]]).style({
            stroke_color: '#009500',//rgba(0, 150, 0, 0.3)
            stroke_width: 1.5
        });
        //xvizBuilder.primitive('/camera/image_01').image(_mockImage, "jpg").dimensions(500, 231);
	    const xvizFrame = JSON.stringify(xvizBuilder.getFrame());
        //console.log(`frame ${frameNum} is ready. `, xvizFrame);
        _connectionMap.forEach((context, connectionId, map) => {
            context.sendFrame(xvizFrame);
        });
        // after serve, delete the previous frame from the cache
        // so the cache always store 2 frames in history
        _frameCache.delete(frameNum-1);
        //console.log(frameNum-1, "deleted")
        return;
    }
    return;
}



class ConnectionContext {
    constructor() {
        this.connectionID = connectionId();
        this.t_start_time = null;
        this.initConnection.bind(this);
        this.onClose.bind(this);
        this.onMessage.bind(this);
        this.sendFrame.bind(this);
    }
    log(msg) {
        const prefix = `[id:${this.connectionID}]`;
        console.log(`${prefix} ${msg}`);
    }
    initConnection(ws) {
        this.log('> New connection from Client.');
        
        this.t_start_time = process.hrtime();
        this.ws = ws;

        ws.on('close', event => this.onClose(event));
    
        // Respond to control messages from the browser
        ws.on('message', msg => this.onMessage(msg));
    
        // On connection send metadata
        this.ws.send(JSON.stringify({
            type: "xviz/metadata",
            data: _metadata}), {compress: true});
        
        // add this connection context into global map
        _connectionMap.set(this.connectionID, this);

        // 'live' mode will not get the 'xviz/transform_log' message
        // so start sending immediately
        // sending will be triggered by new messages coming to server
    }
    
    onClose(event) {
        this.log(`> Connection Closed. Code: ${event.code} Reason: ${event.reason}`);
        _connectionMap.delete(this.connectionID);
    }
    
    onMessage(message) {
        const msg = JSON.parse(message);
        this.log(`> Message ${msg.type} from Client`);
        switch (msg.type) {
            case 'xviz/start': {
                // not sure why but there is no logic in Uber's example for start message
                break;
            }
            case 'xviz/transform_log': {
                // we are doing live streaming so no need to handle transform_log
                // ref: https://avs.auto/#/xviz/protocol/schema/session-protocol
                break;
            }
            default:
                this.log(`|  Unknown message ${msg}`);
        }
    }
    sendFrame(frame) {
        this.ws.send(frame, {compress: true});
        this.log("< sent frame.")
    }
}

module.exports = {
    startListenOn: function (portNum) {
        console.log(`xviz server starting on ws://localhost:${portNum}`);
        if (_wss) {
            console.log("startListenOn can only be called one time")
            process.exit(-1);
        }

        _wss = new WebSocket.Server({port: portNum});
        // Setups initial connection state
        _wss.on('connection', ws => {
            const context = new ConnectionContext();
            context.initConnection(ws);
        });
    },

    close: function(){
        console.log("xviz server shutting down");
        _wss.close();
    },

    updateLocation: function(frameNum, lat, lng, alt, time) {
        addLocationToFrame(frameNum, lat, lng, alt, time);
        tryServeFrame(frameNum);
    },

    updateCarPath: function(frameNum,Vertex) {
        addCarPathToFrame(frameNum,Vertex);
        //tryServeFrame(frameNum);
    }

};
