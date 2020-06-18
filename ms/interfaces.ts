import {WorkerSettings} from 'mediasoup/lib/Worker';
import {RouterOptions} from 'mediasoup/lib/Router';
import {ConsumerType} from 'mediasoup/lib/Consumer';

type Omit<T, K extends keyof T> = Pick<T, Exclude<keyof T, K>>

import {
    MediaKind,
    RtpCapabilities,
    RtpCodecParameters,
    RtpParameters
} from 'mediasoup/lib/RtpParameters';
import {RtpCapabilities as ClientRtpCapabilities} from 'mediasoup-client/lib/RtpParameters';
import {
    ConsumeRequest as ClientConsumeRequest,
    ConsumeResponse as ClientConsumeResponse,
    IceSever, PipeTransportData, Simulcast
} from '../front/src/client-interfaces';
import {TransportOptions} from 'mediasoup-client/lib/Transport';
import {TransportListenIp} from 'mediasoup/lib/Transport';

export interface MediaSoupSettings {
    worker:WorkerSettings
    router:RouterOptions
    webRtcTransport: {
        listenIps:TransportListenIp[]|string[],
        maxIncomingBitrate:number
        initialAvailableOutgoingBitrate:number
    },
    pipeTransport: {
        listenIp:TransportListenIp|string,
    },
    codecParameters:{[x in MediaKind]:RtpCodecParameters},
    sdp:{
        audio: string
        video: string
        header: string
    }
    recording:{
        path:string
        extension:string
    }
    streaming:{
        path:string
    }
    ffmpeg:{
        path:string
        encoding:{[x in MediaKind]:string[]}
    }
    ffprobe:{
        path:string
        options:{
            streams:string[]
        }
    }
    timeout:{
        stats: number,
        transport :number
        worker: number
        client: number
        consumer: number
    },
    iceServers?:IceSever[]
    simulcast?:Simulcast
}
export interface MediaSoupDefaultSettings extends MediaSoupSettings{
    worker:Omit<WorkerSettings, "rtcMinPort" | "rtcMaxPort">
}
export interface ConsumeResponse  extends ClientConsumeResponse{
    rtpParameters: RtpParameters
    type: ConsumerType
}
export interface ConsumeRequest extends ClientConsumeRequest {
    rtpCapabilities: RtpCapabilities | ClientRtpCapabilities
    localToken:string
}
export interface CreateTransportResponse extends TransportOptions{
}
export interface PipeTransports {
    local:PipeTransportData
    remote:PipeTransportData
}