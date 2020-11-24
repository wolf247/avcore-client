## AVCore npm package installation

Just run `npm i avcore`

## Share client files

Add to your nodejs backend
```typescript
import * as express from 'express';
const app = express();
app.use('/avcore-client', express.static(join(__dirname, 'node_modules/avcore/client/dist')));
app.use('/avcore', express.static(join(__dirname, 'node_modules/avcore/dist')));
```
Use this script tags in your html pages
```html
<script type="text/javascript" src="/avcore-client/index.js"></script>
<script type="text/javascript" src="/avcore/index.js"></script>
```
## Import from avcore package

In JavaScript:
```javascript
const {CloudApi,API_OPERATION} = avcore;
```
In TypeScript
```typescript
import { CloudApi,API_OPERATION} from 'avcore';
```
This package has interfaces, enums, constants and all classes that can be used on both client and server parts

## Import from avcore-client package
In JavaScript:
```javascript
const {CloudClient,Utils} = avcoreClient;
```
In TypeScript
```typescript
import {CloudClient,Utils} from 'avcore/client/dist';
```
This package has frontend-only classes


## Create AVCore cloud client and api instance
```javascript
const clientToken = "<YOUR-CLIENT-TOKEN>";
```
Get your client token from admin dashboard
```javascript
const cloudClient = new CloudClient('https://admin.avcore.io',clientToken);
```
`CloudClient` is for frontend only and working with *MediaStream*s
```javascript
const cloudApi = new CloudApi('https://admin.avcore.io',clientToken);
```
`CloudApi` can be used from both backend and frontend

## Publishing stream
```javascript
(async function () {
    const {CloudClient,Utils} = avcoreClient;
    const {API_OPERATION} = avcore;
    const clientToken = "<YOUR-CLIENT-TOKEN>";
    const cloudClient = new CloudClient('https://admin.avcore.io',clientToken);
    const stream=Math.random().toString(36).substr(2) //some random string;
    const kinds=['audio','video'] //can be also ['audio'] or ['video'] only;
    const isScreenShare=false; //set true for screen share stream
    const simulcast=!isScreenShare; //google chrome has many issues for screen share simulcast
    const mediaStream=await Utils.getUserMedia({
        video:kinds.includes('video'),
        audio:kinds.includes('audio')
    },isScreenShare); //you can receive any stream from navigator.mediaDevices directly w/o our utils
    const client = await cloudClient.create(API_OPERATION.PUBLISH,stream,{
        kinds,
        simulcast
    });
    client.on('bitRate',({bitRate,kind})=>{
        console.log(`current publish bitrate for ${kind} track is ${bitRate}`)
    }).on('connectionstatechange',({state})=>{
          console.log(`current transport connection state is ${state}`)
    }).publish(mediaStream);
})()
```
## Subscribe stream
```javascript
(async function () {
    const {CloudClient,Utils}=avcoreClient;
    const {API_OPERATION}=avcore;
    const clientToken = "<YOUR-CLIENT-TOKEN>";
    const cloudClient = new CloudClient('https://admin.avcore.io',clientToken);
    const stream='<stream-from-publish-example>';
    const kinds=['audio','video'] //can be also ['audio'] or ['video'] only;
    const client = await cloudClient.create(API_OPERATION.SUBSCRIBE,stream,{kinds});
    client.on('bitRate',({bitRate,kind})=>{
        console.log(`current subscribe bitrate for ${kind} track is ${bitRate}`)
    }).on('connectionstatechange',({state})=>{
          console.log(`current transport connection state is ${state}`)
    })
    const mediaStream= await client.subscribe();
    const playbackVideo = document.getElementById("playback-video"); //your <video>-element
    playbackVideo.srcObject=mediaStream;
    if(Utils.isSafari){
        //Safari doesn't support dynamic adding tracks to MediaStream
        const onStreamChange=()=>{
            playbackVideo.srcObject=new MediaStream(mediaStream.getTracks());
            startPlaying();
        };
        client.on('addtrack',onStreamChange).on('removetrack',onStreamChange);
    }
    else if(Utils.isFirefox){
        //Firefox MediaStream pauses when changed
        playbackVideo.addEventListener('pause',startPlaying)
    }
    startPlaying();
})()
```
To play correctly your video with iOS Safari you need to add this `startPlaying` function and unmute logic 
```javascript
const unmuteButton=document.getElementById("unmute-playback-video"); //your unmute <button>
function startPlaying() {
    console.log('trying to play');
    let playPromise = playbackVideo.play();
    if (playPromise !== undefined) {
        playPromise.then(_ => {
        }).catch(_ => {
            playbackVideo.muted = true;
            unmuteButton.disabled = false;
            playbackVideo.play().then(() => {}, (_) => {});
        });
    }
}
unmuteButton.addEventListener('click', function (event) {
        event.preventDefault();
        playbackVideo.muted=false;
        playbackVideo.volume=1;
        unmuteButton.disabled=true;
});
playbackVideo.addEventListener('volumechange', function (_) {
    unmuteButton.disabled=!playbackVideo.muted && playbackVideo.volume>0.01;
});
```
## Error handling
You can use `ERROR` enum from `avcore` package
```javascript
const {ERROR}=avcore;
try {
    ///your code
}
catch (e) {
    if(e && ERROR[e.errorId]){
        console.log(`AVCore returned ${ERROR[e.errorId]} error`)
    }
    else {
         console.log(`Not AVCore error: ${e}`)
    }
}
```

## Stream recording
```javascript
const api = await cloudApi.create(API_OPERATION.RECORDING);
await api.startRecording({stream,kinds});
```
It will create separate files for audio and video every time stream will be started and stopped until your call
```javascript
await api.stopRecording({stream,kinds});
```
For single-file recording you can use mixer with single stream on it.

## Manage your recordings
Get list of all streams that was recorded
```javascript
const api = await cloudApi.create(API_OPERATION.RECORDING);
const {list}=await api.recordedStreams();
/*
  {
     "list":[
        {
           "stream":"5b8da1e7-c1b0-4753-8d3a-8cb86cff7399",
           "lastModified":1603872075759
        },
        {
           "stream":"kdufy4e842",
           "lastModified":1603872012712
        }
     ]
  }  
*/
```
Get list of all recordings by stream
```javascript
const {list}=await api.streamRecordings({stream:'kdufy4e842'});
/*
{
   "list":[
      {
         "key":"5f8d55bab0ca45e9ff24f636/kdufy4e842_video_1603872012681.mp4",
         "lastModified":1603872012712,
         "url":"<signed url>"
      },
      {
         "key":"5f8d55bab0ca45e9ff24f636/kdufy4e842_audio_1603872002685.webm",
         "lastModified":1603872002709,
         "url":"<signed url>"
      }
   ]
}
*/
```
Remove single recording
```javascript
await api.deleteRecording({filePath:'5f8d55bab0ca45e9ff24f636/kdufy4e842_video_1603872012681.mp4'});
```
Remove all recordings by stream
```javascript
await api.deleteStreamRecordings({stream:'kdufy4e842'});
```

## Stream from a file and live re-streaming (rtmp,rtsp,http)
```javascript
const url='<url to your file or stream>';
const isSimulcast=false;//set true for simulcast
const simulcast = isSimulcast?[
    {height: 240}, //height 240, width by ratio
    {} //full size
]:undefined;
const api = await cloudApi.create(API_OPERATION.STREAMING);
await api.liveStreaming({kinds, stream, url, simulcast});
```
You can play this stream using **Subscribe stream** example. You can stop it by `stopFileStreaming`
```javascript
await api.stopFileStreaming({stream});
```
Optionally check your file/url having audio/video
```javascript
const {kinds} = await api.kindsByFile({filePath: url});
console.log(`your file/url has: ${kinds.join(', ')}`);
```

## HLS re-streaming
```javascript
const api = await cloudApi.create(API_OPERATION.STREAMING);
const {pipeId} = await api.liveToHls({
    kinds, 
    stream, 
    url, 
    formats:[//two qualities
        {videoBitrate:4000},//full size and fixed bitrate
        {videoBitrate:2000, height:720} //height 720, width by ratio, fixed bitrate
    ]
});
const hlsUrl=api.hlsUrl(pipeId);
console.log(`use this HLS-url: ${hlsUrl}`);
```
Can be stopped the same way 
```javascript
await api.stopFileStreaming({stream});
```

## Using stream mixer
Create stream mixer
```javascript
const api = await cloudApi.create(API_OPERATION.MIXER);
const {mixerId}=await api.mixerStart({width:1280, height:720});
console.log(`your mixer id is ${mixerId}`);
```
Add audios to mixer
```javascript
api.mixerAdd({mixerId,stream:'<your-first-stream-id>',kind:'audio'});
api.mixerAdd({mixerId,stream:'<your-second-stream-id>',kind:'audio'});
```
Add videos to mixer
```javascript
api.mixerAdd({mixerId,stream:'<some-first-stream-id>',kind:'video',options:{
    x:0,y:0,width:640,height:360,z:0,renderType:MIXER_RENDER_TYPE.CROP //left top quarter cropped to size
}});
api.mixerAdd({mixerId,stream:'<some-second-stream-id>',kind:'video',options:{
    x:640,y:0,width:640,height:360,z:0,renderType:MIXER_RENDER_TYPE.CROP //right top quarter cropped to size
}});
```
Add custom file/stream (rtmp,rtsp,http) to mixer (you can use `kindsByFile` example to check your source)
 ```javascript
api.mixerAddFile({
    mixerId,
    stream:'some-third-stream-id',
    kinds:['audio','video'],
    options:{
        x:0,y:360,width:1280,height:360,z:0,renderType:MIXER_RENDER_TYPE.PAD //bottom part with padding
    },
    filePath:'<url to your file or stream>',
    removeOnExit:true, //set false to keep last frame until removed from mixer
    loop:false//set true to loop your stream
})
```
Update video in mixer
```javascript
api.mixerUpdate({mixerId,stream:'<some-first-stream-id>',options:{
    x:640,y:360,width:640,height:360,z:0,renderType:MIXER_RENDER_TYPE.CROP //move to bottom right corner
}});
```
Remove stream from mixer
```javascript
api.mixerRemove({mixerId,stream:'<your-second-stream-id>',kind:'video'});
api.mixerRemove({mixerId,stream:'<your-second-stream-id>',kind:'audio'});
```
Close mixer and all its outputs
```javascript
await api.mixerClose({mixerId});
```
Push mixer output to WebRTC-stream (you can watch it like in **Subscribe stream** example)
```javascript
const {pipeId}=await api.mixerPipeStart({mixerId,type:MIXER_PIPE_TYPE.LIVE,stream:'<some-mixed-stream-id>'});
```
Can be stopped with `mixerPipeStop`
```javascript
await api.mixerPipeStop({mixerId,pipeId});
```
Push mixer output to your RTMP-server (can be also stopped with `mixerPipeStop`by `pipeId`). Join your RTMP-app url with your stream key as single `url`
```javascript
const {pipeId}=await api.mixerPipeStart({mixerId,type:MIXER_PIPE_TYPE.RTMP,url:'rtmp://example.com/live/some-stream-key'});
```
Push mixer output to HLS (can be also stopped with `mixerPipeStop`by `pipeId`)
```javascript
const {pipeId}=await api.mixerPipeStart({
    mixerId,
    kinds,
    type:MIXER_PIPE_TYPE.HLS,
    formats:[ //two qualities
        {videoBitrate:4000},//full size and fixed bitrate
        {videoBitrate:2000, height:720} //height 720, width by ratio, fixed bitrate
    ]
});
const hlsUrl=api.hlsUrl(pipeId);
console.log(`use this HLS-url: ${hlsUrl}`);
```
Record mixer output to single file (you can stop recording with `mixerPipeStop` by `pipeId`).
```javascript
const {pipeId}=await api.mixerPipeStart({mixerId,type:MIXER_PIPE_TYPE.RECORDING});
```
Find your recording by `pipeId`
```javascript
const api = await cloudApi.create(API_OPERATION.RECORDING);
const {list} = await api.streamRecordings({stream:pipeId});
/*
{
   "list":[
      {
         "key":"623d31e8-b8cf-4a23-8fb9-bfb3aeef8c33_mixer_1602773080145.mkv",
         "lastModified":1602773080258,
         "url":"<signed url>"
      }
   ]
}
*/
```