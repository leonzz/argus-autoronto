// This file is modified based on the get-started example 
// from github.com/uber/streetscape.gl
// The following is the original license statement:
//
// Copyright (c) 2019 Uber Technologies, Inc.
//
// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the "Software"), to deal
// in the Software without restriction, including without limitation the rights
// to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
// copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:
//
// The above copyright notice and this permission notice shall be included in
// all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
// OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
// THE SOFTWARE.

/* global document, console */
/* eslint-disable no-console, no-unused-vars, no-undef */
import React, {PureComponent} from 'react';
import {render} from 'react-dom';

import {setXVIZConfig} from '@xviz/parser';
import {XVIZLiveLoader,LogViewer,VIEW_MODE} from 'streetscape.gl';
import {Form, Button} from '@streetscape.gl/monochrome';

import ROSLIB from 'roslib';
import {XVIZ_CONFIG, APP_SETTINGS, CONFIG_SETTINGS, XVIZ_STYLE, CAR} from './constants';

setXVIZConfig(XVIZ_CONFIG);

let params = (new URL(document.location)).searchParams;
let server = params.get('server');
let mapboxToken = params.get('maptoken');
let mapStyleRef = params.get('mapstyle');
if (!server) {
  server = "localhost";
}
if (!mapboxToken) {
  mapboxToken = "";
}
if (!mapStyleRef) {
  mapStyleRef = 'mapbox://styles/uberdata/cjfxhlikmaj1b2soyzevnywgs';
}

// get camera image directly from rosbridge instead of xviz
// for better performance
const rosBridgeClient = new ROSLIB.Ros({
  url : 'ws://'+server+':9090'
});
const roslistener = new ROSLIB.Topic({
  ros : rosBridgeClient,
  name : '/blackfly/image_color/compressed'
});
roslistener.subscribe(function(message) {
  document.getElementById("camera-image").src = "data:image/jpg;base64,"+message.data;
});

const exampleLog = new XVIZLiveLoader({
  logGuid: 'mock',
  bufferLength: 4,
  serverConfig: {
    defaultLogLength: 5,
    serverUrl: 'ws://'+server+':8081'
  },
  worker: true,
  maxConcurrency: 2
});

class Example extends PureComponent {
  state = {
    log: exampleLog.on('error', console.error),
    settings: {
      viewMode: 'PERSPECTIVE'
    },
    serverURL: server,
    mapToken: mapboxToken,
    mapStyle: mapStyleRef
  };

  componentDidMount() {
    this.state.log.connect();
  }

  _onSettingsChange = changedSettings => {
    this.setState({
      settings: {...this.state.settings, ...changedSettings}
    });
  };

  _onConfigChange = e => {
    this.setState(e);
  };

  _onButtonClick = ()=>{
    console.log("button click");
    this.state.log.close();
    let currentPage = window.location.href.split("?")[0];
    console.log(currentPage);
    let newPage = currentPage + "?server=" + this.state.serverURL;
    if ( this.state.mapToken ) {
      newPage = newPage + "&maptoken=" + this.state.mapToken;
    }
    if ( this.state.mapStyle ) {
      newPage = newPage + "&mapstyle=" + this.state.mapStyle;
    }
    window.location.replace(newPage);
  }

  render() {
    const {log, settings, mapStyle, mapToken} = this.state;

    return (
      <div id="container">
        <div id="control-panel">
          <img src="" id="camera-image" width="100%" />
          <hr />
          <Form
            data={APP_SETTINGS}
            values={this.state.settings}
            onChange={this._onSettingsChange}
          />
          <hr />
          <Form
            data={CONFIG_SETTINGS}
            values={this.state}
            onChange={this._onConfigChange}
          />
          <hr/>
          <Button onClick={this._onButtonClick}>
          Re-Connect
          </Button>
        </div>
        <div id="log-panel">
          <div id="map-view">
            <LogViewer
              log={log}
              mapboxApiAccessToken={mapToken}
              mapStyle={mapStyle}
              car={CAR}
              xvizStyles={XVIZ_STYLE}
              viewMode={VIEW_MODE[settings.viewMode]}
            />
          </div>
        </div>
      </div>
    );
  }
}

render(<Example />, document.getElementById('app'));
