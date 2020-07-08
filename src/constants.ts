export enum ACTION {
    GET_SERVER_CONFIGS='getServerConfigs',
    CREATE_TRANSPORT='createTransport',
    CONNECT_TRANSPORT='connectTransport',
    CLOSE_TRANSPORT='closeTransport',
    PRODUCE='produce',
    CONSUME='consume',
    RESUME_CONSUMER='resumeConsumer',
    PAUSE_CONSUMER='pauseConsumer',
    CLOSE_CONSUMER='closeConsumer',
    RESUME_PRODUCER='resumeProducer',
    PAUSE_PRODUCER='pauseProducer',
    CLOSE_PRODUCER='closeProducer',
    FILE_STREAMING='fileStreaming',
    LIVE_STREAMING='liveStreaming',
    STOP_FILE_STREAMING='stopFileStreaming',
    START_RECORDING="startRecording",
    STOP_RECORDING="stopRecording",
    CREATE_PIPE_TRANSPORT='createPipeTransport',
    CONNECT_PIPE_TRANSPORT='connectPipeTransport',
    SET_PREFERRED_LAYERS="setPreferredLayers",
    SET_MAX_INCOMING_BITRATE='setMaxIncomingBitrate',
    PRODUCERS_STATS='producersStats',
    CONSUMERS_STATS='consumersStats',
    TRANSPORT_STATS='transportStats',
    PIPE_TO_REMOTE_PRODUCER='pipeToRemoteProducer',
    PIPE_FROM_REMOTE_PRODUCER='pipeFromRemoteProducer',
    WORKER_LOAD='workerLoad',
    NUM_WORKERS='numWorkers',
    RECORDED_STREAMS='recordedStreams',
    STREAM_RECORDINGS='streamRecordings',
    DELETE_STREAM_RECORDINGS='deleteStreamRecordings',
    DELETE_RECORDING='deleteRecording',
    PUSH_TO_SERVER_INPUTS='pushToServerInputs',
    PULL_FROM_SERVER_INPUTS='pullFromServerInputs',
    PUSH_TO_SERVER_OPTIONS='pushToServerOptions',
    PUSH_TO_SERVER='pushToServer',
    KINDS_BY_FILE='kindsByFile',
    REQUEST_KEYFRAME='requestKeyframe',
    LISTEN_STREAM_STARTED='listenStreamStarted',
    LISTEN_STREAM_STOPPED='listenStreamStopped',
    MIXER_START='mixerStart',
    MIXER_CLOSE='mixerClose',
    MIXER_ADD='mixerAdd',
    MIXER_REMOVE='mixerRemove',
    MIXER_UPDATE='mixerUpdate',
    MIXER_PIPE_START='mixerPipeStart',
    MIXER_PIPE_STOP='mixerPipeStop'
}
export enum EVENT {
    STREAM_STARTED='streamStarted',
    STREAM_STOPPED='streamStopped'
}
export enum STAT {
    STATS="stats",
    TRAFFIC='traffic',
    CPU='cpu'
}
export enum ERROR {UNKNOWN=500,UNAUTHORIZED=401,INVALID_TRANSPORT=530,INVALID_PRODUCER=531,INVALID_CONSUMER=532,INVALID_STREAM=533,INVALID_OPERATION=534,INVALID_WORKER=535,INVALID_INPUT=536}
export enum API_OPERATION {SUBSCRIBE,PUBLISH,RECORDING,STREAMING,MIXER}
export enum MIXER_PIPE_TYPE {LIVE,RECORDING,RTMP}