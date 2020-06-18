import {conf} from './config/conf';
import {createServer as createSecureServer} from 'https';
import {createServer} from 'http';
import {join as pathJoin} from 'path';
import * as express from 'express';
import * as cors from 'cors';
import * as console_stamp from 'console-stamp';
import {ACTION, API_OPERATION, API_OPERATION_BY_ACTION, ERROR, PATH, SOCKET_ACTIONS} from './config/constants';
import {MediasoupHandler} from './ms/mediasoup-handler';
import {FileUtils} from './utils/file-utils';
import {json as jsonBodyParser} from "body-parser";
import * as router from 'router';
import * as jwt from 'express-jwt';
import {sign as signToken,Algorithm} from 'jsonwebtoken';
import {PortUtils} from './utils/port-utils';
import {readFileSync} from "fs";
import  * as socketIO from "socket.io"
import  * as jwtAuth from "socketio-jwt-auth"
import {Socket} from 'socket.io';

console_stamp(console, '[HH:MM:ss.l]');
const fileHandler=new FileUtils(conf.mediasoup.recording.path);
fileHandler.init().then(()=> {
    const workers:MediasoupHandler[]=[];
    const portHandler=new PortUtils(conf.scalability.rtc.startingPort+conf.scalability.rtc.numPorts*conf.scalability.numWorkers);
    for (let i=0; i<conf.scalability.numWorkers; i++) {
        workers.push(new MediasoupHandler(i,workers,portHandler,fileHandler,{...conf.mediasoup, worker:{
                rtcMinPort: conf.scalability.rtc.startingPort+conf.scalability.rtc.numPorts*i,
                rtcMaxPort: conf.scalability.rtc.startingPort+conf.scalability.rtc.numPorts*(i+1)-1
            }}));
    }
    const app = express();
    app.use(cors());
    app.use(jsonBodyParser());
    app.use(router());
    const server = conf.ssl.enabled?createSecureServer({
        key: conf.ssl.key && readFileSync(conf.ssl.key),
        cert: conf.ssl.cert && readFileSync(conf.ssl.cert)
    },app):createServer(app);
    server.listen(conf.restPort, conf.restIp, () => {
        console.log(`Server is listening on port ${conf.restPort}`);
    });
    app.use(`/${PATH.RECORDINGS}`, express.static(conf.mediasoup.recording.path));
    app.use(express.static(pathJoin(__dirname, PATH.FRONT)));
    app.post(`/:workerIndex/${PATH.MEDIASOUP}/:action`, jwt({
        secret: conf.auth.secret,
        algorithm: conf.auth.algorithm
    }), async (req, res) => {
        const {action,workerIndex} = req.params;
        const auth = req['user'];
        console.info('got message', req['user'], action, JSON.stringify(req.body));
        let response = (data, status = 200) => {
            res.status(status).send(data);
            console.info('sent message', action, JSON.stringify(data));
        };
        let error = (errorId?: ERROR, error?) => {
            response(error, errorId)
        };
        const apiHandler=workers[workerIndex];
        if(!apiHandler){
            return error(ERROR.INVALID_WORKER);
        }
        if (action in API_OPERATION_BY_ACTION && parseInt(auth.operation) !== API_OPERATION_BY_ACTION[action]) {
            return error(ERROR.INVALID_OPERATION);
        }
        if (action === ACTION.CONSUME || action=== ACTION.PIPE_TO_REMOTE_PRODUCER) {
            if(req.body){
                req.body.localToken=signToken({
                    ...auth,
                    operation:API_OPERATION.PUBLISH
                }, conf.auth.secret, {algorithm: conf.auth.algorithm as Algorithm })
            }
        }
        try {
            const res = await apiHandler[req.params.action](req.body) || {};
            response(res);
        }
        catch (err) {
            if (err) {
                console.error(JSON.stringify(err));
            }
            error(err.errorId, err.message);
        }
    });
    app.post(`/${PATH.MEDIASOUP}/:action`, (req, res)=>{
        res.status(410).send({message:'Please use new api!!!'})
    });
    app.get(`/auth/:stream/:operation`, async (req, res) => {res.send(signToken({...req.params/* ,exp: Math.floor(Date.now() / 1000 + 12 * 24 * 3600)*/}, conf.auth.secret, {algorithm: conf.auth.algorithm as Algorithm }))});


    function socketLog(action,socket:Socket,...args){
        console.log(action,socket.id, socket.request.user,...args);
    }
    function socketError(action,socket:Socket,...args){
        console.error(action,socket.id, socket.request.user,...args);
    }

    const io = socketIO(server);
    io.use(jwtAuth.authenticate(conf.auth, function(payload, done) {
        return done(null, payload);
    }));
    io.on('connection',(socket:Socket)=>{
        socketLog('connected',socket,Object.keys(io.sockets.connected));
        for (const action of SOCKET_ACTIONS) {
            socket.on(action, async (json, callback) => {
                if (typeof json === 'string') {
                    json = JSON.parse(json);
                }
                socketLog('got message',socket,action, JSON.stringify(json));
                let response = (data) => {
                    if (!callback) {
                        socketError('no ackres',socket,action, JSON.stringify(data));
                        return;
                    }
                    callback(data);
                    socketLog('sent message',socket,action, JSON.stringify(data));
                };
                let error = (errorId: ERROR, error?) => {
                    response({errorId: errorId||ERROR.UNKNOWN, error: error})
                };
                try {
                    response(await workers[0][action](json));
                }
                catch (err) {
                    if (err) {
                        socketError('error',socket,action, JSON.stringify(err));
                    }
                    error(err.errorId, err.message);
                }

            });
        }
        socket.on('disconnecting', async ()=> {
            socketLog('disconnecting',socket);
        });
        socket.on('disconnect', async ()=> {
            socketLog('disconnected',socket,Object.keys(io.sockets.connected));
        });
    });
});
