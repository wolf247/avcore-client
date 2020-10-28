import {default as axios} from 'axios';
import {API_OPERATION} from './constants';
import {MediasoupSocketApi} from './mediasoup-socket-api';
import {ConsumeRequestOriginData} from './client-interfaces';
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
    async streamOrigin(api:MediasoupSocketApi,stream:string):Promise<ConsumeRequestOriginData|undefined>{
        const {data:{config:{url, worker, token}}} =  await axios.post(`${this.url}/api/customer/config/api`,{operation:API_OPERATION.PUBLISH},{
            headers: { 'Content-Type': 'application/json', "Authorization":`Bearer ${this.token}` },
        });
        return api.streamOrigin({url, worker, token});
    }
}