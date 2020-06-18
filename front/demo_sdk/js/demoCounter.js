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
    const idStr=getParameterByName('id');
    const numServers=2;
    const workerPerServer=4;
    let id = idStr==='random'?Math.floor(Math.random()*numServers*workerPerServer):parseInt(idStr||'0')||0;
    console.log(`Using worker #${id}`);
    const {ConferenceApi,Utils,ERROR}=window;
    const $ = document.querySelector.bind(document);
    const $$ = document.querySelectorAll.bind(document);
    let playback;
    let socket;
    const audioPublish=$('#audioPublish');
    const videoPublish=$('#videoPublish');
    const connectionBox=$('#connection-box');
    $$('.publish-checkbox').forEach(b=>b.addEventListener('change',async (event)=> {
        if(playback){
            const kinds=[];
            if(audioPublish.checked){
                kinds.push('audio')
            }
            if(videoPublish.checked){
                kinds.push('video')
            }
            await playback.updateKinds(kinds);
        }
        else {
            $$('.capture-button').forEach(b=>b.disabled=(!audioPublish.checked && !videoPublish.checked));
        }
    }));
    const conferenceIds={};
    $('#get-stats').addEventListener('click', async (event)=> {
        if(playback){
            const ids=[];
            if(audioPublish.checked && conferenceIds['audio']){
                ids.push( conferenceIds['audio'])
            }
            if(videoPublish.checked && conferenceIds['video']){
                ids.push(conferenceIds['video'])
            }
            if(ids.length){
                console.log(await playback['api'].consumersStats({ids}))
            }
        }
    });
    $('#subscribe').addEventListener('click', async (event)=> {
        $('#subscribe').disabled=true;
        event.preventDefault();

        const br=$(`#playback-video-bit-rate`);
        const urlBox=$(`#url-box`);
        try {
            const kinds=[];
            if(audioPublish.checked){
                kinds.push('audio')
            }
            if(videoPublish.checked){
                kinds.push('video')
            }
            let origin;
            const hostNum=1+id%2;
            const workerNum=Math.floor(id/2);
            if(id>0 ){
                origin={
                    url: `${location.protocol}//${location.host.replace(/-[0-9]/,'-1')}/0`,
                }
            }
            const url=`${location.protocol}//${location.host.replace(/-[0-9]/,`-${hostNum}`)}/${workerNum}`;
            urlBox.innerText=url;
            playback = new ConferenceApi({
                kinds,
                url,
                origin,
                token: "eyJhbGciOiJIUzUxMiIsInR5cCI6IkpXVCJ9.eyJzdHJlYW0iOiJzdHJlYW0xIiwib3BlcmF0aW9uIjoiMSIsImlhdCI6MTU4OTUzNDEzOX0.MsLz3ctklftdSHiNYReabdNVWr_7vW3-rPZ1jTssxguEo6SS4jLFbVu16v9NeLKzNEf1e6PVDmYN8je9GcBZXw",
                stream: `stream1`
            }).on('bitRate',({bitRate,kind})=>{
                if(kind==='video'){
                    br.innerText=Math.round(bitRate).toString();
                    if(bitRate>0){
                        br.classList.add('connected');
                    }
                    else {
                        br.classList.remove('connected');
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
            const v=$('#playback-video');
            const play=()=>{
                console.log('trying to play');
                let playPromise = v.play();
                if (playPromise !== undefined) {
                    playPromise.then(_ => {
                    }).catch(error => {
                        v.muted=true;
                        v.play().then(()=>{
                            console.log('errorAutoPlayCallback OK');
                        },(error)=>{
                            console.log('errorAutoPlayCallback error again');
                        });
                    });
                }
            };
            const mediaStream=await playback.subscribe();
            v.srcObject=mediaStream;
            if(Utils.isSafari){
                const onStreamChange=()=>{
                    v.srcObject=new MediaStream(mediaStream.getTracks());
                    play();
                };
                playback
                    .on('addtrack',onStreamChange)
                    .on('removetrack',onStreamChange);
            }
            else if(Utils.isFirefox){
                v.addEventListener('pause',play)
            }

            play();
            socket=io('https://tabrecorder.codeda.com');
            socket.on('roomSize',({size})=>{
                connectionBox.innerText=size;
            });
            socket.emit('streamJoin',{roomId:"stream1"},()=>{

            });
            $('#stop-playing').disabled=false;
            $('#pause-unpause').disabled=false;
            $('#get-stats').disabled=false;

        }
        catch (e) {
            if(e && ERROR[e.errorId]){
                alert(ERROR[e.errorId])
            }
            console.log(e);
            if(playback){
                await playback.close();
            }

        }
    });

    $('#stop-playing').addEventListener('click', function (event) {
        event.preventDefault();
        if(playback) {
            playback.close();
            $('#stop-playing').disabled=true;
            $('#pause-unpause').disabled=true;
            $('#subscribe').disabled=false;
            $('#get-stats').disabled=true;
        }
        if(socket){
            socket.close();
        }
    });
    $('#pause-unpause').addEventListener('click', async function (event) {
        event.preventDefault();
        if(playback) {
            this.disabled=true;
            await playback.pause();
            await new Promise(resolve => setTimeout(resolve,500));
            await playback.resume();
            this.disabled=false;

        }
    });
})();