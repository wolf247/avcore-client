import { ConferenceApi } from './conference-api';
import { API_OPERATION, ConferenceBasicInput } from 'avcore';
export declare class CloudClient {
    private readonly url;
    private readonly token;
    constructor(url: string, token: string);
    create(operation: API_OPERATION, stream: string, options?: ConferenceBasicInput): Promise<ConferenceApi>;
}
