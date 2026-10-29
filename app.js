(() => {
  'use strict';
  let ICE_SERVERS = [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun.cloudflare.com:3478' },
    { urls: 'stun:global.stun.twilio.com:3478' },
    { urls: ['turn:openrelay.metered.ca:80','turn:openrelay.metered.ca:443','turn:openrelay.metered.ca:443?transport=tcp'], username: 'openrelayproject', credential: 'openrelayproject' },
    { urls: ['turn:staticauth.openrelay.metered.ca:80','turn:staticauth.openrelay.metered.ca:443','turns:staticauth.openrelay.metered.ca:443?transport=tcp'], username: 'openrelayproject', credential: 'openrelayproject' }
  ];
  const W = 640, H = 480;
  const $ = (id) => document.getElementById(id);
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const lobby = $('lobby'), booth = $('booth'), stage = $('stage');
  const nameInput = $('nameInput'), roomInput = $('roomInput'), lobbyMsg = $('lobbyMsg');
  const srcVideo = $('srcVideo'), remoteVideo = $('remoteVideo');
  const localCanvas = $('localCanvas'), ctx = localCanvas.getContext('2d');
  const waiting = $('waiting'), countdownEl = $('countdown'), flashEl = $('flash');
  const btnShoot = $('btnShoot'), btnMic = $('btnMic'), btnCam = $('btnCam');
  const shotInfo = $('shotInfo'), bgGrid = $('bgGrid');
  const modal = $('modal'), resultCanvas = $('resultCanvas');
  let role = 'left', myName = 'Aku', peerName = null, room = '';
  let cam = null, outStream = null, seg = null;
  let currentBg = 'none', customDataUrl = null;
  let shooting = false, loopRunning = false, joining = false;
  let lastShots = [];
  const bgCache = {};
  function mk(){const c=document.createElement('canvas');c.width=W;c.height=H;return[c,c.getContext('2d')];}
  function rng(seed){return()=>{seed|=0;seed=(seed+0x6d2b79f5)|0;let t=Math.imul(seed^(seed>>>15),1|seed);t=(t+Math.imul(t^(t>>>7),61|t))^t;return((t^(t>>>14))>>>0)/4294967296;};}
  function heart(x,cx,cy,s){x.beginPath();x.moveTo(cx,cy+s*0.35);x.bezierCurveTo(cx-s,cy-s*0.3,cx-s*0.5,cy-s*0.95,cx,cy-s*0.4);x.bezierCurveTo(cx+s*0.5,cy-s*0.95,cx+s,cy-s*0.3,cx,cy+s*0.35);x.fill();}
  const PRESETS={
    sunset(){const[c,x]=mk();const g=x.createLinearGradient(0,0,0,H);g.addColorStop(0,'#2b1055');g.addColorStop(0.5,'#ff6a88');g.addColorStop(1,'#ffd194');x.fillStyle=g;x.fillRect(0,0,W,H);x.fillStyle='rgba(255,240,200,.92)';x.beginPath();x.arc(W/2,H*0.72,90,0,Math.PI*2);x.fill();x.fillStyle='rgba(40,20,70,.88)';x.fillRect(0,H*0.82,W,H*0.18);return c;},
    pastel(){const[c,x]=mk();const g=x.createLinearGradient(0,0,W,H);g.addColorStop(0,'#ffd1dc');g.addColorStop(0.5,'#e8d5ff');g.addColorStop(1,'#c9e8ff');x.fillStyle=g;x.fillRect(0,0,W,H);const r=rng(7);for(let i=0;i<14;i++){x.fillStyle=`rgba(255,255,255,${0.15+r()*0.25})`;x.beginPath();x.arc(r()*W,r()*H,30+r()*70,0,Math.PI*2);x.fill();}return c;},
    night(){const[c,x]=mk();const g=x.createLinearGradient(0,0,0,H);g.addColorStop(0,'#0f0c29');g.addColorStop(0.55,'#302b63');g.addColorStop(1,'#24243e');x.fillStyle=g;x.fillRect(0,0,W,H);const r=rng(21);for(let i=0;i<90;i++){x.fillStyle=`rgba(255,255,255,${0.4+r()*0.6})`;x.beginPath();x.arc(r()*W,r()*H,0.6+r()*1.8,0,Math.PI*2);x.fill();}x.fillStyle='#fff6d6';x.beginPath();x.arc(W*0.8,H*0.2,42,0,Math.PI*2);x.fill();x.fillStyle='#302b63';x.beginPath();x.arc(W*0.8+16,H*0.2-8,38,0,Math.PI*2);x.fill();return c;},
    hearts(){const[c,x]=mk();x.fillStyle='#ffd6e7';x.fillRect(0,0,W,H);const cols=['#ff8fb8','#ff6b9d','#ffb3d1','#ffffff','#e4457f'];const r=rng(3);for(let i=0;i<38;i++){x.globalAlpha=0.45+r()*0.5;x.fillStyle=cols[Math.floor(r()*cols.length)];heart(x,r()*W,r()*H,14+r()*34);}x.globalAlpha=1;return c;},
    dots(){const[c,x]=mk();x.fillStyle='#fff7e6';x.fillRect(0,0,W,H);const cols=['#ffb3c6','#a0e7e5','#ffe29a','#c5b3ff'];let k=0;for(let row=0;row<9;row++){for(let col=0;col<12;col++){x.fillStyle=cols[k++%cols.length];x.beginPath();x.arc(col*60+(row%2?30:0),row*58+20,17,0,Math.PI*2);x.fill();}}return c;},
    beach(){const[c,x]=mk();const sky=x.createLinearGradient(0,0,0,H*0.6);sky.addColorStop(0,'#6ec6ff');sky.addColorStop(1,'#d9f1ff');x.fillStyle=sky;x.fillRect(0,0,W,H);x.fillStyle='#fff3a8';x.beginPath();x.arc(W*0.78,H*0.18,44,0,Math.PI*2);x.fill();x.fillStyle='#2aa7d8';x.fillRect(0,H*0.5,W,H*0.2);x.fillStyle='rgba(255,255,255,.7)';for(let i=0;i<6;i++)x.fillRect(i*120+20,H*0.58,70,4);x.fillStyle='#f6dfa4';x.fillRect(0,H*0.7,W,H*0.3);return c;}
  };
  const BG_LIST=[{id:'none',label:'Asli',icon:'🎥'},{id:'blur',label:'Blur',icon:'🌫️'},{id:'sunset',label:'Sunset'},{id:'pastel',label:'Pastel'},{id:'night',label:'Malam'},{id:'hearts',label:'Hati'},{id:'dots',label:'Polkadot'},{id:'beach',label:'Pantai'}];
  function getBgCanvas(id){if(bgCache[id])return bgCache[id];if(PRESETS[id])bgCache[id]=PRESETS[id]();return bgCache[id]||null;}
  function drawCover(c,src,dw,dh){const sw=src.videoWidth||src.width,sh=src.videoHeight||src.height;if(!sw||!sh)return;const s=Math.max(dw/sw,dh/sh);const w=sw*s,h=sh*s;c.drawImage(src,(dw-w)/2,(dh-h)/2,w,h);}
  function drawMirrored(c,src,scale=1){c.save();c.translate(W/2,H/2);c.scale(-scale,scale);c.translate(-W/2,-H/2);drawCover(c,src,W,H);c.restore();}
  const smallBlur=document.createElement('canvas');smallBlur.width=32;smallBlur.height=24;
  function drawBackground(){if(currentBg==='blur'){ctx.save();ctx.fillStyle='#777';ctx.fillRect(0,0,W,H);if('filter' in ctx){ctx.filter='blur(16px)';drawMirrored(ctx,srcVideo,1.08);}else{const sc=smallBlur.getContext('2d');sc.save();sc.translate(32,0);sc.scale(-1,1);drawCover(sc,srcVideo,32,24);sc.restore();ctx.imageSmoothingEnabled=true;ctx.drawImage(smallBlur,0,0,W,H);}ctx.restore();}else{const bc=getBgCanvas(currentBg);if(bc)ctx.drawImage(bc,0,0,W,H);}}
  function drawPlain(){ctx.clearRect(0,0,W,H);drawMirrored(ctx,srcVideo);}
  function onResults(res){ctx.save();ctx.clearRect(0,0,W,H);ctx.translate(W,0);ctx.scale(-1,1);drawCover(ctx,res.segmentationMask,W,H);ctx.globalCompositeOperation='source-in';drawCover(ctx,res.image,W,H);ctx.restore();ctx.save();ctx.globalCompositeOperation='destination-over';drawBackground();ctx.restore();}
  let busy=false;async function loop(){if(!loopRunning)return;if(srcVideo.readyState>=2&&!busy){busy=true;try{if(currentBg==='none'||!seg)drawPlain();else await seg.send({image:srcVideo});}catch(e){drawPlain();}busy=false;}requestAnimationFrame(loop);}
  async function startCamera(){if(!navigator.mediaDevices?.getUserMedia)throw new Error('INSECURE');const video={width:{ideal:640},height:{ideal:480},facingMode:'user'};try{cam=await navigator.mediaDevices.getUserMedia({video,audio:{echoCancellation:true,noiseSuppression:true}});}catch(e){cam=await navigator.mediaDevices.getUserMedia({video,audio:false});}srcVideo.srcObject=cam;await srcVideo.play();if(typeof SelfieSegmentation==='function'){seg=new SelfieSegmentation({locateFile:(f)=>`https://cdn.jsdelivr.net/npm/@mediapipe/selfie_segmentation/${f}`});seg.setOptions({modelSelection:1});seg.onResults(onResults);try{seg.initialize();}catch(e){}}const cs=localCanvas.captureStream(30);outStream=new MediaStream([...cs.getVideoTracks(),...cam.getAudioTracks()]);if(!cam.getAudioTracks().length){btnMic.disabled=true;btnMic.textContent='🎤 Tidak ada mic';}loopRunning=true;loop();renderGrid();}
  function stopCamera(){loopRunning=false;if(cam)cam.getTracks().forEach(t=>t.stop());cam=null;outStream=null;seg=null;}
  function renderGrid(){bgGrid.innerHTML='';const items=BG_LIST.slice();if(bgCache.custom)items.push({id:'custom',label:'Milikmu'});items.forEach(it=>{const b=document.createElement('button');b.className='bg-item'+(it.id===currentBg?' active':'');b.dataset.id=it.id;const thumb=document.createElement('div');thumb.className='thumb';const bc=getBgCanvas(it.id);if(bc){const t=document.createElement('canvas');t.width=96;t.height=72;t.getContext('2d').drawImage(bc,0,0,96,72);thumb.appendChild(t);}else thumb.textContent=it.icon||'';const lab=document.createElement('span');lab.textContent=it.label;b.append(thumb,lab);if(!seg&&it.id!=='none')b.disabled=true;b.addEventListener('click',()=>setBg(it.id,true));bgGrid.appendChild(b);});}
  function setBg(id,broadcast){currentBg=id;document.querySelectorAll('.bg-item').forEach(b=>b.classList.toggle('active',b.dataset.id===id));if(broadcast)sendBg();}
  function sendBg(){send({type:'bg',id:currentBg,data:currentBg==='custom'?customDataUrl:undefined});}
  function setCustomFromImage(img){const[c,x]=mk();drawCover(x,img,W,H);bgCache.custom=c;customDataUrl=c.toDataURL('image/jpeg',0.7);renderGrid();}
  $('uploadBg').addEventListener('change',e=>{const f=e.target.files[0];if(!f)return;const img=new Image();img.onload=()=>{setCustomFromImage(img);URL.revokeObjectURL(img.src);setBg('custom',true);};img.src=URL.createObjectURL(f);e.target.value='';});
  const PREFIX='pbldr-';let peer=null,conn=null,mediaCall=null,isHost=false;
  function peerOpts(){return{config:{iceServers:ICE_SERVERS}};}
  function send(obj){if(conn&&conn.open)conn.send(obj);}
  function setStatus(t){$('statusText').textContent=t;}
  function showError(t){if(booth.classList.contains('hidden'))lobbyMsg.textContent=t;else setStatus(t);}
  function enterBooth(code){room=code;role=isHost?'left':'right';$('roomLabel').textContent=code;stage.classList.toggle('role-right',role==='right');$('labelLocal').textContent=myName+' (kamu)';lobby.classList.add('hidden');booth.classList.remove('hidden');try{history.replaceState(null,'','?room='+code);}catch(e){}joining=false;}
  function destroyPeer(){try{if(mediaCall)mediaCall.close();}catch(e){}try{if(conn)conn.close();}catch(e){}try{if(peer)peer.destroy();}catch(e){}mediaCall=null;conn=null;peer=null;}
  async function startPeer(code){lobbyMsg.textContent='Menyiapkan koneksi...';startAsHost(code);}
  function startAsHost(code){destroyPeer();isHost=true;peer=new Peer(PREFIX+code,peerOpts());peer.on('open',()=>{enterBooth(code);setStatus('Menunggu pasangan masuk...');});peer.on('connection',c=>{if(conn&&conn.open){const rej=()=>{c.send({type:'full'});setTimeout(()=>c.close(),400);};if(c.open)rej();else c.on('open',rej);return;}conn=c;bindConn(c);});peer.on('error',err=>{if(err.type==='unavailable-id')startAsGuest(code);else handlePeerError(err);});peer.on('disconnected',()=>{try{peer.reconnect();}catch(e){}});}
  function startAsGuest(code){destroyPeer();isHost=false;peer=new Peer(peerOpts());peer.on('open',()=>{conn=peer.connect(PREFIX+code,{serialization:'json',reliable:true});bindConn(conn);lobbyMsg.textContent='Menyambung ke room...';});peer.on('call',c=>{c.answer(outStream);bindCall(c);});peer.on('error',handlePeerError);peer.on('disconnected',()=>{try{peer.reconnect();}catch(e){}});}
  function handlePeerError(err){joining=false;if(err.type==='unavailable-id')showError('Kode room sedang dipakai.');else if(err.type==='peer-unavailable')showError('Room tidak ditemukan.');else showError('Koneksi bermasalah: '+err.type);}
  function bindConn(c){const init=()=>{c.send({type:'hello',name:myName});if(!isHost)enterBooth(room||roomInput.value.toUpperCase());};if(c.open)init();else c.on('open',init);c.on('data',onData);c.on('close',onPeerLeft);}
  function bindCall(c){mediaCall=c;c.on('stream',s=>{remoteVideo.srcObject=s;waiting.classList.add('hidden');btnShoot.disabled=false;setStatus(`Live bersama ${peerName||'pasangan'} ❤️`);});c.on('close',()=>{if(mediaCall===c)mediaCall=null;});}
  function onData(msg){if(!msg||typeof msg!=='object')return;switch(msg.type){case'hello':peerName=String(msg.name||'Pasangan').slice(0,20);$('labelRemote').textContent=peerName;setStatus(`Menyambungkan video dengan ${peerName}...`);if(isHost){bindCall(peer.call(conn.peer,outStream));sendBg();}break;case'full':joining=false;destroyPeer();stopCamera();booth.classList.add('hidden');lobby.classList.remove('hidden');lobbyMsg.textContent='Room sudah penuh (maksimal 2 orang).';break;case'bg':applyRemoteBg(msg);break;case'shoot':runSequence(msg.count);break;}}
  async function applyRemoteBg(msg){if(msg.id==='custom'&&msg.data){const img=new Image();await new Promise(res=>{img.onload=res;img.onerror=res;img.src=msg.data;});setCustomFromImage(img);}if(msg.id!=='custom'||bgCache.custom)setBg(msg.id,false);}
  function onPeerLeft(){conn=null;try{if(mediaCall)mediaCall.close();}catch(e){}mediaCall=null;remoteVideo.srcObject=null;waiting.classList.remove('hidden');peerName=null;$('labelRemote').textContent='Pasangan';setStatus('Pasangan keluar. Menunggu lagi...');}
  const CODE_CHARS='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';function randomCode(){let s='';for(let i=0;i<5;i++)s+=CODE_CHARS[Math.floor(Math.random()*CODE_CHARS.length)];return s;}
  async function join(code){if(joining)return;code=String(code||'').toUpperCase().replace(/[^A-Z0-9]/g,'');if(!code){lobbyMsg.textContent='Isi kode room dulu.';return;}joining=true;myName=nameInput.value.trim()||'Aku';try{localStorage.setItem('pb-name',myName);}catch(e){}lobbyMsg.textContent='Menyalakan kamera...';try{if(!cam)await startCamera();}catch(e){joining=false;lobbyMsg.textContent='Kamera tidak bisa diakses.';return;}room=code;startPeer(code);}
  let myCode=randomCode();const codeEl=$('myCode');const inviteLink=()=>location.origin+location.pathname+'?room='+myCode;const inviteText=()=>`Yuk foto bareng! ${inviteLink()} (kode: ${myCode})`;codeEl.textContent=myCode;
  $('btnNewCode').addEventListener('click',()=>{myCode=randomCode();codeEl.textContent=myCode;});
  $('btnCopyLobby').addEventListener('click',async()=>{try{await navigator.clipboard.writeText(inviteLink());lobbyMsg.textContent='Link disalin.';}catch(e){window.prompt('Salin link:',inviteLink());}});
  $('btnShareLobby').addEventListener('click',async()=>{if(navigator.share){try{await navigator.share({title:'Photobooth LDR',text:inviteText()});return;}catch(e){}}window.open('https://wa.me/?text='+encodeURIComponent(inviteText()),'_blank');});
  $('btnCreate').addEventListener('click',()=>join(myCode));
  $('btnJoin').addEventListener('click',()=>join(roomInput.value));
  roomInput.addEventListener('keydown',e=>{if(e.key==='Enter')join(roomInput.value);});
  $('btnCopy').addEventListener('click',async()=>{try{await navigator.clipboard.writeText(location.href);setStatus('Link disalin!');}catch(e){window.prompt('Salin:',location.href);}});
  $('btnLeave').addEventListener('click',()=>{destroyPeer();stopCamera();location.href=location.pathname;});
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState!=='visible'||!peer||peer.destroyed)return;if(peer.disconnected){try{peer.reconnect();}catch(e){}}});
  window.addEventListener('online',()=>{if(peer&&!peer.destroyed&&peer.disconnected){try{peer.reconnect();}catch(e){}}});
  btnMic.addEventListener('click',()=>{const t=cam&&cam.getAudioTracks()[0];if(!t)return;t.enabled=!t.enabled;btnMic.textContent='🎤 Mic: '+(t.enabled?'On':'Off');});
  btnCam.addEventListener('click',()=>{const t=cam&&cam.getVideoTracks()[0];if(!t)return;t.enabled=!t.enabled;btnCam.textContent='📹 Kamera: '+(t.enabled?'On':'Off');});
  function snap(src){const[c,x]=mk();x.fillStyle='#000';x.fillRect(0,0,W,H);drawCover(x,src,W,H);return c;}
  async function runSequence(count){if(shooting)return;shooting=true;closeModal();btnShoot.disabled=true;const shots=[];for(let i=0;i<count;i++){shotInfo.textContent=`Foto ${i+1} dari ${count} — bersiap!`;for(let n=3;n>=1;n--){countdownEl.classList.remove('show');void countdownEl.offsetWidth;countdownEl.textContent=n;countdownEl.classList.add('show');await sleep(1000);}countdownEl.classList.remove('show');flashEl.classList.add('on');setTimeout(()=>flashEl.classList.remove('on'),120);shots.push({local:snap(localCanvas),remote:remoteVideo.srcObject?snap(remoteVideo):null});await sleep(800);}shotInfo.textContent='';shooting=false;btnShoot.disabled=false;$('btnLast').classList.remove('hidden');lastShots=shots;openResult();}
  btnShoot.addEventListener('click',()=>{if(shooting)return;const count=parseInt($('shotCount').value,10)||3;send({type:'shoot',count});runSequence(count);});
  function isLight(hex){const n=parseInt(hex.slice(1),16);const r=n>>16,g=(n>>8)&255,b=n&255;return(0.299*r+0.587*g+0.114*b)/255>0.55;}
  function renderResult(){
    const n=lastShots.length;if(!n)return;
    const pad=24,gap=12,cw=420,ch=315,footer=110;
    const solo=lastShots.some(s=>!s.remote);
    const cvW=solo?pad*2+cw:pad*2+cw*2;
    const cvH=pad+n*ch+(n-1)*gap+footer;
    resultCanvas.width=cvW;resultCanvas.height=cvH;
    const c=resultCanvas.getContext('2d');
    c.fillStyle=$('frameColor').value;c.fillRect(0,0,cvW,cvH);
    lastShots.forEach((s,i)=>{
      const y=pad+i*(ch+gap);
      if(solo){c.drawImage(s.local,pad,y,cw,ch);}
      else{
        const leftImg=role==='left'?s.local:s.remote;
        const rightImg=role==='left'?s.remote:s.local;
        const tmp=document.createElement('canvas');tmp.width=cw*2;tmp.height=ch;
        const tx=tmp.getContext('2d');
        if(leftImg)tx.drawImage(leftImg,0,0,cw,ch);
        if(rightImg)tx.drawImage(rightImg,cw,0,cw,ch);
        c.drawImage(tmp,pad,y,cw*2,ch);
      }
    });
    const dark=isLight($('frameColor').value);
    c.fillStyle=dark?'#3b2a33':'#ffffff';c.textAlign='center';
    c.font='bold 36px Georgia, serif';c.fillText($('captionInput').value||'',cvW/2,cvH-footer+44);
    c.font='20px system-ui, sans-serif';c.globalAlpha=0.8;
    const leftName=role==='left'?myName:(peerName||'Pasangan');
    const rightName=role==='left'?(peerName||'Pasangan'):myName;
    const date=new Date().toLocaleDateString('id-ID',{day:'numeric',month:'long',year:'numeric'});
    c.fillText(solo?`${myName}  •  ${date}`:`${leftName} ❤ ${rightName}  •  ${date}`,cvW/2,cvH-footer+80);
    c.globalAlpha=1;
  }
  function openResult(){modal.classList.remove('hidden');renderResult();}
  function closeModal(){modal.classList.add('hidden');}
  $('btnLast').addEventListener('click',openResult);
  $('frameColor').addEventListener('input',renderResult);
  $('captionInput').addEventListener('input',renderResult);
  $('btnClose').addEventListener('click',closeModal);
  $('btnRetake').addEventListener('click',()=>{closeModal();btnShoot.click();});
  $('btnDownload').addEventListener('click',()=>{resultCanvas.toBlob(blob=>{const a=document.createElement('a');a.href=URL.createObjectURL(blob);const d=new Date();const p=v=>String(v).padStart(2,'0');a.download=`photobooth-${d.getFullYear()}${p(d.getMonth()+1)}${p(d.getDate())}.png`;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),2000);},'image/png');});
  try{nameInput.value=localStorage.getItem('pb-name')||'';}catch(e){}
  const qRoom=new URLSearchParams(location.search).get('room');
  if(qRoom){roomInput.value=qRoom.toUpperCase();document.querySelector('.codebox').classList.add('hidden');$('btnCreate').parentElement.classList.add('hidden');document.querySelector('.divider').classList.add('hidden');lobbyMsg.textContent='Kamu diundang ke room '+roomInput.value+'. Isi nama lalu Gabung.';}
})();