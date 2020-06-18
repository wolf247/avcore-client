import {MediaSoupDefaultSettings} from '../ms/interfaces';
import {MediaKind, RtpCodecParameters} from 'mediasoup/lib/RtpParameters';
const codecParameters:{[x in MediaKind] : RtpCodecParameters}={
    audio:{
        mimeType: 'audio/OPUS',
        clockRate: 48000,
        channels: 2,
        payloadType  : 101,
        rtcpFeedback : [ ],
        parameters   : { 'sprop-stereo': 1 }
    },
    video:{
        mimeType: 'video/H264',
        clockRate: 90000,
        payloadType  : 102,
        rtcpFeedback : [ ],
        parameters :
            {
                'packetization-mode' : 1,
                'profile-level-id' : '42e01f',
                //‘level-asymmetry-allowed’ : 0,
                'x-google-start-bitrate' : 1000
            }
    }
};
const mediasoup:MediaSoupDefaultSettings={
    // Worker settings
    worker: {
        logLevel: 'warn',
        logTags: [
            'info',
            'ice',
            'dtls',
            'rtp',
            'srtp',
            'rtcp'/*,
                'rtx',
                'bwe',
                'score',
                'simulcast',
                'svc'*/
        ]
    },
    // Router settings
    router: {
        mediaCodecs:
            [
                {
                    kind: 'audio',
                    mimeType: codecParameters.audio.mimeType,
                    clockRate: codecParameters.audio.clockRate,
                    channels: codecParameters.audio.channels,
                    preferredPayloadType: codecParameters.audio.payloadType,

                },
                {
                    kind: 'video',
                    mimeType: codecParameters.video.mimeType,
                    clockRate: codecParameters.video.clockRate,
                    preferredPayloadType: codecParameters.video.payloadType,
                    parameters: codecParameters.video.parameters
                },
            ]
    },
    // WebRtcTransport settings
    webRtcTransport: {
        listenIps: [
            {
                ip: "62.210.189.244"
            }
        ],
        maxIncomingBitrate: 1500000,
        initialAvailableOutgoingBitrate: 1000000,
    },
    pipeTransport: {
        listenIp: "62.210.189.244"
    },
    codecParameters,
    "recording": {
        "path": "recordings",
        "extension": "mp4"
    },
    "streaming":{
        "path":"streaming"
    },
    "sdp":{
        "header":`v=0
o=- 0 0 IN IP4 127.0.0.1
s=-
c=IN IP4 __IP__
t=0 0`,
        "audio":`
m=audio __PORT__ RTP/AVP ${codecParameters.audio.payloadType}
a=rtcp-mux
a=rtpmap:${codecParameters.audio.payloadType} ${codecParameters.audio.mimeType.split('/')[1]}/${codecParameters.audio.clockRate}/${codecParameters.audio.channels}
a=fmtp:${codecParameters.audio.payloadType} minptime=10`,
        "video":`
m=video __PORT__ RTP/AVP ${codecParameters.video.payloadType}
a=rtcp-mux
a=rtpmap:${codecParameters.video.payloadType} ${codecParameters.video.mimeType.split('/')[1]}/${codecParameters.video.clockRate}
a=fmtp:125 level-asymmetry-allowed=1;packetization-mode=1;profile-level-id=42e01f`
    },
    "ffprobe": {
        "path": "ffprobe",
        "options": {
            "streams":['-v', 'quiet', '-print_format', 'json', '-show_streams']
        }
    },
    "ffmpeg":{
        "path":"ffmpeg",
        "encoding":{
            "audio": ['-map','0:a:0','-c:a','libopus','-ac','2','-ar','48000'],
            "video": ['-map','0:v:0','-c:v','libx264','-profile:v', 'baseline', '-level', '3.1', '-preset:v', 'superfast']
        }
    },
    "timeout":{
        "stats": 2000,
        "client": 1000,
        "consumer": 5000,
        "transport": 30000,
        "worker": 10000
    },
    "iceServers": [
        {
            "urls": ["turn:18.196.113.204:3478"],
            "username": "testUser",
            "credential": "testPassword"
        },
        {
            "urls": ["stun:18.196.113.204:3478"],
            "username": "testUser",
            "credential": "testPassword"
        }
    ],
    /*"simulcast":{
        codecOptions:{
            videoGoogleStartBitrate : 1000
        },
        encodings:[
            { maxBitrate: 300000, scaleResolutionDownBy: 2 },
            { maxBitrate: 1500000, scaleResolutionDownBy: 1 }
        ]
    }*/
};
const ssl:{key?:string,cert?:string,enabled:boolean}={enabled:false};
export const conf = {
    "scalability":{
        "numWorkers":3,
        "rtc":{
            "startingPort":10000,
            "numPorts": 2048
        }
    },
    ssl,
    "restPort":7776,
    "restIp":'127.0.0.1',
    "auth":{
        "secret": 'LH_Secret1_',
        "algorithm": "HS512"
    },
    mediasoup
};
