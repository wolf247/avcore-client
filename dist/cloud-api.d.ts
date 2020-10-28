import { API_OPERATION } from './constants';
import { MediasoupSocketApi } from './mediasoup-socket-api';
import { ConsumeRequestOriginData } from './client-interfaces';
export declare class CloudApi {
    private readonly url;
    private readonly token;
    constructor(url: string, token: string);
    create(operation: API_OPERATION): Promise<MediasoupSocketApi>;
    streamOrigin(api: MediasoupSocketApi, stream: string): Promise<ConsumeRequestOriginData | undefined>;
}
