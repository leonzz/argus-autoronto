const ROSLIB = require("roslib");
const xvizServer = require('./xviz-server');

let car_heading_utm_north = 0; // global variable that stores heading/orientation of the car
let car_pos_utm = null; // global variable that stores car location in UTM
let plannedPath = null; // global variable that hold an array of planned path

const rosBridgeClient = new ROSLIB.Ros({
    url : 'ws://localhost:9090'
});

// for car location in latitude and longitude
const listener = new ROSLIB.Topic({
    ros : rosBridgeClient,
    name : '/navsat/fix'
});

// for planned path in UTM coordinate
const listener2 = new ROSLIB.Topic({
    ros : rosBridgeClient,
    name : '/PathPlanner/desired_path'
});

// for camera image
/*const listener3 = new ROSLIB.Topic({
  ros : rosBridgeClient,
  name : '/blackfly/image_color/compressed'
});*/

// for car location in UTM coordinate and orientation
const listener4 = new ROSLIB.Topic({
  ros : rosBridgeClient,
  name : '/navsat/odom'//there is another topic '/imu/data' that has orientation
});

// for obstacle information
const listener5 = new ROSLIB.Topic({
    ros : rosBridgeClient,
    name : '/planner_obstacles'
});

xvizServer.startListenOn(8081);

function gracefulShutdown() {
    console.log("shutting down rosbridge-xviz-connector");
    listener.unsubscribe();
    listener2.unsubscribe();
    //listener3.unsubscribe();
    listener4.unsubscribe();
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
    xvizServer.updateLocation(message.latitude, message.longitude, message.altitude, car_heading_utm_north, parseFloat(timestamp));
});
listener2.subscribe(function(message) {
    plannedPath = message.poses;
});
/*listener3.subscribe(function(message) {
  //document.getElementById("camera-image").src = "data:image/jpg;base64,"+message.data;
  xvizServer.updateCameraImage(message.data);
});*/
//listener 4 is the odometry of the car, location in UTM and orientation
listener4.subscribe(function (message) {
    let orientation = message.pose.pose.orientation;
    // quaternion to heading (z component of euler angle) ref: https://en.wikipedia.org/wiki/Conversion_between_quaternions_and_Euler_angles
    // positive heading denotes rotating from north to west; while zero means north
    car_heading_utm_north = Math.atan2( 2*( orientation.z * orientation.w + orientation.x * orientation.y), 1 - 2 * ( orientation.z * orientation.z + orientation.y * orientation.y ));
    if (plannedPath) {
        // if plannedPath is a valid array, then find the trajectory to display 
        // that within 100m of the car's current location in front
        trajectory = [];
        car_pos_utm = message.pose.pose.position;
        for (i=0;i<plannedPath.length;i++){
            if ( distance(plannedPath[i].pose.position, car_pos_utm) < 100 
                && isInFront(car_pos_utm, car_heading_utm_north, plannedPath[i].pose.position) ) {
                trajectory.push([
                    plannedPath[i].pose.position.x - car_pos_utm.x,
                    plannedPath[i].pose.position.y - car_pos_utm.y,
                    0
                ]);
            }
        }
        if (trajectory.length > 0) {
            xvizServer.updateCarPath(trajectory);
        } else {
            xvizServer.updateCarPath(null);
        }
    }
});
listener5.subscribe(function (message) {
    obstacles = [];
    for (i=0;i<message.markers.length;i++){
        let markerPos = message.markers[i].pose.position;
        if (markerPos.x>0 && markerPos.y >0) {
            obstacles.push([
                markerPos.x - car_pos_utm.x,
                markerPos.y - car_pos_utm.y,
                markerPos.z
            ]);
        }
    }
    if (obstacles.length>0){
        xvizServer.updateObstacles(obstacles);
    } else {
        xvizServer.updateObstacles(null);
    }
});

function distance(UTMlocation1, UTMlocation2) {
    let delta_x = UTMlocation2.x - UTMlocation1.x; // UTM x-axis: easting
    let delta_y = UTMlocation2.y - UTMlocation1.y; // UTM y-axis: northing
    // ignoring z value
    return Math.sqrt( delta_x * delta_x + delta_y * delta_y );
}
// return a boolean that will be true if targetLocation is in front of carLocation
// give the heading of the car (zero points to north and positive denotes rotating to west)
function isInFront(carLocationUTM, heading, targetLocationUTM) {
    let delta_x = targetLocationUTM.x - carLocationUTM.x;
    let delta_y = targetLocationUTM.y - carLocationUTM.y;
    return ( -Math.sin(heading) * delta_x + Math.cos(heading) * delta_y > 0 );
}

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
    ...
  ]
******************************************* */