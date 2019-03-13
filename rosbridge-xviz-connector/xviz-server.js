const WebSocket = require('ws');
const process = require('process');

const {XVIZMetadataBuilder, XVIZBuilder, encodeBinaryXVIZ} = require("@xviz/builder");

const xvizMetaBuider = new XVIZMetadataBuilder();
// we only have one stream for pose(location) for now

xvizMetaBuider
//where we define the pose of the car based on the navsat data 
	.stream('/vehicle_pose')
	.category("pose")

//what we will use to make plot the desired path of the car 

	.stream('/Car_path')
	.category('primitive')
	.type('polygon');

const _metadata = xvizMetaBuider.getMetadata();
console.log("XVIZ server meta-data: ", JSON.stringify(_metadata));
const xvizBuilder = new XVIZBuilder({
    metadata: _metadata
});




// Global cache for frames
let _frameCache = new Map();
let _frameCache2 = new Map();
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

    if (frame) {
        frame.pose = {
            latitude: lat,
            longitude: lng,
            altitude: alt,
            timestamp: time
        };
    } else {
        _frameCache.set(frameNum, {
  	pose: {
                latitude: lat,
                longitude: lng,
                altitude: alt,
		timestamp: time
            }
        });

    }

 console.log("new pose (frame, time, lat, lng): ", frameNum, time, lat, lng)
}






function generatePath(frameNum,Vertex){

let path =  _frameCache2.get(frameNum);

    if (path) {
        path.primitive = {
            polygon: Vertex
        };
    } else {
        _frameCache.set(frameNum, {
  	primitive: {
                polygon: Vertex
            }
        });
    }

console.log("new path Vector, frame, position  ", frameNum,path);

}

function tryServeFrame(frameNum){
    let frame = _frameCache.get(frameNum);
    // for now we only have location so as long as location data is ready, mark the frame ready
    if (frame && frame.pose) {
        // frame is ready, serve it to all live connections
	
	//this line serves the meta data used for the pose of the car 
       	    xvizBuilder.pose('/vehicle_pose').timestamp(frame.pose.timestamp)
            .mapOrigin(frame.pose.longitude, frame.pose.latitude, frame.pose.altitude)
            .position(0,0,0).orientation(0,0,0);
	const xvizFrame = JSON.stringify(xvizBuilder.getFrame());
      //  console.log(`frame ${frameNum} is ready. `, xvizFrame);
        _connectionMap.forEach((context, connectionId, map) => {
            context.sendFrame(xvizFrame);
        });
        // after serve, delete frame from the cache
        _frameCache.delete(frameNum);
        return;
    }
    return;	
return;
}

// check if a frame is ready to serve (i.e. contains all streams of data)
// and serve the frame to all xviz connections if it is ready
function ShowPath(frameNum) {
    let path = _frameCache2.get(frameNum);
    // for now we only have location so as long as location data is ready, mark the frame ready
    if (path) {
       	    xvizBuilder.primitive('/Car_path').polygon(path.primitive.polygon)
	const xvizFrame = JSON.stringify(xvizBuilder.getFrame());
      //  console.log(`frame ${frameNum} is ready. `, xvizFrame);
        _connectionMap2.forEach((context, connectionId, map) => {
            context.sendFrame(xvizFrame);
        });
        // after serve, delete frame from the cache
        _frameCache2.delete(frameNum);
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

//function which gets the rosbridge info for the new location of the car 
    updateLocation: function(frameNum, lat, lng, alt, time) {
// function which will display the car path 
       addLocationToFrame(frameNum, lat, lng, alt, time);
        tryServeFrame(frameNum);
},


   CarPath: function(frameNum,Vertex){
	generatePath(frameNum,Vertex);
	ShowPath(frameNum);
	}




};
