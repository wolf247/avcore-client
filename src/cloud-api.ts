import {default as axios} from 'axios';
import {API_OPERATION, HLS} from './constants';
import {MediasoupSocketApi} from './mediasoup-socket-api';
export class CloudApi {
    private readonly url;
    private readonly token;
    constructor(url:string,token:string) {
        this.url=url;
        this.token=token;
    }
    async create(operation:API_OPERATION):Promise<MediasoupSocketApi> {
        const {data:{config:{url, worker, token}}} =  await axios.post(`${this.url}/api/customer/config/api`,{operation},{
            headers: { 'Content-Type': 'application/json', "Authorization":`Bearer ${this.token}` },
        });
        return new MediasoupSocketApi(url, worker, token)
    }
    hlsUrl(pipeId:string){
        return `${this.url}/${HLS.ROOT}/${pipeId}/${HLS.PLAYLIST}`
    }
}