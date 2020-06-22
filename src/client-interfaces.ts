import {MediaKind, RtpCapabilities, RtpEncodingParameters, RtpParameters} from 'mediasoup-client/lib/RtpParameters';
import {ProducerCodecOptions} from 'mediasoup-client/lib/Producer';
import {DtlsParameters} from 'mediasoup-client/lib/Transport';

export interface ConsumerData {
    consumerId:string
}
export interface ConsumerPreferredLayers extends ConsumerData{
    layers:ConsumerLayers
}
export interface ConsumerLayers{
    spatialLayer: number;
    temporalLayer?: number;
}
export interface ProducerData {
    producerId:string
}

export interface ProduceRequest extends StreamKindData{
    transportId: string
    rtpParameters: RtpParameters,
    paused?:boolean
    keyFrameRequestDelay?: number
    appData?
}
export interface ProduceResponse {
    id: string
}

export interface ConsumeResponse {
    producerId: string
    id: string
    kind: MediaKind
    rtpParameters: RtpParameters
    type: string
    producerPaused: boolean
}
export interface ConsumeRequestOriginDataServer  extends ConferenceInputOrigin {
    token:string
}
export interface ConsumeRequestOriginData {
    source:ConsumeRequestOriginDataServer
    target:ConsumeRequestOriginDataServer
}
export interface ConsumeRequest extends StreamKindData{
    origin?:ConsumeRequestOriginData
    rtpCapabilities: RtpCapabilities
    transportId:string
}
export interface PipeToRemoteProducerRequest extends StreamKindData{
    origin:ConsumeRequestOriginData
    sameHost:boolean
}
export interface PipeFromRemoteProducerRequest extends ProducerData, StreamKindData{
    workerId:number
}
export interface PipeTransportData {
    pipeTransportId:string
    ip:string
    port:number
}
export interface PipeTransportConnectData extends PipeTransportData{
    transportId:string
}
export interface WorkerLoadData {
    currentLoad:number
}
export interface NumWorkersData {
    num:number
}
export interface StatsInput {
    ids:string[]
}
export interface StatsOutput {
    [x:string]:{}
}
export interface TransportData {
    transportId:string
}
export interface TransportBitrateData extends TransportData{
    bitrate:number
}
export interface IceSever {
    urls: string[];
    username?: string;
    credential?: string;
}
export interface Simulcast {
    encodings?: RtpEncodingParameters[];
    codecOptions?: ProducerCodecOptions;
}
export interface ServerConfigs {
    routerRtpCapabilities:RtpCapabilities
    iceServers?:IceSever[]
    simulcast?:Simulcast
    timeout?:{
        stats: number
        transport: number
        consumer: number
    }
}
export interface ConnectTransportRequest extends TransportData{
    transportId: string
    dtlsParameters: DtlsParameters
}
export interface RecordingData extends StreamKindsData{
}
export interface RecordingRequest extends StreamKindsData{
    layer?:number
}
export interface KindsData{
    kinds:MediaKind[]
    width?:number
    height?:number
}
export interface StreamKindsData extends StreamData{
    kinds?:MediaKind[]
}
export interface StreamKindData extends StreamData{
    kind:MediaKind
}
export interface StreamData {
    stream:string
}
export interface StreamFileRequest extends StreamKindsData,KindsByFileInput{
    restartOnExit?:boolean
    checkKinds?:boolean
    additionalInputOptions?:string[]
    additionalOutputOptions?:string[]
}
export interface StreamRtmpRequest extends StreamKindsData,StreamingOptions{
    rtmpUrl:string
    restartOnExit?:boolean
}
export interface StreamingOptions{
    width?:number
    height?:number
    frameRate?:number
    videoBitrate?:string
}

export interface KindsByFileInput{
    filePath:string
    relativePath?:boolean
}
export interface PushStreamInputsResponse{
    options:string[]
}
export interface PushStreamInputsRequest extends PullStreamInputsRequest,PushStreamInputsResponse{
}
export interface PushStreamOptionsResponse{
    portsData:{
        [kind in MediaKind]?: PortData
    }
    listenIp: string
}
export interface PortData {
    payloadType: number
    ssrc:number
    rtpPort:number
    rtcpPort:number
    bindRtpPort?:number
    bindRtcpPort?:number
}
export interface PushStreamOptionsRequest extends PullStreamInputsRequest{
    bindPorts?:boolean
}
export interface PushStreamRequest extends StreamKindsData{
    options:string[]
    restartOnExit?:boolean
    app?:string
    stdIn?:string
}
export interface TransportListenIp {
    ip: string
    announcedIp?: string
}
export interface PullStreamInputsRequest extends StreamKindsData{
    listenIp?:TransportListenIp|string
    layer?:number
}
export interface PullStreamInputsResponse{
    sdp:string
    consumerIds:{[id:string]:string}
}
export interface ConferenceInputOrigin{
    token?: string
    url:string
    worker:number
}
export interface ConferenceInput {
    stopTracks?:boolean
    worker?:number
    url:string
    origin?: ConferenceInputOrigin
    stream: string
    token: string
    simulcast?:boolean
    kinds?:MediaKind[]
    maxIncomingBitrate?:number
}
export interface ConferenceConfigTimeout {
    stats: number
    transport: number
    consumer: number
}
export interface ConferenceConfig extends ConferenceInput{
    worker:number
    kinds:MediaKind[]
    maxIncomingBitrate:number
    timeout: ConferenceConfigTimeout
}
export interface ListData {
    list:string[];
}
export interface FilePathInput {
    filePath:string;
}