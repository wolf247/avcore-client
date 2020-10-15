import {default as axios} from 'axios';
import {API_OPERATION} from './constants';
import {MediasoupSocketApi} from './mediasoup-socket-api';

export class CloudApi {
    static async create(cloudUrl:string,clientToken:string,operation:API_OPERATION,log?:typeof console.log ) {
        const {data:{config:{url, worker, token}}} =  await axios.post(`${cloudUrl}/api/customer/config/api`,{operation:API_OPERATION.MIXER},{
            headers: { 'Content-Type': 'application/json', "Authorization":`Bearer ${clientToken}` },
        });
        return new MediasoupSocketApi(url, worker, token, log)
    }
}