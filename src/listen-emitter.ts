import {EventEmitter} from 'events';
import {IMediasoupApiClient} from './i-mediasoup-api';
import {Observable, Observer, TeardownLogic} from 'rxjs/index';

export class ListenEmitter extends EventEmitter implements IMediasoupApiClient{
    listen<T>(action: string): Observable<T> {
        return new Observable((observer: Observer<T>) => {
            function callback(message: T): void {
                if (process.env.NODE_ENV !== 'production') {
                    console.log(`RxSocketClient::listen: "${action}" callback`, message);
                }

                observer.next(message);
            }

            this.on(action, callback);

            return {
                unsubscribe: (): void => {
                    if (process.env.NODE_ENV !== 'production') {
                        console.log(`RxSocketClient::listen: "${action}" unsubscribe`);
                    }

                    this.off(action, callback);
                },
            } as TeardownLogic;
        });
    }
}