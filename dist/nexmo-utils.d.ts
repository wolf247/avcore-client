export declare class NexmoUtils {
    static pinCodeChoice(maxDigits: number, eventUrl: string, text?: string): ({
        action: string;
        text: string;
        bargeIn: boolean;
        maxDigits?: undefined;
        timeOut?: undefined;
        eventUrl?: undefined;
    } | {
        action: string;
        maxDigits: number;
        timeOut: number;
        eventUrl: string[];
        text?: undefined;
        bargeIn?: undefined;
    })[];
    static pinCodeChoiceRepeat(maxDigits: number, eventUrl: string, text?: string, pinCodeChoiceText?: string): ({
        action: string;
        text: string;
        bargeIn: boolean;
        maxDigits?: undefined;
        timeOut?: undefined;
        eventUrl?: undefined;
    } | {
        action: string;
        maxDigits: number;
        timeOut: number;
        eventUrl: string[];
        text?: undefined;
        bargeIn?: undefined;
    } | {
        action: string;
        text: string;
    })[];
    static mixerConnect(url: string, worker: number, mixerId: string, text?: string): ({
        action: string;
        text: string;
        endpoint?: undefined;
    } | {
        action: string;
        endpoint: {
            type: string;
            uri: string;
            "content-type": string;
            headers: {
                mixerId: string;
            };
        }[];
        text?: undefined;
    })[];
}
