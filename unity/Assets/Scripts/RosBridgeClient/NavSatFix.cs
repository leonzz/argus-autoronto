/*
Author: Leon Ziyang Zhang (ziyang.zhang@mail.utoronto.ca, zhangzyster@gmail.com)

Created At: Feb 18, 2019
*/

/*
 * Message Definition for sensor_msgs/NavSatFix
rosmsg info sensor_msgs/NavSatFix
uint8 COVARIANCE_TYPE_UNKNOWN=0
uint8 COVARIANCE_TYPE_APPROXIMATED=1
uint8 COVARIANCE_TYPE_DIAGONAL_KNOWN=2
uint8 COVARIANCE_TYPE_KNOWN=3
std_msgs/Header header
  uint32 seq
  time stamp
  string frame_id
sensor_msgs/NavSatStatus status
  int8 STATUS_NO_FIX=-1
  int8 STATUS_FIX=0
  int8 STATUS_SBAS_FIX=1
  int8 STATUS_GBAS_FIX=2
  uint16 SERVICE_GPS=1
  uint16 SERVICE_GLONASS=2
  uint16 SERVICE_COMPASS=4
  uint16 SERVICE_GALILEO=8
  int8 status
  uint16 service
float64 latitude
float64 longitude
float64 altitude
float64[9] position_covariance
uint8 position_covariance_type

 * Example data:
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
*/

using Newtonsoft.Json;

namespace RosSharp.RosBridgeClient.Messages.Sensor
{
    public class NavSatFix : Message
    {
        [JsonIgnore]
        public const string RosMessageName = "sensor_msgs/NavSatFix";
        public Standard.Header header;
        public double latitude;
        public double longitude;
        public double altitude;
        public NavSatFix()
        {
            header = new Standard.Header();
            latitude = 0;
            longitude = 0;
            altitude = 0;
        }
    }
}
