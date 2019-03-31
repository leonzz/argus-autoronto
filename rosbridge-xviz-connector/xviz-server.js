const WebSocket = require('ws');
const process = require('process');

const {XVIZMetadataBuilder, XVIZBuilder, encodeBinaryXVIZ} = require("@xviz/builder");

// Variables used in the ProjectedPath function
var memory = 0, index = 0, count= 0, Prev_Odom=[],T0=[], duration = [];
var test =[0];
var Mod_Path = []; // This is the modified path to check that only numbers were obtained from the path planner 
var j = 0; // index used to keep track of the actual number of points in the planned path which are non zero value 


const xvizMetaBuider = new XVIZMetadataBuilder();
// we only have one stream for pose(location) for now

//where we define the pose of the car based on the navsat data 
xvizMetaBuider.stream('/vehicle_pose')
	.category("pose");
//what we will use to make plot the desired path of the car 
xvizMetaBuider.stream('/vehicle/trajectory')
	.category('primitive')
    .type('polygon');


// adding one more to show a box to represent the object seen by the car 
xvizMetaBuider.stream('/Obstcale/position')
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

function addLocationToFrame(frameNum, car_info, obs_info, CarPath, time) {

    let frame = _frameCache.get(frameNum);
    let lastframe = _frameCache.get(frameNum-1);
    let heading = 0;
    
    
    
    if (lastframe) {
        // calculate heading based on current and previous location
        // ref: http://www.movable-type.co.uk/scripts/latlong.html
        let λ1 = lastframe.pose.longitude * 3.1415926 / 180;
        let λ2 = car_info[1]* 3.1415926 / 180;
        let φ1 = lastframe.pose.latitude * 3.1415926 / 180;
        let φ2 = car_info[0] * 3.1415926 / 180;
        let y = Math.sin(λ2-λ1) * Math.cos(φ2);
        let x = Math.cos(φ1)*Math.sin(φ2) - Math.sin(φ1)*Math.cos(φ2)*Math.cos(λ2-λ1);
        heading = Math.atan2(y, x);    
    }

    //this will set the vehicle log, lat, alt for it to be displayed in the map
    if (frame) {

        //car pose info 
        frame.pose = {
            latitude: car_info[0],
            longitude: car_info[1],
            altitude: car_info[2],
            timestamp: time,
            heading: 5/3*Math.PI+car_info[3]
        };

        //object pose info 
        frame.Objectpose = {
            latitude: obs_info[0],
            longitude: obs_info[1],
            altitude: obs_info[2],
            timestamp: time,
            detected: obs_info[3]
        };

       //car path information:
        frame.ProjectedPosition = {
            point : CarPath
        };
    } else {
        _frameCache.set(frameNum, {
            pose: {
                latitude: car_info[0],
                longitude: car_info[1],
                altitude: car_info[2],
                timestamp: time,
                heading: 5/3*Math.PI+car_info[3]
            },

            Objectposition: {
                x: obs_info[0],
                y: obs_info[1],
                z: obs_info[2],
                timestamp: time,
                detected: obs_info[3]
            },
            
            ProjectedPosition: {
                point : CarPath  
            
            }
       
        });
    }

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
            .position(0,0,0).orientation(0,0,frame.pose.heading);
      //  console.log(frame.ProjectedPosition.Path);

        xvizBuilder.primitive('/vehicle/trajectory').polyline(frame.ProjectedPosition.point).style({
            stroke_color: '#009500',//rgba(0, 150, 0, 0.3)
            stroke_width: 1.5 });



        //this is for displaying the positon of the obsatcle in space

        if (frame.Objectposition.detected==1){                   
            xvizBuilder.primitive('/Obstcale/position').polygon([[frame.Objectposition.x,frame.Objectposition.y,0],[frame.Objectposition.x+1,frame.Objectposition.y,0],[frame.Objectposition.x+1,frame.Objectposition.y+1,1],[frame.Objectposition.x,frame.Objectposition.y+1,1]]).style({
                stroke_color: '#ff0000',//rgba(150, 0, 0, 0.3)
                stroke_width: 1.5
            });
        }
        
        

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

    updateLocation: function(frameNum, car_info, obs_info, Car_Odom,Car_Path, time) {




       test = ProjectedPath(Car_Odom,Car_Path,time)
        
      console.log(test);

      Planned_Path = [0,0,0]


        addLocationToFrame(frameNum, car_info, obs_info, Planned_Path, time);
        tryServeFrame(frameNum);



    }
    
};

function ProjectedPath(Car_Odom,Car_Path,time){
   
    /*This is where we define the number of points which will make up the size of the path seen by XViz. If you can to reduce aliasing of the line increase the number of rows. 
    For this example the predicted path will have 3 points: 
    P1 = [0,0,0] since the x,y,z value are relative to the position of the car setting them to zero sticks the predicted path at the origin of the car. 
    P2 = [x2,y2,z2]
    P3 = [X3,y3,z3] 

    Both P2 and P3 are adjustable depending on where we want to index the path planner Ros topic. For now P3 is index 10 which is 2m away from the car. 

*/

    var  i, Lg ;
    var Look_Ahead_dist = 5; //this is the distance for 1m  
    var points = 8; // change this if you want the car to have more or less points. The more points you add the further the car will look in the future. 
    var Path = [];
    
    Lg = Car_Path.length; // overall length of predicted path. 
    //Lg = 103; //Only the first 103 items have the path info (found experimentally)
 


    //This loop is meant to only extract points which are not NaN. 
    for (j = 0; j <= Lg; j++){
        if (Number.isNaN(Car_Path(j) == false)){
            Mod_Path[j] = Car_Path[j];
        }
    }
    


    /*
    if(T0==0){

        T0 = time;
    }
        
    duration = time -T0;
        //check if the elpased time is greater than one second
    if (duration - memory >1){
        memory = duration;
   
        //only increase the projected path when the car is moving
        if (Car_Odom[0]>0){
            count = count +1; // this counter is used to increment the look ahead distance once a delta of 1s occurs. 
               
        }
        }

    if (index <= Lg){
        
        //this generates a path as long as the number of points I wish to display
        for ( i = 1; i <= points; i ++ ){
          // setting this at 0,0,0 will always make the path start at the base of the car 
          Path[0] = [0,0,0];           
         
          index = count+i*Look_Ahead_dist;
          Path[i] = Car_Path[index];
        }
        
        

    }
        
        */
    return Path;
}