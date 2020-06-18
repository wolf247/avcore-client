(async function () {
    const {MediasoupRestApi}=window;
    const $ = document.querySelector.bind(document);
    const $$ = document.querySelectorAll.bind(document);
    const api=new MediasoupRestApi(`${location.protocol}//${location.host}/0`,"eyJhbGciOiJIUzUxMiIsInR5cCI6IkpXVCJ9.eyJzdHJlYW0iOiJzdHJlYW0xIiwib3BlcmF0aW9uIjoiMiIsImlhdCI6MTU5MDE0NjMxNn0.80ImcNlmRsGLoyDNJ8QUK8W-2lygfvlCWdyBf5VDqrl6Q6hE0FnOj_tL0V5X51v1y8Ah2nCgFykBKahhYW04Nw")
    const listStreams=$('#list-streams');
    const streamTable=$('#stream-table');
    const recordingTable=$('#recording-table');

    listStreams.addEventListener('click', async (event)=> {
        listStreams.disabled=true;
        event.preventDefault();
        const {list}=await api.recordedStreams();
        while(streamTable.rows.length > 0) {
            streamTable.deleteRow(0);
        }
        while (list && list.length) {
            addStreamRow(streamTable,list.shift());
        }
        listStreams.disabled=false;
    });

    function addStreamRow(table,stream) {
        const tr=document.createElement('tr');
        const td1=document.createElement('td');
        td1.innerText=stream;
        td1.style.width="100%";
        td1.style.fontSize="30px";
        tr.appendChild(td1);
        const td2=document.createElement('td');
        const listButton=document.createElement('button');
        listButton.classList.add('contact-form-btn');
        listButton.addEventListener('click',async ()=>{
            listButton.disabled=true;
            event.preventDefault();
            const {list}=await api.streamRecordings({stream});
            while(recordingTable.rows.length > 0) {
                recordingTable.deleteRow(0);
            }
            while (list && list.length) {
                addRecordRow(recordingTable,list.shift());
            }
            listButton.disabled=false;
        });
        listButton.innerText='List Recordings';
        listButton.style.width="200px";
        td2.appendChild(listButton);
        tr.appendChild(td2);
        const td3=document.createElement('td');
        const deleteButton=document.createElement('button');
        deleteButton.classList.add('contact-form-btn');
        deleteButton.addEventListener('click',async ()=>{
            deleteButton.disabled=true;
            event.preventDefault();
            await api.deleteStreamRecordings({stream:stream});
            table.removeChild(tr);
            while(recordingTable.rows.length > 0) {
                recordingTable.deleteRow(0);
            }
        });
        deleteButton.innerText='Delete';
        td3.appendChild(deleteButton);
        tr.appendChild(td3);
        table.appendChild(tr);
    }
    function addRecordRow(table,recording) {
        const tr=document.createElement('tr');
        const td1=document.createElement('td');
        const a=document.createElement('a');
        a.target='_blank';
        a.href=`${location.protocol}//${location.host}/recordings/${recording}`;
        a.innerText=recording;
        td1.appendChild(a);
        td1.style.width="100%";
        td1.style.fontSize="30px";
        tr.appendChild(td1);
        const td2=document.createElement('td');
        const deleteButton=document.createElement('button');
        deleteButton.classList.add('contact-form-btn');
        deleteButton.addEventListener('click',async ()=>{
            deleteButton.disabled=true;
            event.preventDefault();
            await api.deleteRecording({filePath:recording});
            table.removeChild(tr);
        });
        deleteButton.innerText='Delete';
        td2.appendChild(deleteButton);
        tr.appendChild(td2);
        table.appendChild(tr);
    }
})();
