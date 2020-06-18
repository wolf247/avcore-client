import {mkdir, readdir, stat, unlink} from "fs";
import {join} from 'path';
export class FileUtils {
    private readonly root:string;
    private readonly separator:string;
    private readonly prefixRegex:RegExp;
    private readonly files:string[];

    constructor(root:string,separator='_'){
        this.root=root;
        this.separator=separator;
        this.prefixRegex=new RegExp(`^(.+)${this.separator}.+${this.separator}[0-9]+\.`);
        this.files=[];
    }
    async init():Promise<void>{
        await FileUtils.makeDirIfNotExists(this.root);
        this.files.push(...await FileUtils.readdirPromise(this.root))
    }
    listByPrefix(prefix:string):string[] {
        const regex=new RegExp(`^${prefix}${this.separator}.+${this.separator}[0-9]+\.`);
        return this.files.filter(f=>regex.test(f));
    }
    listPrefixes():string[] {
        const {prefixRegex}=this;
        return this.files.reduce(function(list, file) {
            const prefixMatch=file.match(prefixRegex);
            if(prefixMatch){
                const prefix:string|undefined=prefixMatch[1];
                if (prefix && !list.includes(prefix)) {
                    list.push(prefix)
                }
            }
            return list;
        }, [] as string[])
    }
    async pushFile(file:string):Promise<void> {
        if(!this.files.includes(file) && await FileUtils.existPromise(join(this.root,file))){
            this.files.push(file)
        }
    }
    async deleteFile(file:string):Promise<void> {
        if(this.files.includes(file)){
            await FileUtils.unlinkPromise(join(this.root,file));
            this.files.splice(this.files.indexOf(file),1)
        }
    }
    async deleteByPrefix(prefix:string):Promise<void> {
        const regex=new RegExp(`^${prefix}${this.separator}.+${this.separator}[0-9]+\.`);
        await Promise.all(this.files.filter(f=>regex.test(f)).map(f=>this.deleteFile(f)));
    }
    static unlinkPromise(filePath):Promise<void> {
        return new Promise((resolve) => {
            unlink(filePath, () => {
                resolve()
            })
        });
    }
    static existPromise(filePath):Promise<boolean> {
        return new Promise((resolve, reject) => {
            stat(filePath, (err, stats) => {
                resolve(!err && !!stats)
            })
        });
    }
    static makeDirIfNotExists(dirPath):Promise<void> {
        return new Promise((resolve, reject) => {
            stat(dirPath, (err, stats) => {
                if (!err && !!stats) {
                    resolve()
                }
                else {
                    mkdir(dirPath, {recursive: true}, (err) => {
                        if (err) {
                            reject(err)
                        }
                        resolve()
                    })
                }
            })
        });
    }
    static readdirPromise(dirPath):Promise<string[]> {
        return new Promise((resolve, reject) => {
            readdir(dirPath, (err,files) => {
                if (err) {
                    reject(err)
                }
                resolve(files)
            })


        });
    }
}