# rosbridge-xviz-connector

This is a proxy server that:
- read data from `rosbridge_server` via websocket using the `roslib` package;
- convert ROS message format into xviz;
- expose a `xviz` server via websocket using Uber's `@xviz` pakcage.

## Dependencies

- both `rosbridge_server` and `roslib` are part of [rosbridge_suite](http://wiki.ros.org/rosbridge_suite) that allows interaction with ROS topics via websocket (which is a common streaming protocol for web services).

- [XVIZ](https://avs.auto/#/xviz/overview/introduction) is a protocal (on top of websocket) for real time transfer and visualization of autonomy data opensourced by Uber.

## Steps to run the server

You will need ROS installed in your system before doing the following steps. If you have not done so, refer to [ROS documentation](http://wiki.ros.org/ROS/Tutorials).

1. If you don't have rosbridge server installed (i.e. `rospack find rosbridge_server` returns nothing), install with:

    ```
    sudo apt install ros-<rosdistro>-rosbridge-suite
    ```

2. Start rosbridge server with:

    ```
    roslaunch rosbridge_server rosbridge_websocket.launch
    ```

    By default it listens on port `9090` for websocket connections. It also registers a node called `rosbridge_websocket` which you can verify by `rosnode list`.

3. `Optional`: Testing rosbridge connection with a browser and Autoronto rosbag:

    ```
    # run the Autoronto rosbag:
    rosbag play _2019-01-23-13-28-36_imu_baselink-007.bag
    ```

    Then open `websocket-client-test.html` in a browser. You should be able to see data coming from the topic `/navsat/fix`.

4. Start `rosbridge-xviz-connector` by:

    ```
    ## you should have done yarn install to get dependencies before running
    yarn start ## or node ./index.js
    ```


## Reference Frames in XVIZ Protocol

The official XVIZ documentation has no clear description of their reference frames. However through playing around with test data, we discovered that XVIZ use a right handed reference frame with fixed orientation:

- Origin of the reference frame is given by a `MapOrigin` defined by `(latitude, longitude, altitude)`.

- Y-axis always point to North.

- X-axis always point to East.

- Z-axis always point up vertically.