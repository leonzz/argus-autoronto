const ROSLIB = require("roslib");
const xvizServer = require('./xviz-server');

var heading = 0;

const rosBridgeClient = new ROSLIB.Ros({
    url : 'ws://localhost:9090'
});

// for location
const listener = new ROSLIB.Topic({
    ros : rosBridgeClient,
    name : '/navsat/fix'
});

// for planned path
const listener2 = new ROSLIB.Topic({
    ros : rosBridgeClient,
    name : '/PathPlanner/desired_path'
});

// for camera image
const listener3 = new ROSLIB.Topic({
  ros : rosBridgeClient,
  name : '/blackfly/image_color/compressed'
});

// for orientation from IMU
const listener5 = new ROSLIB.Topic({
  ros : rosBridgeClient,
  name : '/imu/data'
});


xvizServer.startListenOn(8081);

function gracefulShutdown() {
    console.log("shutting down rosbridge-xviz-connector");
    listener.unsubscribe();
    listener2.unsubscribe();
    listener3.unsubscribe();
    listener5.unsubscribe();
    rosBridgeClient.close();
    xvizServer.close();
}
process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

rosBridgeClient.on('connection', function() {
    console.log('Connected to rosbridge websocket server.');
});

rosBridgeClient.on('error', function(error) {
    console.log('Error connecting to rosbridge websocket server: ', error);
});

rosBridgeClient.on('close', function() {
    console.log('Connection to rosbridge websocket server closed.');
});




listener.subscribe(function(message) {
    // var msgNew = 'Received message on ' + listener.name + JSON.stringify(message, null, 2) + "\n";
    let timestamp = `${message.header.stamp.secs}.${message.header.stamp.nsecs}`;
    xvizServer.updateLocation(message.latitude, message.longitude, message.altitude, heading, parseFloat(timestamp));
});

listener3.subscribe(function(message) {
  //document.getElementById("camera-image").src = "data:image/jpg;base64,"+message.data;
  xvizServer.updateCameraImage(message.data);
});

//listener 5 is the imu data for the car 
listener5.subscribe(function (message) {
   //heading = message.orientation.w;
   // quaternion to heading (z component of euler angle) ref: https://en.wikipedia.org/wiki/Conversion_between_quaternions_and_Euler_angles
   heading = Math.atan2( 2*( message.orientation.z * message.orientation.w + message.orientation.x * message.orientation.y), 1 - 2 * ( message.orientation.z * message.orientation.z + message.orientation.y * message.orientation.y ));
});

//listener 2 which is used to pipe the road information
/* listener2.subscribe(function(message) {
    let timestamp = `${message.header.stamp.secs}.${message.header.stamp.nsecs}`;

    Lg =message.poses.length  
    // we will setup a for loop to find the value of x at every instance in the ros bag 

    for( i = 0; i < Lg-1; i++){
    X[i]= message.poses[i].pose.position.x;
    Y[i]= message.poses[i].pose.position.y;
    Z[i]= message.poses[i].pose.position.z;


    Vertex[i] = [X[i], Y[i], Z[i] ];
    }
    xvizServer.updateCarPath(message.header.seq,Vertex);
}); */



/* *******************************************
    example messages from autoronto rosbag
   *******************************************
/navsat/fix
{
  "status": {
    "status": 1,
    "service": 1
  },
  "altitude": 199.7761318050325,
  "longitude": -79.49318405488258,
  "position_covariance": [
    0.0010528246732758456,
    0,
    0,
    0,
    0.0009475859465466786,
    0,
    0,
    0,
    0.003330984526718331
  ],
  "header": {
    "stamp": {
      "secs": 1547842797,
      "nsecs": 343172073
    },
    "frame_id": "odom",
    "seq": 8657
  },
  "latitude": 43.77244162032462,
  "position_covariance_type": 2
}


Sample message for path planner 

"header": {
    "stamp": {
      "secs": 1543772146,
      "nsecs": 74801286
    },
    "frame_id": "odom",
    "seq": 315
  },
  "poses": [
    {
      "header": {
        "stamp": {
          "secs": 1543772146,
          "nsecs": 74801286
        },
        "frame_id": "odom",
        "seq": 0
      },
      "pose": {
        "position": {
          "y": 4848835.091953225,
          "x": 623524.6569839834,
          "z": 191
        },
        "orientation": {
          "y": 0,
          "x": 0,
          "z": -0.15122290308358546,
          "w": 0.9884996882058044
        }
      }
    },
******************************************* */
