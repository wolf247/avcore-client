import { API_OPERATION } from './constants';
import { MediasoupSocketApi } from './mediasoup-socket-api';
export declare class CloudApi {
    static create(cloudUrl: string, clientToken: string, operation: API_OPERATION, log?: typeof console.log): Promise<MediasoupSocketApi>;
}
