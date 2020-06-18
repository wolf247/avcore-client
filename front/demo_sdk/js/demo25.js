(async function () {
    const {ConferenceApi,Utils,ERROR}=window;
    const $ = document.querySelector.bind(document);
    const $$ = document.querySelectorAll.bind(document);
    const streamTable=$('#streamTable');
    const playbacks=[];
    const token="eyJhbGciOiJIUzUxMiIsInR5cCI6IkpXVCJ9.eyJzdHJlYW0iOiJzdHJlYW0xIiwib3BlcmF0aW9uIjoiMSIsImlhdCI6MTU4OTUzNDEzOX0.MsLz3ctklftdSHiNYReabdNVWr_7vW3-rPZ1jTssxguEo6SS4jLFbVu16v9NeLKzNEf1e6PVDmYN8je9GcBZXw";

    const rows=5;
    const columns=5;
    $('#subscribe').addEventListener('click', async (event)=> {
        $('#subscribe').disabled=true;
        event.preventDefault();
        let isError=false;
        let index=0;
        while(streamTable.rows.length > 0) {
            streamTable.deleteRow(0);
        }
        index=0;
        for (let i=0;i<rows;i++) {
            const tr=document.createElement('tr');
            streamTable.appendChild(tr);
            for (let j = 0; j < columns; j++) {
                const _index=index;
                index++;
                try {
                    playbacks[_index] = new ConferenceApi({
                        stream: `demo${_index}`,
                        token
                    });
                    const v = document.createElement('video');
                    v.style.width="160px";
                    v.style.height="90px";
                    const td=document.createElement('td');
                    td.style.width="160px";
                    td.style.height="90px";
                    td.appendChild(v);
                    tr.appendChild(td);

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
                    const mediaStream = await playbacks[_index].subscribe();
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
                }
                catch (e) {
                    if (e && ERROR[e.errorId]) {
                        alert(ERROR[e.errorId])
                    }
                    console.log(e);
                    if (playbacks[_index]) {
                        await playbacks[_index].close();
                    }

                }
                if (!isError) {
                    $('#stop-playing').disabled = false;
                }
            }
        }
    });

    $('#stop-playing').addEventListener('click',async function (event) {
        event.preventDefault();
        for (let i=0;i<playbacks.length;i++) {
            if(playbacks[i]) {
                await playbacks[i].close();
            }
            while(streamTable.rows.length > 0) {
                streamTable.deleteRow(0);
            }
        }
        $('#stop-playing').disabled=true;
        $('#subscribe').disabled=false;
    });
})();
