# rosbridge-server

We use a third-party package called [rosbridge_server](http://wiki.ros.org/rosbridge_server) to allow interaction with ROS topics via websocket (which is a common streaming protocol for web services).

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

3. Testing with a browser and Autoronto rosbag:

    ```
    # run the Autoronto rosbag:
    rosbag play _2019-01-23-13-28-36_imu_baselink-007.bag
    ```

    Then open `websocket-client-test.html` in a browser. You should be able to see data coming from the topic `/navsat/fix`.
