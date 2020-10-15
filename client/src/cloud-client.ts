import {default as axios} from 'axios';
import {ConferenceApi} from './conference-api';
import {API_OPERATION,ConferenceBasicInput} from 'avcore';

export class CloudClient {
    static async create(cloudUrl:string,clientToken:string,stream:string,operation:API_OPERATION,options:ConferenceBasicInput={}) {
        const {data:{config}} =  await axios.post('/api/customer/config/sdk',{operation,stream},{
            headers: { 'Content-Type': 'application/json', "Authorization":`Bearer ${clientToken}` },
        });
        return new ConferenceApi({
            stream,
            ...options,
            ...config
        })
    }
}