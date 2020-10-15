import { ConferenceApi } from './conference-api';
import { API_OPERATION, ConferenceBasicInput } from 'avcore';
export declare class CloudClient {
    static create(cloudUrl: string, clientToken: string, stream: string, operation: API_OPERATION, options?: ConferenceBasicInput): Promise<ConferenceApi>;
}
