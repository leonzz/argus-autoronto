const ROSLIB = require("roslib");
const xvizServer = require('./xviz-server');

/* 
The purpose of these x,y,z is to send what the ros topic considers to be a pose x,y,z in UTM coordinates and transform them into a set of lattitude and longitude
values which we can use to set an object in the map. */
var X = [0], Y = [0], Z = [0],i=0, k =[], Vertex = [] ;


//these variables set up the projected car path of the car 
var CarPath = [], X_path = [], Y_path = [], Z_path = [];

// these variables will be used to store the map infromation for objects in the car FOV. 
var obs_lat = [0], obs_long = [0], Found_object = 0, obs_info = [0]; obs_UTM = [0];
var delta_object = [];

//these variables will be used to store the map information for the car 
var car_lat = [0]; car_lon = [0], car_alt = [0];
var car_info = [0]; delta_car = [], car_UTM= [] ;
var car_x0 = [0], car_y0 = [0], car_z0 = [0], car_x = [], car_y = [], car_z = [],car_odom = [];

//Value used to store IMU heading value 
var W = [0], Orient_x = [], Orient_y = [], Orient_y = [], Orient_w = [];


/***************************************************************
//section of the code where we subscribe to the multiple topics published by the rosbag
*****************************************************************/

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



// for obstacle information
const listener3 = new ROSLIB.Topic({
    ros : rosBridgeClient,
    name : '/planner_obstacles'
});


// for obstacle information
const listener4 = new ROSLIB.Topic({
    ros : rosBridgeClient,
    name : '/navsat/odom'
});


// for obstacle information
const listener5 = new ROSLIB.Topic({
    ros : rosBridgeClient,
    name : '/imu/data'
});

/***********************************************************/




xvizServer.startListenOn(8081);

function gracefulShutdown() {
    console.log("shutting down rosbridge-xviz-connector");
    listener.unsubscribe();
    listener2.unsubscribe();
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



    // combine car info from rosbag into a single property to be piped into the xviz-server
    car_lat = message.latitude;
    car_lon = message.longitude;
    car_alt = message.altitude;

    //ful list of car info in format latitude, longitude, altitude
    car_info = [ car_lat, car_lon, car_alt, W];
    xvizServer.updateLocation(message.header.seq, car_info, obs_info, car_UTM, CarPath, parseFloat(timestamp));
});

//listener 2 which is used to pipe the road information
listener2.subscribe(function (message) {


    Lg = message.poses.length;
    var i = 0;

    for (j = 0; j <= Lg - 1; j++) {
        //extract all the values from the path planner
        X_path[j] = message.poses[j].pose.position.x;
        Y_path[j] = message.poses[j].pose.position.y;
        Z_path[j] = message.poses[j].pose.position.z;
        
        //This loop is meant to only extract points which have a valid value. 
        if (typeof X_path[j] === 'number') {
            if (typeof Y_path[j] === 'number') {
                if (typeof Z_path[j] === 'number') {
                    CarPath[j] = [X_path[j], Y_path[j], Z_path[j]];
                }
            }
           }   
    }
 
});

//listener 3 is the information of an object in the path of the car 
listener3.subscribe(function (message) {
    // let timestamp = `${message.markers.header.stamp.secs}.${message.markers.header.stamp.nsecs}`;

    X = message.markers[0].pose.position.x;
    Y = message.markers[0].pose.position.y;
    Z = message.markers[0].pose.position.z;

    obs_UTM = [X, Y, Z];

    if (X != 0 && Y != 0) {
        //object found! 
        Found_object = 1;
    }



    obs_info = [delta_object[0], delta_object[1], delta_object[2], Found_object];

});


//listener 4 is the odometry information of the car 
listener4.subscribe(function (message) {
    // let timestamp = `${message.markers.header.stamp.secs}.${message.markers.header.stamp.nsecs}`;


    if (car_x0 == 0, car_y0 == 0, car_z0 == 0) {

        car_x0 = message.pose.pose.position.x;
        car_y0 = message.pose.pose.position.y;
        car_z0 = message.pose.pose.position.z;
           }

// we remove the initial position to get the relative motion of the car from time t0 
    car_x = message.pose.pose.position.x;
    car_y = message.pose.pose.position.y;
    car_z = message.pose.pose.position.z;
   
    car_odom = [car_x, car_y, car_z];




    car_UTM = [message.pose.pose.position.x,message.pose.pose.position.y,message.pose.pose.position.z];


     delta_object = distance(obs_UTM, car_UTM);

});


//listener 5 is the imu data for the car 
listener5.subscribe(function (message) {
        
   // W = Math.atan(message.orientation.x, message.orientation.y)*Math.PI/180;
    Orient_x = message.orientation.x;
    Orient_y = message.orientation.y;
    Orient_z = message.orientation.z;
    Orient_w = message.orientation.w;

    W = Orient_w;

     

});

//function desgined to convert from UTM to long,lat 
function GetLatLon(easting, northing) {
    /*for the purposes of this function we assume that values related to X are the eastings 
    for the purposes of this function we assume that values related to Y are the northing
    
The main purpose of this function is to conver the UTM coordinates to latitude and longitude for an arbritary set of given coordinates. 
Assumed:
- Zone = 17 (Which is the value for Toronto. 

Code is adapted from: https://www.movable-type.co.uk/scripts/latlong-utm-mgrs.html?fbclid=IwAR3LFB4iyQzEqcrZEynbiDZWb1gbTh-t4z6FeIIweW_0c0zLrQ8otX6q-Pk 
    */

    //This is modified from the following website: https://www.movable-type.co.uk/scripts/latlong-utm-mgrs.html?fbclid=IwAR3YtlscFlgl6K4pral7wCJzlIVeuEx3BPSSmWg6pxJ1-URjSBoRqorK6vo


    // This value will need to be set by the user prior to starting the model. This is in the case the car is operating somewere else other than Toronto which is zone 17  
    const z = 17;
    // This value will need to be set by the user prior to starting the model. This is in the case the car is operating in the southern hemisphere 
    const h = 'N';

    const falseEasting = 500e3, falseNorthing = 10000e3;

    const a = 6378137, f = 1 / 298.257223563;
    // WGS-84: a = 6378137, b = 6356752.314245, f = 1/298.257223563;

    const k0 = 0.9996; // UTM scale on the central meridian

    const x = easting - falseEasting;                            // make x ± relative to central meridian
    const y = h == 'S' ? northing - falseNorthing : northing; // make y ± relative to equator


    // ---- from Karney 2011 Eq 15-22, 36:

    const e = Math.sqrt(f * (2 - f)); // eccentricity
    const n = f / (2 - f);        // 3rd flattening
    const n2 = n * n, n3 = n * n2, n4 = n * n3, n5 = n * n4, n6 = n * n5;

    const A = a / (1 + n) * (1 + 1 / 4 * n2 + 1 / 64 * n4 + 1 / 256 * n6); // 2πA is the circumference of a meridian

    const η = x / (k0 * A);
    const ξ = y / (k0 * A);

    const β = [null, // note β is one-based array (6th order Krüger expressions)
        1 / 2 * n - 2 / 3 * n2 + 37 / 96 * n3 - 1 / 360 * n4 - 81 / 512 * n5 + 96199 / 604800 * n6,
               1 / 48 * n2 + 1 / 15 * n3 - 437 / 1440 * n4 + 46 / 105 * n5 - 1118711 / 3870720 * n6,
                        17 / 480 * n3 - 37 / 840 * n4 - 209 / 4480 * n5 + 5569 / 90720 * n6,
                                 4397 / 161280 * n4 - 11 / 504 * n5 - 830251 / 7257600 * n6,
                                               4583 / 161280 * n5 - 108847 / 3991680 * n6,
                                                             20648693 / 638668800 * n6];

    let ξʹ = ξ;
    for (let j = 1; j <= 6; j++) ξʹ -= β[j] * Math.sin(2 * j * ξ) * Math.cosh(2 * j * η);
    

    let ηʹ = η;
    for (let j = 1; j <= 6; j++) ηʹ -= β[j] * Math.cos(2 * j * ξ) * Math.sinh(2 * j * η);

    const sinhηʹ = Math.sinh(ηʹ);
    const sinξʹ = Math.sin(ξʹ), cosξʹ = Math.cos(ξʹ);

    const τʹ = sinξʹ / Math.sqrt(sinhηʹ * sinhηʹ + cosξʹ * cosξʹ);

    let δτi = null;
    let τi = τʹ;
    do {
        const σi = Math.sinh(e * Math.atanh(e * τi / Math.sqrt(1 + τi * τi)));
        const τiʹ = τi * Math.sqrt(1 + σi * σi) - σi * Math.sqrt(1 + τi * τi);
        δτi = (τʹ - τiʹ) / Math.sqrt(1 + τiʹ * τiʹ)
            * (1 + (1 - e * e) * τi * τi) / ((1 - e * e) * Math.sqrt(1 + τi * τi));
        τi += δτi;
    } while (Math.abs(δτi) > 1e-12); // using IEEE 754 δτi -> 0 after 2-3 iterations
    // note relatively large convergence test as δτi toggles on ±1.12e-16 for eg 31 N 400000 5000000
    const τ = τi;

    const φ = Math.atan(τ);
    let λ = Math.atan2(sinhηʹ, cosξʹ);

    // ---- convergence: Karney 2011 Eq 26, 27

    let p = 1;
    for (let j = 1; j <= 6; j++) p -= 2 * j * β[j] * Math.cos(2 * j * ξ) * Math.cosh(2 * j * η);
    let q = 0;
    for (let j = 1; j <= 6; j++) q += 2 * j * β[j] * Math.sin(2 * j * ξ) * Math.sinh(2 * j * η);

    const γʹ = Math.atan(Math.tan(ξʹ) * Math.tanh(ηʹ));
    const γʺ = Math.atan2(q, p);

    const γ = γʹ + γʺ;

    // ---- scale: Karney 2011 Eq 28

    const sinφ = Math.sin(φ);
    const kʹ = Math.sqrt(1 - e * e * sinφ * sinφ) * Math.sqrt(1 + τ * τ) * Math.sqrt(sinhηʹ * sinhηʹ + cosξʹ * cosξʹ);
    const kʺ = A / a / Math.sqrt(p * p + q * q);

    const k = k0 * kʹ * kʺ;

    // ------------

    const λ0 = ((z - 1) * 6 - 180 + 3)*Math.PI/180; // longitude of central meridian
    λ += λ0; // move λ from zonal to global coordinates
    
    // round to reasonable precision
    const lat = Number(φ*180/Math.PI); // nm precision (1nm = 10^-11°)
    const lon = Number(λ * 180 / Math.PI); // (strictly lat rounding should be φ⋅cosφ!)


    return [lat, lon];
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
******************************************* */


//function used to get the distance between car and object 
function distance(object,car) {

    var dist_delta = [0];

    //this is only true when an object has been detected.
    if (object[1] != 0) {
        for (i = 0; i<= car.length-1;i++ ){
            dist_delta[i] = object[i] - car[i];
       }

    }
    
    return dist_delta;
}
