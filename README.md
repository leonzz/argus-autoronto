# argus-autoronto
The GUI project for [aUToronto](https://www.autodrive.utoronto.ca/) self driving car, and the course project of team RED for AER1514 Mobile Robotics Winter 2019.

## Team RED
Names in alphabetical order:
- [David Quispe](mailto:david.quispe@mail.utoronto.ca) 
- [John Pineros](mailto:john.pineros@mail.utoronto.ca)
- [Leon Ziyang Zhang](mailto:ziyang.zhang@mail.utoronto.ca)
- [Reid Stevens](mailto:reid.stevens@mail.utoronto.ca)

## System Diagram

Note: we've abandoned a Unity based approach in favor of the following new approach:

![System Overview](argus-overview.svg)

Diagram created with [Draw.io](https://www.draw.io/)

## Components:

- [`rosbridge-xviz-connector`](rosbridge-xviz-connector): A data proxy server that read from rosbridge-server and serves data in [XVIZ](https://github.com/uber/xviz) format, which is a opensource protocol from Uber to stream/visualize autonomy data.

- GUI: A web UI based on Uber's [streetscape.gl](https://github.com/uber/streetscape.gl) which is specialized to visualize data in XVIZ format. Right now we are using the demo example from [streetscape.gl](https://github.com/uber/streetscape.gl/tree/master/examples/get-started) with some minor changes.

- Map Tile Server: A map tile server that reads local OpenStreemMap data files and serve map images to the GUI.

## Build and Run

Note: If running from a VM, make sure to enable 3D acceleration for it's graphics setting.

1. Follow the steps (1, 2, and 4) in [rosbridge-xviz-connector](rosbridge-xviz-connector) to start the neccessary services.

2. Start the GUI

    ```
    cd gui
    # please run yarn install before the next command to download dependencies
    yarn start-live
    ```

    A browser window will automatically open and connect to the server from step 1.

3. In developement/simulation mode, play the rosbag to start piping in data, e.g.

    ```
    rosbag play /mnt/hgfs/argus-autoronto/project-data/_2019-01-18-15-19-31_public_roads.ba
    ```

4. After starting the rosbag, if the UI is not updated, refresh the browser window. Since some rosbag recordings are very short, be sensitive to the timing of refresh and play.