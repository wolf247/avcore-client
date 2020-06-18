import {Utils} from './utils';
import {ConferenceApi} from './conference-api';
import {ERROR} from '../../config/constants';
import * as debug  from 'debug';
// import {MediasoupRestApi} from './mediasoup-rest-api';
import {MediasoupSocketApi} from './mediasoup-socket-api';
(window as any).debug=debug;

(window as any).Utils=Utils;
(window as any).ConferenceApi=ConferenceApi;
(window as any).ERROR=ERROR;
(window as any).MediasoupRestApi=MediasoupSocketApi;
(window as any).MediasoupSocketApi=MediasoupSocketApi;

