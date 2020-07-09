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
    static pinCodeChoiceRepeat(maxDigits:number,eventUrl:string,text:string="Sorry, this pin code is invalid.",pinCodeChoiceText?:string){
        return [
            {
                "action": "talk",
                text
            },
            ...NexmoUtils.pinCodeChoice(maxDigits,eventUrl,pinCodeChoiceText)]
    }
    static mixerConnect(url:string, headers:{worker:number, mixerId:string, stream:string}, text:string='Connecting to meeting. Please, wait.'){
        return [
            {
                "action": "talk", text
            },
            {
                "action": "connect",
                "endpoint": [
                    {
                        "type": "websocket",
                        "uri": `${url.replace('http','ws')}/${TELEPHONY.NEXMO}`,
                        "content-type": "audio/l16;rate=16000",
                        headers
                    }
                ]
            }]
    }
}