

(function () {
    "use strict";
    const {ConferenceApi,Utils,ERROR}=window;
    const $ = document.querySelector.bind(document);
    const $$ = document.querySelectorAll.bind(document);
    const audioPublish=$('#audioPublish');
    const videoPublish=$('#videoPublish');
    let playback;
    $('#subscribe').addEventListener('click', async (event)=> {
        $('#subscribe').disabled=true;
        event.preventDefault();
        const br=$(`#playback-video-bit-rate`);
        const connectionBox=$('#connection-box');
        try {
            const kinds=[];
            if(audioPublish.checked){
                kinds.push('audio')
            }
            if(videoPublish.checked){
                kinds.push('video')
            }
            playback = new ConferenceApi({
                kinds,
                stream: "stream1",
                token: "eyJhbGciOiJIUzUxMiIsInR5cCI6IkpXVCJ9.eyJzdHJlYW0iOiJzdHJlYW0xIiwib3BlcmF0aW9uIjoiMSIsImlhdCI6MTU4OTUzNDEzOX0.MsLz3ctklftdSHiNYReabdNVWr_7vW3-rPZ1jTssxguEo6SS4jLFbVu16v9NeLKzNEf1e6PVDmYN8je9GcBZXw"
            });
            const v=$('#playback-video');
            const play=()=>{
                console.log('trying to play');
                let playPromise = v.play();
                if (playPromise !== undefined) {
                    playPromise.then(_ => {
                    }).catch(error => {
                        v.muted=true;
                        $('#unmute-playback-video').disabled=false;
                        v.play().then(()=>{
                            console.log('errorAutoPlayCallback OK');
                            //v.muted=false;
                            //v.volume=1;
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

            $('#stop-playing').disabled=false;
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
            $('#subscribe').disabled=false;
            $('#unmute-playback-video').disabled=true;
        }
    });
    $('#unmute-playback-video').addEventListener('click', function (event) {
        event.preventDefault();
        const v=$('#playback-video');
        console.log('muted before',v.muted, v.volume);
        v.muted=false;
        v.volume=1;
        console.log('muted after',v.muted, v.volume);
        $('#unmute-playback-video').disabled=true;
    });
    $('#playback-video').addEventListener('volumechange', function (event) {
        const v=$('#playback-video');
        console.log('volumechange',v.muted, v.volume);
        $('#unmute-playback-video').disabled=!v.muted && v.volume>0.01;

    });
    
})();
