const fs = require('fs');
const WebSocket = require('ws');
const path = require('path');
const process = require('process');

const {XVIZMetadataBuilder, XVIZBuilder, encodeBinaryXVIZ} = require("@xviz/builder");

const xvizMetaBuider = new XVIZMetadataBuilder();
xvizMetaBuider.stream('/vehicle-pose')
const metadata = xvizMetaBuider.getMetadata();

// Global counter to help debug
let _connectionCounter = 1;

function connectionId() {
  const id = _connectionCounter;
  _connectionCounter++;

  return id;
}

module.exports = {
    startListenOn: function (port) {
        console.log(`xviz server starting on ws://localhost:${port}`);
        // TODO - server logic
    },
    close: function(){
        console.log("xviz server shutting down");
    },
    updateLocation: function(lat, lng, alt, time) {
        console.log("new msg (time, lat, lng): ", time, lat, lng);
        // TODO - notify each active sesion to a xviz client
    }
};

/* 
The following is a copy of Uber's xviz server example, just for reference

// Connection State
class ConnectionContext {
  constructor(settings, metadata, allFrameData, loadFrameData) {
    this.metadata = metadata;

    this._loadFrameData = loadFrameData;

    this.connectionId = connectionId();

    // Remove metadata so we only deal with data frames

    // Cache json version of frames for faster re-writes
    // during looping.
    this.json_frames = [];
    this.is_frame_binary = [];
    this.frame_update_times = [];

    Object.assign(this, allFrameData);

    this.frame_time_advance = null;

    this.settings = settings;
    this.t_start_time = null;

    // Only send metadata once
    this.sentMetadata = false;

    this.onConnection.bind(this);
    this.onClose.bind(this);
    this.onMessage.bind(this);
    this.sendFrame.bind(this);
  }

  onConnection(ws) {
    this.log('> Connection from Client.');

    this.t_start_time = process.hrtime();
    this.ws = ws;

    // Respond to control messages from the browser
    ws.on('message', msg => this.onMessage(msg));

    // On connection send metadata
    this.sendMetadataResp();

    // 'live' mode will not get the 'xviz/transform_log' message
    // so start sending immediately
    this.sendPlayResp({});
  }

  onClose(event) {
    this.log(`> Connection Closed. Code: ${event.code} Reason: ${event.reason}`);
  }

  onMessage(message) {
    const msg = JSON.parse(message);

    this.log(`> Message ${msg.type} from Client`);

    switch (msg.type) {
      case 'xviz/start':
        // TODO: support choosing log here
        break;
      case 'xviz/transform_log': {
        this.log(`| start: ${msg.data.start_timestamp} end: ${msg.data.end_timestamp}`);
        this.transformId = msg.data.id;
        this.sendPlayResp(msg.data);
        break;
      }
      default:
        this.log(`|  Unknown message ${msg}`);
    }
  }

  

  sendMetadataResp(clientMessage) {
    if (!this.sentMetadata) {
      this.sentMetadata = true;
      this.sendMetadata();
    }
  }

  sendPlayResp(clientMessage) {
    const frameRequest = this.setupFrameRequest(clientMessage);
    console.log(frameRequest);
    if (frameRequest) {
      if (this.inflight) {
        this.replaceFrameRequest = frameRequest;
      } else {
        this.inflight = true;
        this.sendNextFrame(frameRequest);
      }
    }
  }

  sendMetadata() {
    let frame = this._loadFrameData(this.metadata);
    const isBuffer = frame instanceof Buffer;

    const frame_send_time = process.hrtime();

    if (this.settings.live) {
      // When in live mode make sure there are no times
      frame = this.removeMetadataTimestamps(frame);
    } else {
      // When in normal mode add timestamps if needed
      frame = this.addMetadataTimestamps(frame);
    }

    // Send data
    if (isBuffer) {
      this.ws.send(frame);
    } else {
      this.ws.send(frame, {compress: true});
    }

    this.logMsgSent(frame_send_time, 1, 1, 'metadata');
  }

  // Setup interval for sending frame data
  sendNextFrame(frameRequest) {
    if (this.replaceFrameRequest) {
      frameRequest = this.replaceFrameRequest;
      this.log(`| Replacing inflight request.`);
      // TODO(jlsee): this should be a real message type, that
      // contains the request which as canceled
      this.sendEnveloped('cancelled', {});
      this.replaceFrameRequest = null;
    }

    frameRequest.sendInterval = setTimeout(
      () => this.sendFrame(frameRequest),
      this.settings.send_interval
    );
  }

  // Send an individual frame of data
  sendFrame(frameRequest) {
    const ii = frameRequest.index;
    const last_index = frameRequest.end;

    const {skip_images} = this.settings;
    const frame_send_time = process.hrtime();

    // get frame info
    const frame_index = getFrameIndex(ii, this.frames.length);
    const frame = this._loadFrameData(this.frames[frame_index]);

    // TODO images are not supported here, but glb data is
    // old image had a binary header
    const isBuffer = frame instanceof Buffer;
    let skipSending = isBuffer && skip_images;

    // End case
    if (ii >= last_index) {
      if (this.settings.loop) {
        // In loop mode determine how much data we just play then update
        // our offset.
        frameRequest.index = this.loopPlayback(last_index, frameRequest.start) - 1;

        // We are past the limit don't send this frame
        skipSending = true;
      } else {
        // When last_index reached send 'transform_log_done' message
        if (!this.settings.live) {
          this.sendEnveloped('transform_log_done', {id: this.transformId}, {}, () => {
            this.logMsgSent(frame_send_time, -1, frame_index, 'json');
          });
        }

        this.inflight = false;

        return;
      }
    }

    // Advance frame
    frameRequest.index += 1;

    // NOTE: currently if we are skipping images we don't find the
    //       next non-image frame, we just let it cycle so sending can be
    //       delayed as a result. (ie. won't always send data at specified delay).
    //
    // Are we sending this frame?
    if (skipSending) {
      this.sendNextFrame(frameRequest);
    } else {
      const next_ts = this.frames_timing[frame_index];

      const updatedFrame = this.adjustFrameTime(frame, frame_index);

      // Send data
      if (isBuffer) {
        this.ws.send(updatedFrame, {}, () => {
          this.logMsgSent(frame_send_time, ii, frame_index, 'binary', next_ts);
          this.sendNextFrame(frameRequest);
        });
      } else {
        this.ws.send(updatedFrame, {compress: true}, () => {
          this.logMsgSent(frame_send_time, ii, frame_index, 'json', next_ts);
          this.sendNextFrame(frameRequest);
        });
      }
    }
  }

  loopPlayback(frame_index, start_index) {
    const duration = this.frames_timing[frame_index - 1] - this.frames_timing[start_index];

    if (this.frame_time_advance === null) {
      this.frame_time_advance = 0;
    }

    this.frame_time_advance += duration;

    return start_index;
  }

  // Take a frame at time t, and make it appears as it occured
  // frame_time_advance in the future.
  adjustFrameTime(frame, frame_index) {
    if (this.frame_time_advance) {
      // Determine if binary and unpack
      const jsonFrame = this.json_frames[frame_index];

      // Update the snapshot times
      for (let i = 0; i < jsonFrame.data.updates.length; ++i) {
        const update = jsonFrame.data.updates[i];
        update.timestamp += this.frame_time_advance;

        if (update.time_series) {
          for (let y = 0; y < update.time_series.length; ++y) {
            update.time_series[y].timestamp += this.frame_time_advance;
          }
        }
      }

      // Repack based on binary-ness
      if (this.is_frame_binary[frame_index]) {
        frame = encodeBinaryXVIZ(jsonFrame, {});
      } else {
        frame = JSON.stringify(jsonFrame);
      }
    }

    return frame;
  }

  removeMetadataTimestamps(frame) {
    const result = unpackFrame(frame);

    const log_info = result.json.data.log_info;

    if (log_info) {
      delete log_info.start_time;
      delete log_info.end_time;
    }

    return packFrame(result);
  }

  addMetadataTimestamps(frame, start_time, end_time) {
    const result = unpackFrame(frame);

    let log_info = result.json.data.log_info;

    if (!log_info) {
      console.log('-- Warning: no metadata log_info adding with start & end times');
      log_info = {
        start_time: this.frames_timing[0],
        end_time: this.frames_timing[this.frames_timing.length - 1]
      };
      result.json.data.log_info = log_info;
    }

    return packFrame(result);
  }

  sendEnveloped(type, msg, options, callback) {
    const envelope = {
      type: `xviz/${type}`,
      data: msg
    };
    const data = JSON.stringify(envelope);
    this.ws.send(data, options, callback);
  }

  log(msg) {
    const prefix = `[id:${this.connectionId}]`;
    console.log(`${prefix} ${msg}`);
  }

  logMsgSent(send_time, index, real_index, tag, ts = 0) {
    const t_from_start_ms = deltaTimeMs(this.t_start_time);
    const t_msg_send_time_ms = deltaTimeMs(send_time);
    this.log(
      ` < Frame(${tag}) ts:${ts} ${index}:${real_index} in self: ${t_msg_send_time_ms}ms start: ${t_from_start_ms}ms`
    );
  }
}

// Comms handling
function setupWebSocketHandling(wss, settings, metadata, allFrameData, loadFrameData) {
  // Setups initial connection state
  wss.on('connection', ws => {
    const context = new ConnectionContext(settings, metadata, allFrameData, loadFrameData);
    context.onConnection(ws);
  });
}

function unpackFrames(frames, loadFrameData) {
  console.log(`Unpacking ${frames.length} frames into memory`);
  console.log('WARNING: for long logs you might not have enough memory');

  const json_frames = [];
  const is_frame_binary = [];

  for (let i = 0; i < frames.length; ++i) {
    const frame = loadFrameData(frames[i]);

    const result = unpackFrame(frame, {shouldThrow: false});

    json_frames.push(result.json);
    is_frame_binary.push(result.isBinary);
  }

  console.log('All data loaded, ready.');

  return {
    json_frames,
    is_frame_binary
  };
}

function unpackFrame(frame, options = {}) {
  const shouldThrow = options.shouldThrow || true;

  let json;
  let isBinary = false;

  if (frame instanceof Buffer) {
    json = parseBinaryXVIZ(
      frame.buffer.slice(frame.byteOffset, frame.byteOffset + frame.byteLength)
    );
    isBinary = true;
  } else if (typeof frame === 'string') {
    json = JSON.parse(frame);
  } else if (shouldThrow) {
    throw new Error('Unknown frame type');
  }

  return {json, isBinary};
}

function packFrame({json, isBinary}) {
  let frame;
  if (isBinary) {
    frame = encodeBinaryXVIZ(json, {});
  } else {
    frame = JSON.stringify(json);
  }
  return frame;
}

*/


