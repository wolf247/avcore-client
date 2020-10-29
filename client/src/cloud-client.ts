import {default as axios} from 'axios';
import {ConferenceApi} from './conference-api';
import {API_OPERATION,ConferenceBasicInput} from 'avcore';
export class CloudClient {
    private readonly url;
    private readonly token;
    constructor(url:string,token:string) {
        this.url=url;
        this.token=token;
    }
    async create(operation:API_OPERATION,stream:string,options:ConferenceBasicInput={}):Promise<ConferenceApi> {
        const {data:{config}} =  await axios.post(`${this.url}/api/customer/config/sdk`,{operation,stream},{
            headers: { 'Content-Type': 'application/json', "Authorization":`Bearer ${this.token}` },
        });
        return new ConferenceApi({
            stream,
            ...options,
            ...config
        })    }
}