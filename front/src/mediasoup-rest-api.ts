import {ACTION, ERROR, PATH} from '../../config/constants';
import {
    ConnectTransportRequest,
    ConsumerData,
    ConsumeRequest,
    ConsumeResponse,
    ConsumerPreferredLayers,
    NumWorkersData,
    PipeFromRemoteProducerRequest,
    PipeToRemoteProducerRequest,
    PipeTransportConnectData,
    PipeTransportData,
    ProducerData,
    ProduceRequest,
    ProduceResponse,
    ServerConfigs,
    RecordingData,
    StatsInput,
    StatsOutput,
    StreamFileRequest,
    TransportBitrateData,
    TransportData,
    WorkerLoadData,
    ListData,
    StreamData,
    FilePathInput,
    PushStreamInputsRequest,
    PushStreamInputsResponse,
    PullStreamInputsRequest,
    PullStreamInputsResponse,
    RecordingRequest,
    StreamKindsData,
    KindsByFileInput,
    KindsData,
    PushStreamOptionsRequest,
    PushStreamOptionsResponse,
    PushStreamRequest,
    StreamRtmpRequest
} from './client-interfaces';
import {TransportOptions} from 'mediasoup-client/lib/Transport';
import {IMediasoupApi} from '../../ms/i-mediasoup-api';
import {default as axios} from 'axios';

export class MediasoupRestApi implements IMediasoupApi{
    private readonly url:string;
    private readonly token:string;
    private readonly log:typeof console.log;
    private readonly timeouts:Array<ReturnType<typeof setTimeout>> =[];
    constructor(url:string,token:string,log?:typeof console.log ){
        this.url=url;
        this.token=token;
        this.log=log||console.log;
    }
    async resumeConsumer(json:ConsumerData):Promise<void>{
        await this.request(ACTION.RESUME_CONSUMER, json);
    }
    async pauseConsumer(json:ConsumerData):Promise<void>{
        await this.request(ACTION.PAUSE_CONSUMER, json);
    }
    async setPreferredLayers(json:ConsumerPreferredLayers):Promise<void>{
        await this.request(ACTION.SET_PREFERRED_LAYERS, json);
    }
    async closeConsumer(json:ConsumerData):Promise<void>{
        await this.request(ACTION.CLOSE_CONSUMER, json);
    }
    async resumeProducer(json:ProducerData):Promise<void>{
        await this.request(ACTION.RESUME_PRODUCER, json);
    }
    async pauseProducer(json:ProducerData):Promise<void>{
        await this.request(ACTION.PAUSE_PRODUCER, json);
    }
    async closeProducer(json:ProducerData):Promise<void>{
        await this.request(ACTION.CLOSE_PRODUCER, json);
    }
    async produce(json:ProduceRequest):Promise<ProduceResponse>{
        return (await this.request(ACTION.PRODUCE, json)) as ProduceResponse;
    }
    async consume(json:ConsumeRequest):Promise<ConsumeResponse>{
        return (await this.request(ACTION.CONSUME, json)) as ConsumeResponse;
    }
    async createPipeTransport():Promise<PipeTransportData>{
        return (await this.request(ACTION.CREATE_PIPE_TRANSPORT)) as PipeTransportData;
    }
    async connectPipeTransport(json:PipeTransportConnectData):Promise<void>{
        await this.request(ACTION.CONNECT_PIPE_TRANSPORT, json);
    }
    async closeTransport(json:TransportData):Promise<void>{
        await this.request(ACTION.CLOSE_TRANSPORT, json);
    }
    async getServerConfigs():Promise<ServerConfigs>{
        return (await this.request(ACTION.GET_SERVER_CONFIGS)) as ServerConfigs;
    }
    async createTransport():Promise<TransportOptions>{
        return (await this.request(ACTION.CREATE_TRANSPORT)) as TransportOptions;
    }
    async connectTransport(json:ConnectTransportRequest):Promise<void>{
        await this.request(ACTION.CONNECT_TRANSPORT,json);
    }
    async setMaxIncomingBitrate(json:TransportBitrateData):Promise<void>{
        await this.request(ACTION.SET_MAX_INCOMING_BITRATE, json);
    }
    async producersStats(json:StatsInput):Promise<StatsOutput>{
        return (await this.request(ACTION.PRODUCERS_STATS, json)) as StatsOutput;
    }
    async consumersStats(json:StatsInput):Promise<StatsOutput>{
        return (await this.request(ACTION.CONSUMERS_STATS, json)) as StatsOutput;
    }
    async transportStats(json:StatsInput):Promise<StatsOutput>{
        return (await this.request(ACTION.TRANSPORT_STATS, json)) as StatsOutput;
    }
    async workerLoad():Promise<WorkerLoadData>{
        return (await this.request(ACTION.WORKER_LOAD)) as WorkerLoadData;
    }
    async numWorkers():Promise<NumWorkersData>{
        return (await this.request(ACTION.NUM_WORKERS)) as NumWorkersData;
    }
    async pipeToRemoteProducer(json:PipeToRemoteProducerRequest):Promise<void>{
        await this.request(ACTION.PIPE_TO_REMOTE_PRODUCER, json);
    }
    async pipeFromRemoteProducer(json:PipeFromRemoteProducerRequest):Promise<void>{
        await this.request(ACTION.PIPE_FROM_REMOTE_PRODUCER, json);
    }
    async startRecording(json:RecordingRequest):Promise<void>{
        await this.request(ACTION.START_RECORDING,json);
    }
    async stopRecording(json:RecordingData):Promise<void>{
        await this.request(ACTION.STOP_RECORDING,json);
    }
    async fileStreaming(json:StreamFileRequest):Promise<void>{
        await this.request(ACTION.FILE_STREAMING,json);
    }
    async rtmpStreaming(json:StreamRtmpRequest):Promise<void>{
        await this.request(ACTION.RTMP_STREAMING,json);
    }
    async stopFileStreaming(json:StreamKindsData):Promise<void>{
        await this.request(ACTION.STOP_FILE_STREAMING,json);
    }
    async recordedStreams():Promise<ListData>{
        return (await this.request(ACTION.RECORDED_STREAMS) as ListData);
    }
    async streamRecordings(json:StreamData):Promise<ListData>{
        return (await this.request(ACTION.STREAM_RECORDINGS,json) as ListData);
    }
    async deleteStreamRecordings(json:StreamData):Promise<void>{
        await this.request(ACTION.DELETE_STREAM_RECORDINGS,json);
    }
    async deleteRecording(json:FilePathInput):Promise<void>{
        await this.request(ACTION.DELETE_RECORDING,json);
    }
    async pushToServerInputs(json:PushStreamInputsRequest):Promise<PushStreamInputsResponse>{
        return (await this.request(ACTION.PUSH_TO_SERVER_INPUTS,json) as PushStreamInputsResponse);
    }
    async pushToServerOptions(json:PushStreamOptionsRequest):Promise<PushStreamOptionsResponse>{
        return (await this.request(ACTION.PUSH_TO_SERVER_OPTIONS,json) as PushStreamOptionsResponse);
    }
    async pushToServer(json:PushStreamRequest):Promise<void>{
        await this.request(ACTION.PUSH_TO_SERVER,json);
    }
    async pullFromServerInputs(json:PullStreamInputsRequest):Promise<PullStreamInputsResponse>{
        return (await this.request(ACTION.PULL_FROM_SERVER_INPUTS,json) as PullStreamInputsResponse);
    }

    async kindsByFile(json:KindsByFileInput):Promise<KindsData>{
        return (await this.request(ACTION.KINDS_BY_FILE,json) as KindsData);
    }
    async requestKeyframe(json:ConsumerData):Promise<void>{
        await this.request(ACTION.REQUEST_KEYFRAME, json);
    }
    clear():void{
        while (this.timeouts.length) {
            const t=this.timeouts.shift();
            if(t){
                clearTimeout(t);
            }
        }
    }
    private async request(action,json={}):Promise<object>{
        this.log('sent message', action, JSON.stringify(json));
        try {
            const {data} =  await axios.post(`${this.url}/${PATH.MEDIASOUP}/${action}`,json,{
                headers: { 'Content-Type': 'application/json', "Authorization":`Bearer ${this.token}` },
            });
            this.log('got message',  action, JSON.stringify(data));
            return data;
        }
        catch (e) {
            this.log('got error',e);
            if(e.response && !e.response.status && !ERROR[e.response.status]){
                let timeout;
                await new Promise(resolve=>{
                    timeout=setTimeout(resolve,1000);
                    this.timeouts.push(timeout)
                });
                if(!this.timeouts.includes(timeout)){
                    throw e;
                }
                return await this.request(action,json);
            }
            else {
                throw {errorId: e.response.status};
            }
        }

    }
}