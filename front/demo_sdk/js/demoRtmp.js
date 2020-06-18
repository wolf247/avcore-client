(async function () {
    function getParameterByName(name, url) {
        if (!url) url = window.location.href;
        name = name.replace(/[\[\]]/g, "\\$&");
        const regex = new RegExp("[?&]" + name + "(=([^&#]*)|&|#|$)"),
            results = regex.exec(url);
        if (!results) return null;
        if (!results[2]) return '';
        return decodeURIComponent(results[2].replace(/\+/g, " "));
    }

    const {ConferenceApi,Utils,ERROR,MediasoupRestApi}=window;
    const $ = document.querySelector.bind(document);
    const $$ = document.querySelectorAll.bind(document);
    const streamTable=$('#streamTable');
    let playback;
    const token="eyJhbGciOiJIUzUxMiIsInR5cCI6IkpXVCJ9.eyJzdHJlYW0iOiJzdHJlYW0xIiwib3BlcmF0aW9uIjoiMyIsImlhdCI6MTU5MDE0NjUyNn0.t5cA373_vhP3f1h5zH8sGYuA-C3sjzK5cOVeT5OJdSMXLKo12qvX9sXqcIvaptcjdXi0yKmCUn0SV6GpDxjAbA";
    const stream= "stream1";
    const v=$('#playback-video');
    const vbr=$(`#video-bit-rate`);
    const abr=$(`#audio-bit-rate`);
    const connectionBox=$('#connection-box');
    const conferenceIds={};
    const restApi=new MediasoupRestApi(`${location.protocol}//${location.host}/0`,token);
    $('#subscribe').addEventListener('click', async (event)=> {
        $('#subscribe').disabled=true;
        event.preventDefault();
        let isError=false;
        try{
            await restApi.stopFileStreaming({stream});
            const rtmpUrl = getParameterByName('rtmpUrl')||
            'rtmp://127.0.0.1/live/test';
            const {kinds}=await restApi.kindsByFile({filePath:rtmpUrl});
            //const kinds=['audio','video'];
            await restApi.rtmpStreaming({kinds,stream,rtmpUrl,videoBitrate:'4000'});
            playback = new ConferenceApi({
                stream,
                token,
                kinds
            }).on('bitRate',({bitRate,kind})=>{
                if(kind==='video'){
                    vbr.innerText='V '+Math.round(bitRate).toString();
                    if(bitRate>0){
                        vbr.classList.add('connected');
                    }
                    else {
                        vbr.classList.remove('connected');
                    }
                }
                if(kind==='audio'){
                    abr.innerText='A '+Math.round(bitRate).toString();
                    if(bitRate>0){
                        abr.classList.add('connected');
                    }
                    else {
                        abr.classList.remove('connected');
                    }
                }
            }).on('connectionstatechange',({state})=>{
                console.log('connectionstatechange',state);
                if(state==='connected'){
                    connectionBox.classList.add('connected');
                }
                else {
                    connectionBox.classList.remove('connected');
                }
            }).on('newConsumerId',({id,kind})=>{
                conferenceIds[kind]=id;
                console.log('newConsumerId',id,kind);
            });
            const play = () => {
                console.log('trying to play');
                let playPromise = v.play();
                if (playPromise !== undefined) {
                    playPromise.then(_ => {
                    }).catch(error => {
                        v.muted = true;
                        v.play().then(() => {
                            console.log('errorAutoPlayCallback OK');
                        }, (error) => {
                            console.log('errorAutoPlayCallback error again');
                        });
                    });
                }
            };
            const mediaStream = await playback.subscribe();
            v.srcObject = mediaStream;
            if (Utils.isSafari) {
                const onStreamChange = () => {
                    v.srcObject = new MediaStream(mediaStream.getTracks());
                    play();
                };
                mediaStream.addEventListener('addtrack', onStreamChange);
                mediaStream.addEventListener('removetrack', onStreamChange);
            }
            else if (Utils.isFirefox) {
                v.addEventListener('pause', play)
            }

            play();
            await new Promise(resolve => setTimeout(resolve,2000));
        }
        catch (e) {
            isError=true;
            if (e && ERROR[e.errorId]) {
                alert(ERROR[e.errorId])
            }
            console.log(e);
            if (playback) {
                await playback.close();
            }

        }
        if (!isError) {
            $('#stop-playing').disabled = false;
            $('#request-keyframe').disabled=false;
        }
    });

    $('#stop-playing').addEventListener('click',async function (event) {
        event.preventDefault();
        if (playback) {
            await playback.close();
        }
        await restApi.stopFileStreaming({stream});
        $('#request-keyframe').disabled=true;
        $('#stop-playing').disabled=true;
        $('#subscribe').disabled=false;
    });
    $('#request-keyframe').addEventListener('click',async function (event) {
        event.preventDefault();
        if (conferenceIds['video']) {
            await restApi.requestKeyframe({consumerId:conferenceIds['video']})
        }
    });
})();
