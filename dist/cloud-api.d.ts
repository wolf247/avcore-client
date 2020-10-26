import { API_OPERATION } from './constants';
import { MediasoupSocketApi } from './mediasoup-socket-api';
export declare class CloudApi {
    private readonly url;
    private readonly token;
    constructor(url: string, token: string);
    create(operation: API_OPERATION): Promise<MediasoupSocketApi>;
    hlsUrl(pipeId: string): string;
}
