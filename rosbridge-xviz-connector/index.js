const ROSLIB = require("roslib");
const xvizServer = require('./xviz-server');

const rosBridgeClient = new ROSLIB.Ros({
    url : 'ws://localhost:9090'
});

const listener = new ROSLIB.Topic({
    ros : rosBridgeClient,
    name : '/navsat/fix'
});

xvizServer.startListenOn(8081);

function gracefulShutdown() {
    console.log("shutting down rosbridge-xviz-connector");
    listener.unsubscribe();
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
    xvizServer.updateLocation(message.header.seq, message.latitude, message.longitude, message.altitude, parseFloat(timestamp));
});

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
******************************************* */
