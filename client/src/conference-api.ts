import {EventEmitter} from "events";
import {MediaKind, RtpCapabilities} from 'mediasoup-client/lib/RtpParameters';
import {Device} from 'mediasoup-client';
import {Transport, TransportOptions} from 'mediasoup-client/lib/Transport';
import {Producer, ProducerOptions} from 'mediasoup-client/lib/Producer';
import {Consumer} from 'mediasoup-client/lib/Consumer';
import {debug}  from 'debug';
import {
    API_OPERATION,
    ERROR,
    EVENT,
    MediasoupSocketApi,
    ConferenceConfig,
    ConferenceInput,
    ConsumeRequest,
    ConsumerLayers,
    IceSever,
    Simulcast
} from 'avcore';
import {SubscriptionLike} from 'rxjs/internal/types';

export declare interface ConferenceApi {
    on(event: 'bitRate', listener: ({bitRate:number,kind:MediaKind}) => void): this
    on(event: 'connectionstatechange', listener: ({state:string}) => void): this
    on(event: 'newTransportId', listener: ({id:string}) => void): this
    on(event: 'newProducerId', listener: ({id:string,kind:MediaKind}) => void): this
    on(event: 'newConsumerId', listener: ({id:string,kind:MediaKind}) => void): this
    on(event: 'addtrack', listener: (event:MediaStreamTrackEvent) => void): this
    on(event: 'removetrack', listener: (event:MediaStreamTrackEvent) => void): this
}
export class ConferenceApi extends EventEmitter{
    private api:MediasoupSocketApi;
    private readonly configs:ConferenceConfig;
    private readonly device:Device;
    private readonly connectors:Map<MediaKind,Consumer|Producer|number> = new Map();
    private readonly layers:Map<MediaKind,ConsumerLayers> = new Map();
    private readonly log:typeof console.log;
    private operation:API_OPERATION;
    private transport:Transport;
    private mediaStream?:MediaStream;
    private transportTimeout:ReturnType<typeof setTimeout>;
    private iceServers:IceSever[]|undefined;
    private simulcast:Simulcast|undefined;
    private disconnectSubscription:SubscriptionLike|undefined;
    constructor(configs:ConferenceInput){
        super();
        this.configs={
            worker:0,
            kinds:['video','audio'],
            maxIncomingBitrate:0,
            timeout:{
                stats: 1000,
                transport: 3000,
                consumer: 5000
            },
            ...configs
        };
        this.log=debug(`conference-api [${this.configs.stream}]:`);
        this.api=new MediasoupSocketApi(this.configs.url,this.configs.worker,this.configs.token,this.log);
        this.device = new Device();
    }
    async setPreferredLayers(layers:ConsumerLayers):Promise<void>{
        if(this.operation===API_OPERATION.SUBSCRIBE){
            const kind:MediaKind='video';
            this.layers.set(kind,layers);
            const consumer=this.connectors.get(kind);
            if(consumer && typeof consumer!=='number'){
                try {
                    await this.api.setPreferredLayers({consumerId: consumer.id, layers})
                }
                catch (e) {}
            }
        }
    }
    async addTrack(track:MediaStreamTrack):Promise<void>{
        this.log('addTrack',track);
        if(this.operation===API_OPERATION.PUBLISH && this.mediaStream){
            this.mediaStream.addTrack(track);
            this.emit("addtrack",new MediaStreamTrackEvent("addtrack",{track}));
            await this.publishTrack(track);
        }
    }
    async removeTrack(track:MediaStreamTrack):Promise<void>{
        this.log('removeTrack',track);
        if(this.operation===API_OPERATION.PUBLISH && this.mediaStream){
            this.mediaStream.removeTrack(track);
            this.emit("removetrack",new MediaStreamTrackEvent("removetrack",{track}));
            const producer=this.connectors.get(track.kind as MediaKind);
            if(producer && typeof producer!=='number'){
                producer.close();
                producer.emit('close');
            }
        }
    }
    async setMaxPublisherBitrate(bitrate:number):Promise<void>{
        this.configs.maxIncomingBitrate=bitrate;
        if(this.transport){
            await this.api.setMaxIncomingBitrate({transportId:this.transport.id,bitrate})
        }
    }
    async updateKinds(kinds:MediaKind[]):Promise<void>{
        if(this.operation===API_OPERATION.SUBSCRIBE){
            this.log('updateKinds', kinds);
            const oldKinds=this.configs.kinds;
            this.configs.kinds=kinds;
            for (const kind of oldKinds){
                if(!kinds.includes(kind)){
                   this.unsubscribeTrack(kind)
                }
            }
            const promises:Promise<void>[]=[];
            for (const kind of kinds) {
                if (!this.connectors.get(kind)) {
                    promises.push(this.subscribeTrack(kind));
                }
            }
            await Promise.all(promises);
        }
    }
    private async init(operation:API_OPERATION):Promise<void>{
        if(this.operation){
            throw new Error("Already processing")
        }
        this.operation=operation;
        if(!this.device.loaded){
            await this.api.initSocket();
            this.disconnectSubscription=this.api.client.listen('disconnect').subscribe(async ()=>{
                console.log('restarting by disconnect');
                this.api=new MediasoupSocketApi(this.configs.url,this.configs.worker,this.configs.token,this.log);
                await this.api.initSocket();
                await this.restartAll();
            });
            const {routerRtpCapabilities,iceServers,simulcast,timeout} = await this.api.getServerConfigs();
            if (routerRtpCapabilities.headerExtensions)
            {
                routerRtpCapabilities.headerExtensions = routerRtpCapabilities.headerExtensions.
                filter((ext) => ext.uri !== 'urn:3gpp:video-orientation');
            }
            await this.device.load({ routerRtpCapabilities });
            this.iceServers=iceServers;
            this.simulcast=simulcast;
            this.configs.timeout={...this.configs.timeout,...timeout}
        }
        await this.getTransport();

    }
    async publish(mediaStream:MediaStream):Promise<MediaStream>{
        await this.init(API_OPERATION.PUBLISH);
        this.mediaStream=mediaStream;
        await Promise.all(mediaStream.getTracks().map(track=>this.publishTrack(track)));
        return mediaStream;
    }
    async subscribe():Promise<MediaStream>{
        console.log('subscribe');
        await this.init(API_OPERATION.SUBSCRIBE);
        const mediaStream = this.mediaStream || new MediaStream();
        this.mediaStream=mediaStream;
        const {stream}=this.configs;
        const promises:Promise<boolean>[]=[];
        this.api.client.listen(EVENT.STREAM_STARTED)
            .subscribe(async ({stream,kind})=>{
                this.unsubscribeTrack(kind);
                console.log('on stream started',kind);
                if(this.configs.kinds.includes(kind)){
                    await this.subscribeTrack(kind);
                }
            });
        this.api.client.listen(EVENT.STREAM_STOPPED)
            .subscribe(async ({stream,kind})=>{
                console.log('on stream stopped',kind);
                this.unsubscribeTrack(kind);
            });
        let origin;
        if(this.configs.origin && (this.configs.url!==this.configs.origin.url || this.configs.worker!==this.configs.origin.worker)){
            const {token,worker,url}=this.configs;
            origin={
                target: {url, worker, token},
                source: {
                    url:this.configs.origin.url,
                    worker:this.configs.origin.worker,
                    token:this.configs.origin.token||token,
                }
            }
        }
        for (const kind of ['audio','video'] as MediaKind[]){
            promises.push(this.api.listenStreamStarted({stream,kind,origin}),this.api.listenStreamStopped({stream,kind}));
        }
        await Promise.all(promises);
        return mediaStream;
    }
    private unsubscribeTrack(kind:MediaKind):void {
        const connector=this.connectors.get(kind);
        if(connector){
            if(typeof connector!=='number'){
                connector.close();
                connector.emit('close');
            }
            else {
                this.connectors.delete(kind)
            }

        }
    }
    private async subscribeTrack(kind:MediaKind):Promise<void> {
        const d=Math.random();
        console.log('new connector',d);
        this.connectors.set(kind as MediaKind,d);
        const {stream}=this.configs;
        const api:ConferenceApi=this;
        const  rtpCapabilities:RtpCapabilities  = this.device.rtpCapabilities as RtpCapabilities;
        try{
            const consumeData:ConsumeRequest={ rtpCapabilities,stream,kind,transportId:this.transport.id};
            const data=await this.api.consume(consumeData);
            const layers=this.layers.get(kind);
            if(layers){
                try {
                    await this.api.setPreferredLayers({consumerId:data.id,layers})
                }
                catch (e) {}
            }
            const consumer=await this.transport.consume(data);
            consumer.on('close', async ()=>{
                if(this.mediaStream) {
                    consumer.track.stop();
                    this.mediaStream.removeTrack(consumer.track);
                    this.emit("removetrack",new MediaStreamTrackEvent("removetrack",{track:consumer.track}));
                }
                if(this.transport && !this.transport.closed){
                    const _consumer=this.connectors.get(kind);
                    try {
                        await this.api.closeConsumer({consumerId: consumer.id});
                    }catch (e) {}
                    if(_consumer && typeof _consumer!=='number' && consumer.id===_consumer.id){
                        this.connectors.delete(consumer.track.kind as MediaKind);
                    }
                }
            });
            if(this.connectors.get(kind as MediaKind)===d && this.configs.kinds.includes(kind)){
                this.connectors.set(kind as MediaKind,consumer);
                this.emit('newConsumerId',{id:consumer.id,kind});

                this.listenStats(consumer,'inbound-rtp');
                await api.api.resumeConsumer({consumerId: consumer.id});
                if(this.mediaStream){
                    this.mediaStream.addTrack(consumer.track);
                    this.emit("addtrack",new MediaStreamTrackEvent("addtrack",{track:consumer.track}));
                }
            }
            else {
                console.log('wrong connector',this.connectors.get(kind as MediaKind));
                this.unsubscribeTrack(kind)
            }
        }
        catch (e) {
            if(e){
                if(e.errorId===ERROR.INVALID_STREAM){
                }
                else if(e.errorId===ERROR.INVALID_TRANSPORT){
                    this.restartAll().then(()=>{}).catch(()=>{});
                }
                else {
                    throw e;
                }
            }

        }
    }
    private async publishTrack(track:MediaStreamTrack):Promise<void>{
        const kind:MediaKind=track.kind as MediaKind;
        if(this.configs.kinds.includes(kind)){
            track.addEventListener('ended', async ()=>{
                await this.removeTrack(track);
            });

            const params:ProducerOptions = { track, stopTracks:this.configs.stopTracks };
            if (this.configs.simulcast && kind==='video' && this.simulcast) {
                if(this.simulcast.encodings){
                    params.encodings = this.simulcast.encodings;
                }
                if(this.simulcast.codecOptions){
                    params.codecOptions=this.simulcast.codecOptions
                }
            }
            const producer=await this.transport.produce(params);
            producer.on('close', async ()=>{
                const producer=this.connectors.get(kind);
                if(producer && typeof producer!=='number'){
                    this.connectors.delete(kind);
                    try {
                        await this.api.closeProducer({producerId:producer.id});
                    }
                    catch (e) {}
                }
            });

            this.listenStats(producer,'outbound-rtp');
            this.connectors.set(kind,producer);
            this.emit('newProducerId',{id:producer.id,kind});
        }
    }
    private listenStats(target:Consumer|Producer,type:"inbound-rtp"|"outbound-rtp"):void{
        let lastBytes=0;
        let lastBytesTime=Date.now();
        const bytesField=type==='inbound-rtp'?'bytesReceived':'bytesSent';
        target.on('close',()=>{
            this.emit('bitRate', {bitRate: 0, kind: target.kind});
        });
        const getStats = () => {
            if (target && !target.closed) {
                target.getStats().then(async stats => {
                    if (target && !target.closed) {
                        if(stats['size']) {
                            stats.forEach((s) => {
                                if (s && s.type === type) {
                                    if (s[bytesField] && s[bytesField] > lastBytes) {
                                        const bitRate=Math.round((s[bytesField]-lastBytes)/(Date.now()-lastBytesTime)*1000*8);
                                        this.emit('bitRate',{bitRate,kind:target.kind});
                                        lastBytes = s[bytesField];
                                        lastBytesTime=Date.now();
                                    }
                                }
                            });
                        }
                        else{
                            this.emit('bitRate',{bitRate:0,kind:target.kind});
                        }
                        setTimeout(getStats, this.configs.timeout.stats);
                    }

                });
            }
        };
        getStats();
    }
    async close(hard=true){
        if(this.transport){
            if(!this.transport.closed){
                this.transport.close();
            }
            const transportId=this.transport.id;
            delete this.transport;
            try {
                await this.api.closeTransport({transportId});
            }
            catch (e) {}
            this.emit('connectionstatechange',{state:'disconnected'});
        }
        if((hard || this.operation===API_OPERATION.SUBSCRIBE) && this.mediaStream && this.configs.stopTracks){
            this.mediaStream.getTracks().forEach(function(track) {
                track.stop();
            });
        }
        await this.closeConnectors();
        delete this.operation;
        if(hard && this.disconnectSubscription){
            this.disconnectSubscription.unsubscribe();
        }
        this.api.clear();
    }
    private async closeConnectors():Promise<void>{
        if(this.connectors.size){
            await new Promise(resolve=>{
                this.connectors.forEach((connector,kind)=>{
                    this.connectors.delete(kind);
                    try {
                        if(connector && typeof connector!=='number'){
                            connector.close();
                            connector.emit('close');
                        }
                    }
                    catch (e) {}
                    if(!this.connectors.size){
                        resolve();
                    }
                });
            });
        }

    }
    private async restartAll():Promise<void>{
        const operation=this.operation;
        await this.close(operation===API_OPERATION.SUBSCRIBE);
        if(operation===API_OPERATION.SUBSCRIBE){
            await this.subscribe()
        }
        else if(operation===API_OPERATION.PUBLISH && this.mediaStream){
            await this.publish(this.mediaStream)
        }
    }
    private async getTransport():Promise<Transport>{
        if(!this.transport){
            const api:ConferenceApi=this;
            const data:TransportOptions = await this.api.createTransport();
            if(this.iceServers){
                data.iceServers=this.iceServers;
            }
            if(this.operation===API_OPERATION.SUBSCRIBE){
                this.transport = this.device.createRecvTransport(data);
            }
            else  if(this.operation===API_OPERATION.PUBLISH){
                this.transport = this.device.createSendTransport(data);
            }
            this.emit('newTransportId',{id:this.transport.id});
            if(this.configs.maxIncomingBitrate){
                await this.api.setMaxIncomingBitrate({transportId:this.transport.id,bitrate:this.configs.maxIncomingBitrate})

            }
            this.transport.on('connect', ({ dtlsParameters }, callback, errback) => {
                api.api.connectTransport({
                    transportId: this.transport.id,
                    dtlsParameters
                }).then(callback).catch(errback);
            });
            if(this.operation===API_OPERATION.PUBLISH){
                this.transport.on('produce', async ({ kind, rtpParameters }, callback, errback) => {
                    try {
                        const data=await api.api.produce({
                            transportId: this.transport.id,
                            stream:api.configs.stream,
                            kind,
                            rtpParameters
                        });
                        callback(data);
                    } catch (err) {
                        errback(err);
                    }
                });
            }
            this.transport.on('connectionstatechange', async (state) => {
                this.emit('connectionstatechange',{state});
                switch (state) {
                    case 'connected':
                        if(this.transportTimeout){
                            clearTimeout(this.transportTimeout)
                        }
                        break;
                    case 'failed':
                    case 'disconnected':
                        break;

                }
            });
        }
        return this.transport;
    }
}