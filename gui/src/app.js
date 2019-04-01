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

import {XVIZLiveLoader} from 'streetscape.gl';
import {setXVIZConfig} from '@xviz/parser';
import {
  LogViewer,
  PlaybackControl,
  MeterWidget,
  TrafficLightWidget,
  TurnSignalWidget,
  XVIZPanel,
  VIEW_MODE
} from 'streetscape.gl';
import {Form} from '@streetscape.gl/monochrome';

import {XVIZ_CONFIG, APP_SETTINGS, MAPBOX_TOKEN, MAP_STYLE, XVIZ_STYLE, CAR} from './constants';

setXVIZConfig(XVIZ_CONFIG);

const exampleLog = new XVIZLiveLoader({
  logGuid: 'mock',
  bufferLength: 4,
  serverConfig: {
    defaultLogLength: 5,
    serverUrl: 'ws://localhost:8081'
  },
  worker: true,
  maxConcurrency: 2
});

class Example extends PureComponent {
  state = {
    log: exampleLog.on('error', console.error),
    settings: {
      viewMode: 'PERSPECTIVE'
    }
  };

  componentDidMount() {
    this.state.log.connect();
  }

  _onSettingsChange = changedSettings => {
    this.setState({
      settings: {...this.state.settings, ...changedSettings}
    });
  };

  render() {
    const {log, settings} = this.state;

    return (
      <div id="container">
        <div id="control-panel">
          <XVIZPanel log={log} name="Camera" />
          <hr />
          <Form
            data={APP_SETTINGS}
            values={this.state.settings}
            onChange={this._onSettingsChange}
          />
        </div>
        <div id="log-panel">
          <div id="map-view">
            <LogViewer
              log={log}
              mapboxApiAccessToken={MAPBOX_TOKEN}
              mapStyle={MAP_STYLE}
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
