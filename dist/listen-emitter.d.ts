/// <reference types="node" />
import { EventEmitter } from 'events';
import { IMediasoupApiClient } from './i-mediasoup-api';
import { Observable } from 'rxjs/index';
export declare class ListenEmitter extends EventEmitter implements IMediasoupApiClient {
    listen<T>(action: string): Observable<T>;
}
