import {TELEPHONY} from './constants';

export class NexmoUtils {
    static pinCodeChoice(maxDigits:number,eventUrl:string,text:string="Please, enter active pin code."){
        return [
            {
                "action": "talk",
                text,
                "bargeIn": true
            },
            {
                "action": "input",
                maxDigits,
                "timeOut": 10,
                "eventUrl": [eventUrl]
            }]
    }
    static pinCodeChoiceRepeat(text:string="Sorry, this pin code is invalid.",maxDigits:number,eventUrl:string,pinCodeChoiceText?:string){
        return [
            {
                "action": "talk",
                text
            },
            ...NexmoUtils.pinCodeChoice(maxDigits,eventUrl,pinCodeChoiceText)]
    }
    static mixerConnect(url:string, worker:number, mixerId:string){
        return [
            {
                "action": "talk",
                "text": 'Connecting to meeting. Please, wait.'
            },
            {
                "action": "connect",
                "endpoint": [
                    {
                        "type": "websocket",
                        "uri": `${url.replace('http','ws')}/${TELEPHONY.NEXMO}`,
                        "content-type": "audio/l16;rate=16000",
                        "headers": {
                            mixerId
                        }
                    }
                ]
            }]
    }
}