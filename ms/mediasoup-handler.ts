import {Consumer} from 'mediasoup/lib/Consumer';
import {MediaKind, RtpCapabilities} from 'mediasoup/lib/RtpParameters';
import {
    ConsumeRequest,
    ConsumeResponse,
    CreateTransportResponse,
    MediaSoupSettings,
    PipeTransports
} from './interfaces';
import {
    ConnectTransportRequest,
    ConsumerData,
    ConsumeRequestOriginData,
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
    PushStreamInputsRequest,
    PushStreamInputsResponse,
    PullStreamInputsRequest,
    PullStreamInputsResponse,
    ListData,
    StreamData,
    FilePathInput,
    RecordingRequest,
    StreamKindsData,
    KindsByFileInput,
    KindsData, PushStreamOptionsRequest, PushStreamOptionsResponse, PortData, PushStreamRequest, StreamRtmpRequest
} from '../front/src/client-interfaces';
import {WebRtcTransport} from 'mediasoup/lib/WebRtcTransport';
import {Router} from 'mediasoup/lib/Router';
import {Worker} from 'mediasoup/lib/Worker';
import {Transport, TransportListenIp} from 'mediasoup/lib/Transport';
import {Producer} from 'mediasoup/lib/Producer';
import {EventEmitter} from 'events';
import {MediasoupRestApi} from '../front/src/mediasoup-rest-api';
import {ACTION, ERROR} from '../config/constants';
import * as mediasoup from 'mediasoup';
import {IMediasoupApi} from './i-mediasoup-api';
import {basename, dirname, join} from 'path';
import {PlainRtpTransport} from 'mediasoup/lib/PlainTransport';
import {ChildProcess, execFile, spawn} from 'child_process';
import {IceCandidate} from 'mediasoup-client/lib/Transport';
import {PortUtils} from '../utils/port-utils';
import {FileUtils} from '../utils/file-utils';
import {dir as createTmpDir} from 'tmp-promise';
import { mkfifoSync } from 'named-pipe';

export class MediasoupHandler extends EventEmitter implements IMediasoupApi{
    router:Router;
    private readonly _conf:MediaSoupSettings;
    private _worker:Worker;
    private readonly id:number;
    private readonly _workers:MediasoupHandler[];
    private readonly _producers:Map<string, Producer> = new Map();
    private readonly _consumers:Map<string, Consumer> = new Map();
    private readonly _transports:Map<string, Transport> = new Map();
    private readonly _producerIdByStream:Map<string, string> = new Map();
    private readonly _streamWaiters:Map<string,(()=>void)[]>= new Map();
    private readonly _mapRouterPipeTransports: Map<string, PipeTransports|boolean> = new Map();
    private readonly _pipeTransportsWaiters:Map<string,(()=>void)[]>= new Map();
    private readonly _portHandler:PortUtils;
    private readonly _fileHandler:FileUtils;
    private readonly _recorders: Map<string,string>=new Map();
    private readonly _childProcesses: Map<number,ChildProcess>=new Map();
    private readonly _pidsByStreamKind: Map<string,number>=new Map();
    private currentLoad: number = 0;
    private lastLoadTime: number = 0;

    constructor(id:number, workers:MediasoupHandler[], portHandler:PortUtils,fileHandler:FileUtils,conf:MediaSoupSettings){
        super();
        this.id=id;
        this._portHandler=portHandler;
        this._fileHandler=fileHandler;
        this._workers=workers;
        this._conf=conf;
        this.initialize().then(async ()=>{
            console.log('starting worker',this.id,this._conf.worker.rtcMinPort,this._conf.worker.rtcMaxPort)
        })
    }
    async [ACTION.CONSUME]({kind,rtpCapabilities,stream,transportId,origin,localToken}:ConsumeRequest):Promise<ConsumeResponse>{
        const producerId=await this.originProducerId(stream,kind,localToken,origin);
        const producer=this.getProducer(producerId);
        const transport=this.getTransport(transportId);
        const consumer= await this.createConsumer(producer,transport, rtpCapabilities as RtpCapabilities);
        return{
            producerId: producer.id,
            id: consumer.id,
            kind: consumer.kind,
            rtpParameters: consumer.rtpParameters,
            type: consumer.type,
            producerPaused: consumer.producerPaused
        };
    }
    async [ACTION.PRODUCE]( {stream, transportId, kind, rtpParameters, paused, keyFrameRequestDelay,appData}:ProduceRequest):Promise<ProduceResponse>{
        const transport=this.getTransport(transportId);
        console.log('produce',keyFrameRequestDelay);
        const producer = await transport.produce({ kind, rtpParameters, paused, keyFrameRequestDelay,appData});
        transport.observer.on('close',()=>{
            console.log('trying closing producer',producer.id);
            producer.close();
        });
        this.setProducerListeners(producer,stream,kind);
        this.setProducerIdByStream(stream,kind,producer.id);
        return { id: producer.id };

    }
    async [ACTION.RESUME_CONSUMER]({consumerId}:ConsumerData):Promise<void>{
        const consumer=this.getConsumer(consumerId);
        await consumer.resume();
    }
    async [ACTION.PAUSE_CONSUMER]({consumerId}:ConsumerData):Promise<void>{
        const consumer=this.getConsumer(consumerId);
        await consumer.pause();
    }
    async [ACTION.CLOSE_CONSUMER]({consumerId}:ConsumerData):Promise<void>{
        try{
            const consumer=this.getConsumer(consumerId);
            await consumer.close();
        }
        catch (e) {}

    }
    async [ACTION.REQUEST_KEYFRAME]({consumerId}:ConsumerData):Promise<void>{
        try{
            const consumer=this.getConsumer(consumerId);
            await consumer.requestKeyFrame();
        }
        catch (e) {}

    }
    async [ACTION.SET_PREFERRED_LAYERS]({consumerId,layers}:ConsumerPreferredLayers):Promise<void>{
        const consumer=this.getConsumer(consumerId);
        if (consumer.type === 'simulcast') {
            await consumer.setPreferredLayers(layers);
        }
    }
    async [ACTION.RESUME_PRODUCER]({producerId}:ProducerData):Promise<void>{
        const producer=this.getProducer(producerId);
        await producer.resume();
    }
    async [ACTION.PAUSE_PRODUCER]({producerId}:ProducerData):Promise<void>{
        const producer=this.getProducer(producerId);
        await producer.pause();
    }
    async [ACTION.CLOSE_PRODUCER]({producerId}:ProducerData):Promise<void>{
        try{
            const producer=this.getProducer(producerId);
            await producer.close();
        }
        catch (e) {}
    }
    async [ACTION.SET_MAX_INCOMING_BITRATE]({transportId,bitrate}:TransportBitrateData):Promise<void>{
        const transport=this.getTransport(transportId);
        await transport.setMaxIncomingBitrate(bitrate)
    }
    async [ACTION.TRANSPORT_STATS]({ids}:StatsInput):Promise<StatsOutput>{
        const stats=await Promise.all(ids.map((id)=>{
            try{
                const t=this.getTransport(id);
                return t.getStats();
            }
            catch (e) {}
        }));
        return ids.reduce(function(map, id, index) {
            map[id] = stats[index];
            return map;
        }, {});
    }
    async [ACTION.CONSUMERS_STATS]({ids}:StatsInput):Promise<StatsOutput>{
        const stats=await Promise.all(ids.map((id)=>{
            try{
                const t=this.getConsumer(id);
                return t.getStats();
            }
            catch (e) {}
        }));
        console.log('stats',stats);
        return ids.reduce(function(map, id, index) {
            map[id] = stats[index];
            return map;
        }, {});
    }
    async [ACTION.PRODUCERS_STATS]({ids}:StatsInput):Promise<StatsOutput>{
        const stats=await Promise.all(ids.map((id)=>{
            try{
                const t=this.getProducer(id);
                return t.getStats();
            }
            catch (e) {}
        }));
        return ids.reduce(function(map, id, index) {
            map[id] = stats[index];
            return map;
        }, {});
    }
    async [ACTION.GET_SERVER_CONFIGS]():Promise<ServerConfigs>{
        return {
            routerRtpCapabilities:this.router.rtpCapabilities,
            iceServers: this._conf.iceServers,
            simulcast: this._conf.simulcast,
            timeout: {
                consumer:this._conf.timeout.consumer,
                stats:this._conf.timeout.client,
                transport:this._conf.timeout.transport,
            }
        };
    }
    async [ACTION.WORKER_LOAD]():Promise<WorkerLoadData>{
        return {currentLoad:this.currentLoad};
    }
    async [ACTION.NUM_WORKERS]():Promise<NumWorkersData>{
        return {num:this._workers.length};
    }
    async [ACTION.CREATE_PIPE_TRANSPORT]():Promise<PipeTransportData>{
        const transport=await this.router.createPipeTransport({ listenIp:this._conf.pipeTransport.listenIp,enableSrtp:false, numSctpStreams:{ OS: 1024, MIS: 1024 } });
        this.setTransportListeners(transport);
        return {pipeTransportId:transport.id,port:transport.tuple.localPort,ip:transport.tuple.localIp};
    }
    async [ACTION.CONNECT_PIPE_TRANSPORT]({pipeTransportId,ip,port,transportId}:PipeTransportConnectData):Promise<void>{
        const transport=this.getTransport(transportId);
        await transport.connect({ ip,port });
    }
    async [ACTION.CREATE_TRANSPORT]():Promise<CreateTransportResponse>{
        const transport = await this.createWebRtcTransport();
        return {
            id: transport.id,
            iceParameters: transport.iceParameters,
            iceCandidates: transport.iceCandidates as IceCandidate[],
            dtlsParameters: transport.dtlsParameters
        };
    }
    async [ACTION.CONNECT_TRANSPORT]({transportId,dtlsParameters}:ConnectTransportRequest):Promise<void>{
        const transport=this.getTransport(transportId);
        await transport.connect({ dtlsParameters });
    }
    async [ACTION.CLOSE_TRANSPORT]({transportId}:TransportData):Promise<void>{
        const transport = this._transports.get(transportId);
        if(transport) {
            transport.close();
        }
    }
    async [ACTION.RECORDED_STREAMS]():Promise<ListData>{
        return {list:this._fileHandler.listPrefixes()};
    }
    async [ACTION.STREAM_RECORDINGS]({stream}:StreamData):Promise<ListData>{
        return {list:this._fileHandler.listByPrefix(stream)};
    }
    async [ACTION.DELETE_STREAM_RECORDINGS]({stream}:StreamData):Promise<void>{
        await this._fileHandler.deleteByPrefix(stream);
    }
    async [ACTION.DELETE_RECORDING]({filePath}:FilePathInput):Promise<void>{
        await this._fileHandler.deleteFile(filePath);
    }
    async [ACTION.PIPE_FROM_REMOTE_PRODUCER]({stream,kind,producerId,workerId}:PipeFromRemoteProducerRequest):Promise<void> {
        const producer=this._producers.get(producerId);
        if(producer) {
            this.setProducerIdByStream(stream,kind,producer.id);
        }
        else {
            const worker=this._workers[workerId];
            if(!worker){
                throw {errorId: ERROR.INVALID_WORKER}
            }
            const {pipeProducer,pipeConsumer}=await worker.router.pipeToRouter({producerId,router:this.router});
            if(pipeConsumer){
                this._consumers.set(pipeConsumer.id,pipeConsumer);
            }
            if(pipeProducer){
                this.setProducerListeners(pipeProducer,stream,kind);
                this.setProducerIdByStream(stream,kind,pipeProducer.id);
            }
        }
    }
    async [ACTION.PIPE_TO_REMOTE_PRODUCER]({stream, kind,origin,localToken}:PipeToRemoteProducerRequest):Promise<void> {
        const producerId=await this.originProducerId(stream,kind,localToken,origin.origin);
        console.log('producerId',producerId);
        const producer = this._producers.get(producerId);
        if (producer) {
            const {api,sameHost}=this.remoteApi({to:origin.from, from:origin.to, token:origin.token});
            if(sameHost){
                await api[ACTION.PIPE_FROM_REMOTE_PRODUCER]({stream,kind,producerId,workerId:this.id});
            }
            else {
                const pipeTransports = await this.getPipeTransports(api,origin.to);
                const localTransport=this._transports.get(pipeTransports.local.pipeTransportId);
                if(localTransport){
                    const pipeConsumer: Consumer = await  localTransport.consume({producerId: producer.id});
                    this._consumers.set(pipeConsumer.id,pipeConsumer);
                    const remoteProducerData=await api.produce(
                        {
                            transportId: pipeTransports.remote.pipeTransportId,
                            stream,
                            kind: pipeConsumer.kind,
                            rtpParameters: pipeConsumer.rtpParameters,
                            paused: pipeConsumer.producerPaused,
                            appData: producer.appData
                        });

                    pipeConsumer.observer.on('close', () => api.closeProducer({producerId: remoteProducerData.id}));
                    pipeConsumer.observer.on('pause', () => api.pauseProducer({producerId: remoteProducerData.id}));
                    pipeConsumer.observer.on('resume', () => api.resumeProducer({producerId: remoteProducerData.id}));
                }
            }

        }
        else {
            console.log('no producer',stream,kind)
        }
    }
    async [ACTION.STOP_FILE_STREAMING]({stream,kinds=['audio','video']}:StreamKindsData):Promise<void> {
        const pid=this._pidsByStreamKind.get(stream);
        if(pid){
            this._pidsByStreamKind.delete(stream);
            const p=this._childProcesses.get(pid);
            if(p){
                p.kill();
            }
        }
        for (const kind of kinds) {
            const producerId =await this.producerIdByStream(stream,kind,false);
            if(producerId){
                const producer = this._producers.get(producerId);
                if (producer) {
                    producer.close()
                }
            }
        }

    }
    async [ACTION.RTMP_STREAMING]({stream,restartOnExit,kinds=['audio','video'],videoBitrate,frameRate=30,height,width,rtmpUrl}:StreamRtmpRequest):Promise<void> {
        await this[ACTION.STOP_FILE_STREAMING]({kinds,stream});
        const params = await this[ACTION.KINDS_BY_FILE]({filePath:rtmpUrl});
        kinds=kinds.filter(k=>params.kinds.includes(k));
        const f:{[x in MediaKind]?:ChildProcess}={};
        if(kinds.length){
            const tmpDir = await createTmpDir({unsafeCleanup: true});
            const {portsData,listenIp}=await this.pushToServerOptions({kinds,bindPorts:true,stream,listenIp:'127.0.0.1'});
            const options=["rtpbin","name=rtpbin","rtp-profile=avpf"];
            let i:number=0;
            for (const kind in portsData) {
                const ffmpegOptions=['-analyzeduration','20M','-probesize','20M','-i',rtmpUrl];
                const fifoPath=join(tmpDir.path,`${kind}.fifo`);
                mkfifoSync(fifoPath,664);
                const {ssrc, rtpPort, rtcpPort,payloadType,bindRtpPort,bindRtcpPort} = portsData[kind];
                options.push("filesrc", `location=${fifoPath}`,"!","queue","!");
                if(kind==='video'  && params.width && params.height){
                    if(!width){
                        if(height){
                            width=2*Math.floor(height*params.width/params.height/2)
                        }
                        else {
                            width=  params.width
                        }
                    }
                    if(!height){
                        if(width){
                            height=2*Math.floor(width*params.height/params.width/2)
                        }
                        else {
                            height=params.height
                        }
                    }
                    ffmpegOptions.push('-an','-r',frameRate.toString(),"-f","rawvideo","-pix_fmt","yuv420p",'-s',`${width}x${height}`);

                    options.push("rawvideoparse", `framerate=${frameRate}/1`,`width=${width}`,`height=${height}`,"!");
                    options.push( "x264enc","tune=zerolatency", "speed-preset=1","dct8x8=true","quantizer=15","pass=qual",'key-int-max=60');
                    if(videoBitrate){
                        options.push(`bitrate=${videoBitrate}`);
                    }
                    options.push( "!");
                    options.push("rtph264pay");

                }
                else if(kind==='audio') {
                    ffmpegOptions.push("-vn","-c:a","pcm_s16le","-f","s16le","-ar","48000","-ac","2");
                    options.push("rawaudioparse","format=pcm","pcm-format=s16le","sample-rate=48000","num-channels=2","!");
                    options.push("opusenc","!");
                    options.push("rtpopuspay");
                }
                ffmpegOptions.push('-y',fifoPath);
                options.push(`ssrc=${ssrc}`,`pt=${payloadType}`);
                options.push("!", "rtprtxqueue","max-size-time=2000","max-size-packets=0",
                    "!", `rtpbin.send_rtp_sink_${i}`,
                    `rtpbin.send_rtp_src_${i}`,"!",
                    "udpsink",`bind-address=${listenIp}`, `host=${listenIp}`,`bind-port=${bindRtpPort}`, `port=${rtpPort}`,
                    `rtpbin.send_rtcp_src_${i}`,"!",
                    "udpsink",`bind-address=${listenIp}`, `host=${listenIp}`, `port=${rtcpPort}`,
                    "sync=false", "async=false", "udpsrc",`port=${bindRtcpPort}`,
                    "!",`rtpbin.recv_rtcp_sink_${i}`);
                i++;
                f[kind] = this.launchChildProcess(ffmpegOptions);
                f[kind].on('exit', async () => {
                    f[kind]=undefined;
                    if (p) {
                        p.kill()
                    }
                });
            }
            let p:ChildProcess|undefined;
            p = this.launchChildProcess(options,undefined,'gst-launch-1.0');
            p.on('exit', async () => {
                await tmpDir.cleanup();
                for(const kind in f){
                    if(f[kind]){
                        f[kind].kill();
                    }
                }
                if(p){
                    const {pid}=p;
                    p=undefined;
                    if (this._pidsByStreamKind.get(stream) === pid) {
                        this._pidsByStreamKind.delete(stream);
                        if(restartOnExit){
                            await this[ACTION.RTMP_STREAMING]({stream, kinds, restartOnExit, videoBitrate,frameRate,height,width,rtmpUrl});
                        }
                    }
                }
            });
            this._pidsByStreamKind.set(stream, p.pid);
        }

    }
    async [ACTION.FILE_STREAMING]({filePath, stream, restartOnExit,checkKinds,relativePath, kinds=['audio','video'],additionalInputOptions=[],additionalOutputOptions=[]}:StreamFileRequest):Promise<void> {
        if(checkKinds){
            const {kinds:_kinds} = await this[ACTION.KINDS_BY_FILE]({filePath,relativePath});
            kinds=kinds.filter(k=>_kinds.includes(k));
        }
        if(kinds.length){
            if(relativePath){
                filePath=join(this._conf.streaming.path,filePath)
            }
            const {options}=await this.pushToServerInputs({stream,kinds,options:[...additionalInputOptions,'-re','-i',filePath,...additionalOutputOptions],listenIp:'127.0.0.1'});
            await this[ACTION.PUSH_TO_SERVER]({stream,kinds, restartOnExit, options});
        }

    }
    async [ACTION.PUSH_TO_SERVER]({stream,kinds, restartOnExit, options, app=this._conf.ffmpeg.path, stdIn}:PushStreamRequest):Promise<void> {
        const p = this.launchChildProcess(options,stdIn,app);
        p.on('exit', async () => {
            if (this._pidsByStreamKind.get(stream) === p.pid) {
                this._pidsByStreamKind.delete(stream);
                if(restartOnExit){
                    await this[ACTION.PUSH_TO_SERVER]({stream,kinds, restartOnExit, options, app, stdIn});
                }
            }
        });
        this._pidsByStreamKind.set(stream, p.pid);

    }
    async [ACTION.KINDS_BY_FILE]({filePath,relativePath}:KindsByFileInput):Promise<KindsData> {
        if(relativePath){
            filePath=join(this._conf.streaming.path,filePath)
        }
        const kinds:MediaKind[]=[];
        let width;
        let height;
        return new Promise((resolve, reject) => {
            const options=['-analyzeduration','20M','-probesize','20M',...this._conf.ffprobe.options.streams, filePath];
            console.log(this._conf.ffprobe.path,options.join(' '));
            const p=execFile(this._conf.ffprobe.path, options, function (err, stdout) {
                clearTimeout(t);
                if (err) {
                    reject({errorId:ERROR.INVALID_INPUT,...err});
                }
                else {
                    //console.log(stdout.toString());
                    try {
                        let metadata = JSON.parse(stdout.toString());
                        if (metadata.hasOwnProperty('streams')) {
                            for (const stream of metadata.streams) {
                                switch (stream.codec_type) {
                                    case 'video':
                                    case 'audio':
                                        if(stream.codec_type==='video'){
                                            width=stream.width;
                                            height=stream.height;
                                            if(!width || !height){
                                                break;
                                            }
                                        }
                                        if(!kinds.includes(stream.codec_type)){
                                            kinds.push(stream.codec_type);
                                        }

                                }
                            }
                        }
                        resolve({kinds,width,height});

                    }
                    catch (err) {
                        reject({errorId:ERROR.INVALID_INPUT,...err});
                    }

                }
            });
            const t=setTimeout(()=>{
                p.kill();
                reject({errorId:ERROR.INVALID_INPUT});
            },10000)

        });

    }
    async [ACTION.STOP_RECORDING]({stream,kinds=['audio','video']}:RecordingData):Promise<void> {
        for (const kind of kinds) {
            const id = MediasoupHandler.streamKindId(stream, kind);
            const recorder = this._recorders.get(id);
            if (recorder) {
                this._recorders.delete(id);
                const consumer = this._consumers.get(recorder);
                if (consumer) {
                    consumer.close();
                }
            }
        }

    }
    async [ACTION.START_RECORDING]({stream,kinds=['audio','video'],layer=-1}:RecordingRequest):Promise<void>{
        const _consumerIds:string[]=[];
        const promises:Promise<void>[]=[];
        for (const kind of kinds) {
            const id = MediasoupHandler.streamKindId(stream, kind);
            if (!this._recorders.get(id)) {
                this._recorders.set(id, ' ');
                promises.push(new Promise(resolve => {
                    this.pullFromServerInputs({
                        kinds:[kind],
                        stream,
                        listenIp: '127.0.0.1',
                        layer
                    }).then(({consumerIds, sdp})=>{
                        if (this._recorders.get(id)) {
                            const options:string[] = [];
                            options.push( '-fflags', '+genpts');
                            options.push('-protocol_whitelist', 'file,pipe,udp,rtp', '-i', '-');
                            const consumerId = consumerIds[kind];
                            if (!consumerId) {
                                this.producerIdByStream(stream, kind).then(async () => {
                                    await this.restartRecording({stream, kinds: [kind],layer});
                                });
                            }
                            else {
                                _consumerIds.push(consumerId);
                                options.push('-map', `0:${kind.charAt(0)}:0`, `-c:${kind.charAt(0)}`, 'copy');
                                this._recorders.set(id, consumerId);

                                const extension = this._conf.recording.extension;
                                const name = id.replace(':', '_');
                                const folder = this._conf.recording.path;
                                const fileName = `${name}_${Date.now()}.${extension}`;
                                const filePath = join(folder, fileName);
                                options.push(filePath, '-y');
                                console.log('start _recording_',filePath);

                                const p = this.launchChildProcess(options, sdp);
                                this._pidsByStreamKind.set(id, p.pid);
                                p.on('exit', async () => {
                                    console.log('stop _recording_',filePath);
                                    this._fileHandler.pushFile(fileName).then(()=>{}).catch(()=>{});
                                    if (this._pidsByStreamKind.get(id) === p.pid) {
                                        this._pidsByStreamKind.delete(id);
                                        if (this._recorders.get(id)) {
                                            try {
                                                await this.restartRecording({stream, kinds: [kind]});
                                            }
                                            catch (e) {
                                            }
                                        }
                                    }
                                });
                            }
                            resolve();
                        }
                    });
                }));
            }
        }
        await Promise.all(promises);
        await Promise.all(_consumerIds.map(consumerId=>this.getConsumer(consumerId).requestKeyFrame()));
        await Promise.all(_consumerIds.map(consumerId=>this[ACTION.RESUME_CONSUMER]({consumerId})));
    }
    private async restartRecording({stream,kinds=['audio','video'],layer}:RecordingRequest):Promise<void>{
        await this.stopRecording({stream, kinds});
        await this.startRecording({stream, kinds,layer});
    }
    private remoteApi(origin:ConsumeRequestOriginData):{api:IMediasoupApi,sameHost:boolean}{
        const sameHost=dirname(origin.from)===dirname(origin.to);
        if(sameHost){
            const id=parseInt(basename(origin.from));
            if(id===this.id){
                throw {errorId: ERROR.INVALID_WORKER}
            }
            const worker=this._workers[id];
            if(worker){
                return {api:worker,sameHost}
            }
        }
        return {api:new MediasoupRestApi(origin.from,origin.token),sameHost}
    }
    private async originProducerId(stream:string,kind:MediaKind,localToken:string,origin?:ConsumeRequestOriginData):Promise<string>{
        let producerId=await this.producerIdByStream(stream,kind,false);
        if(!producerId) {
            if(origin) {
                const {api}=this.remoteApi(origin);
                origin.token=localToken;
                await api[ACTION.PIPE_TO_REMOTE_PRODUCER]({kind,stream,origin:origin,localToken});
                producerId=await this.producerIdByStream(stream,kind,false);
                if(!producerId) {
                    throw {errorId: ERROR.INVALID_STREAM}
                }
            }
            else {
                throw {errorId: ERROR.INVALID_STREAM}
            }
        }
        return producerId;
    }
    private setTransportListeners(transport:Transport,watchStats=true):void{
        this._transports.set(transport.id,transport);
        if(watchStats) {
            let deadTime = 0;
            const getStats = () => {
                if (transport && !transport.closed) {
                    transport.getStats().then(async stats => {
                        if (transport && !transport.closed) {
                            let alive = false;
                            while (stats && stats.length) {
                                const s = stats.shift();
                                if (s) {
                                    //console.log('stats',s.recvBitrate, s.sendBitrate);
                                    if (s.recvBitrate && s.sendBitrate) {
                                        alive = true;
                                        break;
                                    }
                                }
                            }

                            if (alive) {
                                deadTime = 0;
                            }
                            else {
                                deadTime += this._conf.timeout.stats;
                                if (deadTime >= this._conf.timeout.transport) {
                                    try {
                                        console.log('transport timeout');
                                        await transport.close();
                                    }
                                    catch (e) {
                                    }
                                    return;
                                }
                            }
                            setTimeout(getStats, this._conf.timeout.stats);
                        }

                    });
                }
            };
            getStats();
        }
        transport.observer.on('close',()=>{
            console.log('transport close',transport.id);
            this._transports.delete(transport.id);
        });
    }
    private setConsumerListeners(consumer:Consumer){
        this._consumers.set(consumer.id, consumer);
        consumer.on('transportclose',async ()=>{
            consumer.close();
        });
        consumer.observer.on('close',()=>{
            console.log('consumer close',consumer.id);
            this._consumers.delete(consumer.id);
        })
    }
    private setProducerListeners(producer:Producer,stream:string, kind:MediaKind, checkProducer=true){
        this._producers.set(producer.id, producer);
        producer.on('transportclose',async ()=>{
            producer.close();
        });
        checkProducer=false;
        if(checkProducer) {
            let deadTime = 0;
            const getStats = () => {
                if (producer && !producer.closed) {
                    producer.getStats().then(async stats => {
                        if (producer && !producer.closed) {
                            let alive = false;
                            while (stats && stats.length) {
                                const s = stats.shift();
                                if (s) {
                                    //console.log('stats',s.recvBitrate, s.sendBitrate);
                                    if (s.bitrate) {
                                        alive = true;
                                        break;
                                    }
                                }
                            }

                            if (alive) {
                                if (stream && kind) {
                                    const id = stream && kind && MediasoupHandler.streamKindId(stream, kind);
                                    if (id && !this._producerIdByStream.get(id)) {
                                        console.log('alive producer', id);
                                        this.setProducerIdByStream(stream, kind, producer.id, false);
                                    }
                                }
                                deadTime = 0;
                            }
                            else {
                                const id = stream && kind && MediasoupHandler.streamKindId(stream, kind);
                                if (id && this._producerIdByStream.get(id) === producer.id) {
                                    console.log('dead producer', id);
                                    this._producerIdByStream.delete(id);
                                }

                                deadTime += this._conf.timeout.stats;
                                if (deadTime >= this._conf.timeout.transport) {
                                    try {
                                        await producer.close();
                                    }
                                    catch (e) {
                                    }
                                    return;
                                }
                            }
                            setTimeout(getStats, this._conf.timeout.stats);
                        }

                    });
                }
            };
            getStats();
        }
        producer.observer.on('close',()=>{
            this._producers.delete(producer.id);
            this._producerIdByStream.forEach((producerId,id)=>{
                if(producerId===producer.id){
                    this._producerIdByStream.delete(id);
                    console.log('producer stream close',producer.id,id);
                    const recorder=this._recorders.get(id);
                    if(recorder){
                        const consumer = this._consumers.get(recorder);
                        if(consumer) {
                            consumer.close();
                        }
                    }
                }

            });
        })
    }
    private async createConsumer(producer:Producer, transport:Transport,rtpCapabilities:RtpCapabilities,paused?:boolean):Promise<Consumer> {
        if (!this.router.canConsume(
            {
                producerId: producer.id,
                rtpCapabilities,
            })
        ) {
            throw {message:'can not consume'};
        }
        try {
            const consumer = await transport.consume({
                producerId: producer.id,
                rtpCapabilities,
                paused: paused||producer.kind === 'video',
            });
            producer.observer.on('close',()=>{
                consumer.close();
            });
            transport.observer.on('close',()=>{
                consumer.close();
            });
            this.setConsumerListeners(consumer);
            return consumer;
        } catch (error) {
            throw error;
        }


    }
    private setProducerIdByStream(stream:string,kind:MediaKind,producerId:string,newProducer:boolean=true):void{
        const id=MediasoupHandler.streamKindId(stream,kind);
        const _producerId=this._producerIdByStream.get(id);
        if(newProducer && _producerId){
            const _producer=this._producers.get(_producerId);
            if(_producer){
                _producer.close();
            }
        }
        this._producerIdByStream.set(id,producerId);
        console.log('producer stream',producerId,id);
        const waiters:(()=>void)[] | undefined = this._streamWaiters.get(id);
        if(waiters) {
            while (waiters.length) {
                const w=waiters.shift();
                if(w){
                    w();
                }
            }
            this._streamWaiters.delete(id)
        }
    }
    private async createWebRtcTransport():Promise<WebRtcTransport> {
        const {
            maxIncomingBitrate,
            initialAvailableOutgoingBitrate
        } = this._conf.webRtcTransport;
        const transport = await this.router.createWebRtcTransport({
            listenIps: this._conf.webRtcTransport.listenIps,
            enableUdp: true,
            enableTcp: true,
            preferUdp: true,
            initialAvailableOutgoingBitrate,
        });
        if (maxIncomingBitrate) {
            try {
                await transport.setMaxIncomingBitrate(maxIncomingBitrate);
            } catch (error) {
            }
        }
        this.setTransportListeners(transport);
        return transport;
    }
    private async createPlainRtpTransport(listenIp:TransportListenIp|string,comedia?:boolean,rtcpMux?:boolean):Promise<PlainRtpTransport>{
        console.log('createPlainRtpTransport',listenIp);
        const transport= await this.router.createPlainRtpTransport(
            {
                listenIp,
                rtcpMux, comedia
            });
        this.setTransportListeners(transport,false);
        return transport;
    }
    private async createPlainRtpProducer(transport:PlainRtpTransport,kind:MediaKind,ssrc:number){
        return await transport.produce(
            {
                kind,
                rtpParameters :
                    {
                        codecs:[this._conf.codecParameters[kind]],
                        encodings : [ { ssrc } ]
                    }
            });
    }
    private async initialize():Promise<void>{
        mediasoup.parseScalabilityMode('S3T1');
        this._worker = await mediasoup.createWorker(this._conf.worker);
        this._worker.on('died', () => {
            console.error('mediasoup worker died, exiting in 2 seconds... [pid:%d]', this._worker.pid);
            setTimeout(() => process.exit(1), 2000);
        });
        this.router = await this._worker.createRouter(this._conf.router);
        await this.getWorkerResourceUsage();
    }
    private async getWorkerResourceUsage() {
        if (!this._worker.closed){
            const {ru_stime, ru_utime} = await this._worker.getResourceUsage();
            const currentLoadTime = ru_stime + ru_utime;
            this.currentLoad = currentLoadTime - this.lastLoadTime;
            this.lastLoadTime = currentLoadTime;
            setTimeout(async ()=>{
                await this.getWorkerResourceUsage()
            },this._conf.timeout.worker)
        }

    }
    private async producerIdByStream(stream:string,kind:MediaKind,wait:boolean=true,checkProducer=true):Promise<string|undefined>{
        if(wait){
            await this.waitForStream(stream,kind);
        }
        checkProducer=false;
        const id=MediasoupHandler.streamKindId(stream,kind);
        let producerId=this._producerIdByStream.get(id);
        if(producerId){
            const producer=this._producers.get(producerId);
            if(!producer  || producer.closed){
                producerId=undefined;
            }
            else if(checkProducer){
                const stats=await producer.getStats();
                let alive = false;
                while (stats && stats.length) {
                    const s = stats.shift();
                    if (s) {
                        if (s.bitrate) {
                            alive = true;
                            break;
                        }
                    }
                }
                if(!alive) {
                    if(this._producerIdByStream.get(id)===producer.id) {
                        this._producerIdByStream.delete(id);
                    }
                    producerId=undefined;
                }
            }
            if(!producerId){
                console.log('dead producer', id)
            }
        }

        if(!producerId && wait){
            await this.waitForStream(stream,kind);
        }
        return producerId;
    }
    private async waitForStream(stream:string,kind:MediaKind){
        const id=MediasoupHandler.streamKindId(stream,kind);
        let producerId=this._producerIdByStream.get(id);
        if(!producerId) {
            return new Promise(resolve=>{
                const w=this._streamWaiters.get(id);
                if(w){
                    w.push(resolve);
                }
                else {
                    this._streamWaiters.set(id,[resolve]);
                }
            })
        }
    }
    private getProducer(producerId:string):Producer{
        const producer=this._producers.get(producerId);
        if(producer) {
            return producer
        }
        else {
            throw {errorId:ERROR.INVALID_PRODUCER}
        }
    }
    private getConsumer(consumerId:string):Consumer{
        const consumer=this._consumers.get(consumerId);
        if(consumer) {
            return consumer
        }
        else {
            throw {errorId:ERROR.INVALID_CONSUMER}
        }
    }
    private getTransport(transportId:string):Transport{
        const transport = this._transports.get(transportId);
        if(transport) {
            return transport
        }
        else {
            throw {errorId:ERROR.INVALID_TRANSPORT}
        }
    }
    private async getStreamInputFromServer(producer:Producer,listenIp:TransportListenIp|string,layer:number=-1):Promise<{port:number,consumer:Consumer}>{
        const transport = await this.createPlainRtpTransport(listenIp);
        producer.on('transportclose',async ()=>{
            try{
                await transport.close();
            }
            catch (e) {
            }
        });
        const port=await this._portHandler.allocate(transport.id,listenIp.toString());
        await transport.connect({
            ip: transport.tuple.localIp,
            port
        });
        const consumer=await this.createConsumer(producer,transport,this.router.rtpCapabilities,true);
        consumer.observer.on('close',()=>{
            transport.close();
        });
        if(consumer.type==='simulcast' && this._conf.simulcast && this._conf.simulcast.encodings){
            if(layer===-1){
                layer=this._conf.simulcast.encodings.length-1;
            }
            await consumer.setPreferredLayers({temporalLayer:layer,spatialLayer:layer});
        }
        return {port,consumer}
    }
    private launchChildProcess(options:string[], stdInData?:string, app:string=this._conf.ffmpeg.path):ChildProcess{
        console.log(app,options.join(' '));
        const p=spawn(app,options,{detached:false} as any);
        if(stdInData){
            console.log(stdInData);
            p.stdin.write(stdInData);
            p.stdin.end();
        }
        this._childProcesses.set(p.pid,p);
        p.stderr.on('data',(data)=>{
            console.log(data.toString());
        });
        /*p.stdout.on('data',(data)=>{
            console.log(data.toString());
        });*/
        p.on('exit',(code)=>{
            console.log(`exit ${code}`);
            this._childProcesses.delete(p.pid);
        });
        return p;
    }
    private static streamKindId(stream:string,kind:MediaKind){
        return [stream,kind].join(':');
    }
    private async getPipeTransports(api:IMediasoupApi,url:string):Promise<PipeTransports>{
        let pipeTransports = this._mapRouterPipeTransports.get(url);
        if(pipeTransports){
            if(pipeTransports===true){
                await new Promise(resolve=>{
                    const w=this._pipeTransportsWaiters.get(url);
                    if(w){
                        w.push(resolve);
                    }
                    else {
                        this._pipeTransportsWaiters.set(url,[resolve]);
                    }
                });
            }
            if(pipeTransports===true){
                throw {errorId:ERROR.INVALID_TRANSPORT}
            }
            return pipeTransports
        }
        else {
            const [local, remote] = await Promise.all(
                [
                    this.createPipeTransport(),
                    api.createPipeTransport()
                ]);

            await Promise.all(
                [
                    this.connectPipeTransport({...remote, transportId: local.pipeTransportId}),
                    api.connectPipeTransport({...local, transportId: remote.pipeTransportId}),
                ]);

            const localTransport=this._transports.get(local.pipeTransportId);
            if(localTransport){
                localTransport.observer.on('close', async () => {
                    this._mapRouterPipeTransports.delete(url);
                    await api.closeTransport({transportId: local.pipeTransportId});
                });
            }
            this._mapRouterPipeTransports.set(url,{local, remote});
            const waiters:(()=>void)[] | undefined = this._pipeTransportsWaiters.get(url);
            if(waiters) {
                while (waiters.length) {
                    const w=waiters.shift();
                    if(w){
                        w();
                    }
                }
                this._pipeTransportsWaiters.delete(url)
            }
            return {local, remote};
        }

    }
    async pushToServerOptions({kinds=['audio','video'],stream,listenIp=this._conf.pipeTransport.listenIp,bindPorts=false}:PushStreamOptionsRequest):Promise<PushStreamOptionsResponse> {
        const portsData:{[kind in MediaKind]?: PortData}={};
        for (const kind of kinds){
            const transport = await this.createPlainRtpTransport(listenIp,!bindPorts,false);
            if(!transport.rtcpTuple){
                throw {errorId: ERROR.INVALID_TRANSPORT,message:'No rtcpTuple'}
            }
            let port;
            const ssrc=kind==='audio'?11111111:22222222;
            const portData:PortData={
                payloadType:this._conf.codecParameters[kind].payloadType,
                ssrc, rtpPort:transport.tuple.localPort,rtcpPort:transport.rtcpTuple.localPort
            };
            if(bindPorts){
                port=await this._portHandler.allocate(transport.id,listenIp.toString());
                portData.bindRtpPort=port;
                portData.bindRtcpPort=port+1;
                await transport.connect({
                    ip: listenIp.toString(),
                    port: port,
                    rtcpPort: port+1
                });
            }
            const producer=await this.createPlainRtpProducer(transport,kind,ssrc);
            this.setProducerListeners(producer,stream,kind);
            this.setProducerIdByStream(stream,kind,producer.id);
            portsData[kind]=portData;
        }
        return {portsData,listenIp:listenIp.toString()};
    }
    async pushToServerInputs({options,kinds=['audio','video'],stream,listenIp=this._conf.pipeTransport.listenIp}:PushStreamInputsRequest):Promise<PushStreamInputsResponse> {
        const {portsData}=await this.pushToServerOptions({kinds,stream,listenIp});
        const tee:string[]=[];
        for (const kind in portsData){
            const {ssrc,rtpPort,rtcpPort,payloadType}= portsData[kind] as PortData;
            options.push(...this._conf.ffmpeg.encoding[kind]);
            tee.push(`[select=${kind.charAt(0)}:f=rtp:ssrc=${ssrc}:payload_type=${payloadType}]rtp://${listenIp.toString()}:${rtpPort}?rtcpport=${rtcpPort}`);
        }
        options.push('-f', 'tee', tee.join('|'));
        return {options};
    }
    async pullFromServerInputs({kinds=['audio','video'],stream,listenIp=this._conf.pipeTransport.listenIp,layer=-1}:PullStreamInputsRequest):Promise<PullStreamInputsResponse> {
        let sdp=this._conf.sdp.header.replace(/__IP__/g,listenIp.toString());
        let consumerIds={};
        for (const kind of kinds){
            const producerId = await this.producerIdByStream(stream, kind, false);
            if (producerId) {
                const producer = this._producers.get(producerId);
                if (producer) {
                    const {port, consumer} = await this.getStreamInputFromServer(producer,listenIp,layer);
                    if(kind==='video'){
                        const interval=setInterval(async ()=>{
                                if(consumer && !consumer.closed){
                                    await consumer.requestKeyFrame();
                                }
                                else{
                                    clearInterval(interval);
                                }
                            }
                            ,1000)
                    }
                    consumerIds[kind]=consumer.id;
                    sdp+=this._conf.sdp[kind].replace('__PORT__',port.toString());
                }
            }
        }
        return {sdp,consumerIds};
    }

}