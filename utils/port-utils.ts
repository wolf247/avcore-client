import * as portfinder from 'portfinder';
export class PortUtils {
    private readonly _minPort;
    private readonly _portIndexes:string[]=[];
    constructor(minPort:number){
        this._minPort=minPort;

    }
    async allocate(id:string,host:string):Promise<number>{
        let minIndex=0;
        while (true){
            const index=this.findMinIndex(minIndex);
            this._portIndexes[index]=id;
            const port=this._minPort + 2*index;
            const _port=await portfinder.getPortPromise({
                port, host
            });
            if(port===_port){
                console.log('allocate',id,port);
                return port

            }
            else {
                delete this._portIndexes[index];
                minIndex=index+1
            }
        }
    }
    release(id:string):void{
        this._portIndexes.filter(_id=>_id===id).forEach((id,index)=>{
            console.log('release',id,this._minPort + index);
            delete this._portIndexes[index]
        });
    }
    private findMinIndex(minIndex=0):number {
        for(let i=minIndex;i<this._portIndexes.length;i++){
            if(!this._portIndexes[i]){
                return i;
            }
        }
        return this._portIndexes.length;
    }
}