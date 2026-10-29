(() => {
  'use strict';

  const ICE_SERVERS = [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun.cloudflare.com:3478' },
    {
      urls: [
        'turn:openrelay.metered.ca:80',
        'turn:openrelay.metered.ca:443',
        'turn:openrelay.metered.ca:443?transport=tcp'
      ],
      username: 'openrelayproject',
      credential: 'openrelayproject'
    },
    {
      urls: [
        'turns:staticauth.openrelay.metered.ca:443?transport=tcp'
      ],
      username: 'openrelayproject',
      credential: 'openrelayproject'
    }
  ];

  const W = 640;
  const H = 480;
  const $ = id => document.getElementById(id);
  const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

  const lobby = $('lobby');
  const booth = $('booth');
  const stage = $('stage');
  const nameInput = $('nameInput');
  const roomInput = $('roomInput');
  const lobbyMsg = $('lobbyMsg');
  const srcVideo = $('srcVideo');
  const remoteVideo = $('remoteVideo');
  const localCanvas = $('localCanvas');
  const ctx = localCanvas.getContext('2d');
  const waiting = $('waiting');
  const countdownEl = $('countdown');
  const flashEl = $('flash');
  const btnShoot = $('btnShoot');
  const btnMic = $('btnMic');
  const btnCam = $('btnCam');
  const shotInfo = $('shotInfo');
  const bgGrid = $('bgGrid');
  const modal = $('modal');
  const resultCanvas = $('resultCanvas');

  let role = 'left';
  let myName = 'Aku';
  let peerName = null;
  let room = '';

  let cam = null;
  let outStream = null;
  let seg = null;

  let currentBg = 'none';
  let customDataUrl = null;

  let shooting = false;
  let loopRunning = false;
  let joining = false;
  let lastShots = [];

  const bgCache = {};

  function mk() {
    const c = document.createElement('canvas');
    c.width = W;
    c.height = H;
    return [c, c.getContext('2d')];
  }

  function rng(seed) {
    return () => {
      seed |= 0;
      seed = (seed + 0x6d2b79f5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function heart(x, cx, cy, s) {
    x.beginPath();
    x.moveTo(cx, cy + s * 0.35);
    x.bezierCurveTo(cx - s, cy - s * 0.3, cx - s * 0.5, cy - s * 0.95, cx, cy - s * 0.4);
    x.bezierCurveTo(cx + s * 0.5, cy - s * 0.95, cx + s, cy - s * 0.3, cx, cy + s * 0.35);
    x.fill();
  }

  const PRESETS = {
    sunset() {
      const [c, x] = mk();
      const g = x.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, '#2b1055');
      g.addColorStop(0.5, '#ff6a88');
      g.addColorStop(1, '#ffd194');
      x.fillStyle = g;
      x.fillRect(0, 0, W, H);
      x.fillStyle = 'rgba(255,240,200,.92)';
      x.beginPath();
      x.arc(W / 2, H * 0.72, 90, 0, Math.PI * 2);
      x.fill();
      x.fillStyle = 'rgba(40,20,70,.88)';
      x.fillRect(0, H * 0.82, W, H * 0.18);
      return c;
    },

    pastel() {
      const [c, x] = mk();
      const g = x.createLinearGradient(0, 0, W, H);
      g.addColorStop(0, '#ffd1dc');
      g.addColorStop(0.5, '#e8d5ff');
      g.addColorStop(1, '#c9e8ff');
      x.fillStyle = g;
      x.fillRect(0, 0, W, H);

      const r = rng(7);
      for (let i = 0; i < 14; i++) {
        x.fillStyle = `rgba(255,255,255,${0.15 + r() * 0.25})`;
        x.beginPath();
        x.arc(r() * W, r() * H, 30 + r() * 70, 0, Math.PI * 2);
        x.fill();
      }
      return c;
    },

    night() {
      const [c, x] = mk();
      const g = x.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, '#0f0c29');
      g.addColorStop(0.55, '#302b63');
      g.addColorStop(1, '#24243e');
      x.fillStyle = g;
      x.fillRect(0, 0, W, H);

      const r = rng(21);
      for (let i = 0; i < 90; i++) {
        x.fillStyle = `rgba(255,255,255,${0.4 + r() * 0.6})`;
        x.beginPath();
        x.arc(r() * W, r() * H, 0.6 + r() * 1.8, 0, Math.PI * 2);
        x.fill();
      }

      x.fillStyle = '#fff6d6';
      x.beginPath();
      x.arc(W * 0.8, H * 0.2, 42, 0, Math.PI * 2);
      x.fill();

      x.fillStyle = '#302b63';
      x.beginPath();
      x.arc(W * 0.8 + 16, H * 0.2 - 8, 38, 0, Math.PI * 2);
      x.fill();

      return c;
    },

    hearts() {
      const [c, x] = mk();
      x.fillStyle = '#ffd6e7';
      x.fillRect(0, 0, W, H);

      const cols = ['#ff8fb8', '#ff6b9d', '#ffb3d1', '#ffffff', '#e4457f'];
      const r = rng(3);

      for (let i = 0; i < 38; i++) {
        x.globalAlpha = 0.45 + r() * 0.5;
        x.fillStyle = cols[Math.floor(r() * cols.length)];
        heart(x, r() * W, r() * H, 14 + r() * 34);
      }

      x.globalAlpha = 1;
      return c;
    },

    dots() {
      const [c, x] = mk();
      x.fillStyle = '#fff7e6';
      x.fillRect(0, 0, W, H);

      const cols = ['#ffb3c6', '#a0e7e5', '#ffe29a', '#c5b3ff'];
      let k = 0;

      for (let row = 0; row < 9; row++) {
        for (let col = 0; col < 12; col++) {
          x.fillStyle = cols[k++ % cols.length];
          x.beginPath();
          x.arc(col * 60 + (row % 2 ? 30 : 0), row * 58 + 20, 17, 0, Math.PI * 2);
          x.fill();
        }
      }

      return c;
    },

    beach() {
      const [c, x] = mk();
      const sky = x.createLinearGradient(0, 0, 0, H * 0.6);
      sky.addColorStop(0, '#6ec6ff');
      sky.addColorStop(1, '#d9f1ff');

      x.fillStyle = sky;
      x.fillRect(0, 0, W, H);

      x.fillStyle = '#fff3a8';
      x.beginPath();
      x.arc(W * 0.78, H * 0.18, 44, 0, Math.PI * 2);
      x.fill();

      x.fillStyle = '#2aa7d8';
      x.fillRect(0, H * 0.5, W, H * 0.2);

      x.fillStyle = 'rgba(255,255,255,.7)';
      for (let i = 0; i < 6; i++) {
        x.fillRect(i * 120 + 20, H * 0.58, 70, 4);
      }

      x.fillStyle = '#f6dfa4';
      x.fillRect(0, H * 0.7, W, H * 0.3);

      return c;
    }
  };

  const BG_LIST = [
    { id: 'none', label: 'Asli', icon: '🎥' },
    { id: 'blur', label: 'Blur', icon: '🌫️' },
    { id: 'sunset', label: 'Sunset' },
    { id: 'pastel', label: 'Pastel' },
    { id: 'night', label: 'Malam' },
    { id: 'hearts', label: 'Hati' },
    { id: 'dots', label: 'Polkadot' },
    { id: 'beach', label: 'Pantai' }
  ];

  function getBgCanvas(id) {
    if (bgCache[id]) return bgCache[id];
    if (PRESETS[id]) bgCache[id] = PRESETS[id]();
    return bgCache[id] || null;
  }

  function drawCover(c, src, dw, dh) {
    const sw = src.videoWidth || src.width;
    const sh = src.videoHeight || src.height;

    if (!sw || !sh) return;

    const s = Math.max(dw / sw, dh / sh);
    const w = sw * s;
    const h = sh * s;

    c.drawImage(src, (dw - w) / 2, (dh - h) / 2, w, h);
  }

  function drawMirrored(c, src, scale = 1) {
    c.save();
    c.translate(W / 2, H / 2);
    c.scale(-scale, scale);
    c.translate(-W / 2, -H / 2);
    drawCover(c, src, W, H);
    c.restore();
  }

  const smallBlur = document.createElement('canvas');
  smallBlur.width = 32;
  smallBlur.height = 24;

  function drawBackground() {
    if (currentBg === 'blur') {
      ctx.save();
      ctx.fillStyle = '#777';
      ctx.fillRect(0, 0, W, H);

      if ('filter' in ctx) {
        ctx.filter = 'blur(16px)';
        drawMirrored(ctx, srcVideo, 1.08);
      } else {
        const sc = smallBlur.getContext('2d');
        sc.save();
        sc.translate(32, 0);
        sc.scale(-1, 1);
        drawCover(sc, srcVideo, 32, 24);
        sc.restore();

        ctx.imageSmoothingEnabled = true;
        ctx.drawImage(smallBlur, 0, 0, W, H);
      }

      ctx.restore();
    } else {
      const bc = getBgCanvas(currentBg);
      if (bc) ctx.drawImage(bc, 0, 0, W, H);
    }
  }

  function drawPlain() {
    ctx.clearRect(0, 0, W, H);
    drawMirrored(ctx, srcVideo);
  }

  function onResults(res) {
    ctx.save();
    ctx.clearRect(0, 0, W, H);
    ctx.translate(W, 0);
    ctx.scale(-1, 1);
    drawCover(ctx, res.segmentationMask, W, H);
    ctx.globalCompositeOperation = 'source-in';
    drawCover(ctx, res.image, W, H);
    ctx.restore();

    ctx.save();
    ctx.globalCompositeOperation = 'destination-over';
    drawBackground();
    ctx.restore();
  }

  let busy = false;

  async function loop() {
    if (!loopRunning) return;

    if (srcVideo.readyState >= 2 && !busy) {
      busy = true;

      try {
        if (currentBg === 'none' || !seg) {
          drawPlain();
        } else {
          await seg.send({ image: srcVideo });
        }
      } catch (e) {
        drawPlain();
      }

      busy = false;
    }

    requestAnimationFrame(loop);
  }

  async function startCamera() {
    if (!window.isSecureContext) {
      throw new Error('INSECURE');
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error('MEDIA_UNAVAILABLE');
    }

    const video = {
      width: { ideal: 640 },
      height: { ideal: 480 },
      facingMode: 'user'
    };

    try {
      cam = await navigator.mediaDevices.getUserMedia({
        video,
        audio: {
          echoCancellation: true,
          noiseSuppression: true
        }
      });
    } catch (e) {
      cam = await navigator.mediaDevices.getUserMedia({
        video,
        audio: false
      });
    }

    srcVideo.srcObject = cam;
    await srcVideo.play();

    if (typeof SelfieSegmentation === 'function') {
      seg = new SelfieSegmentation({
        locateFile: f =>
          `https://cdn.jsdelivr.net/npm/@mediapipe/selfie_segmentation/${f}`
      });

      seg.setOptions({ modelSelection: 1 });
      seg.onResults(onResults);

      try {
        await seg.initialize();
      } catch (e) {
        console.warn('Segmentasi tidak tersedia:', e);
        seg = null;
      }
    }

    const cs = localCanvas.captureStream(30);

    outStream = new MediaStream([
      ...cs.getVideoTracks(),
      ...cam.getAudioTracks()
    ]);

    if (!cam.getAudioTracks().length) {
      btnMic.disabled = true;
      btnMic.textContent = '🎤 Tidak ada mic';
    }

    loopRunning = true;
    loop();
    renderGrid();
  }

  function stopCamera() {
    loopRunning = false;

    if (cam) {
      cam.getTracks().forEach(track => track.stop());
    }

    if (outStream) {
      outStream.getTracks().forEach(track => track.stop());
    }

    cam = null;
    outStream = null;
    seg = null;
  }

  function renderGrid() {
    bgGrid.innerHTML = '';

    const items = BG_LIST.slice();

    if (bgCache.custom) {
      items.push({ id: 'custom', label: 'Milikmu' });
    }

    items.forEach(it => {
      const b = document.createElement('button');
      b.className = 'bg-item' + (it.id === currentBg ? ' active' : '');
      b.dataset.id = it.id;

      const thumb = document.createElement('div');
      thumb.className = 'thumb';

      const bc = getBgCanvas(it.id);

      if (bc) {
        const t = document.createElement('canvas');
        t.width = 96;
        t.height = 72;
        t.getContext('2d').drawImage(bc, 0, 0, 96, 72);
        thumb.appendChild(t);
      } else {
        thumb.textContent = it.icon || '';
      }

      const lab = document.createElement('span');
      lab.textContent = it.label;

      b.append(thumb, lab);

      if (!seg && it.id !== 'none' && it.id !== 'custom') {
        b.disabled = true;
      }

      b.addEventListener('click', () => setBg(it.id, true));
      bgGrid.appendChild(b);
    });
  }

  function setBg(id, broadcast) {
    currentBg = id;

    document.querySelectorAll('.bg-item').forEach(b => {
      b.classList.toggle('active', b.dataset.id === id);
    });

    if (broadcast) sendBg();
  }

  function sendBg() {
    send({
      type: 'bg',
      id: currentBg,
      data: currentBg === 'custom' ? customDataUrl : undefined
    });
  }

  function setCustomFromImage(img) {
    const [c, x] = mk();
    drawCover(x, img, W, H);

    bgCache.custom = c;
    customDataUrl = c.toDataURL('image/jpeg', 0.7);

    renderGrid();
  }

  $('uploadBg').addEventListener('change', e => {
    const f = e.target.files[0];
    if (!f) return;

    const img = new Image();

    img.onload = () => {
      setCustomFromImage(img);
      URL.revokeObjectURL(img.src);
      setBg('custom', true);
    };

    img.onerror = () => {
      URL.revokeObjectURL(img.src);
      alert('Gambar gagal dimuat.');
    };

    img.src = URL.createObjectURL(f);
    e.target.value = '';
  });

  const PREFIX = 'pbldr-';

  let peer = null;
  let conn = null;
  let mediaCall = null;
  let isHost = false;

  function peerOpts() {
    return {
      debug: 1,
      config: {
        iceServers: ICE_SERVERS,
        iceCandidatePoolSize: 10,
        bundlePolicy: 'max-bundle',
        rtcpMuxPolicy: 'require'
      }
    };
  }

  function send(obj) {
    try {
      if (conn && conn.open) conn.send(obj);
    } catch (e) {
      console.warn('Gagal mengirim data room:', e);
    }
  }

  function setStatus(t) {
    $('statusText').textContent = t;
  }

  function showError(t) {
    if (booth.classList.contains('hidden')) {
      lobbyMsg.textContent = t;
    } else {
      setStatus(t);
    }
  }

  function enterBooth(code) {
    room = code;
    role = isHost ? 'left' : 'right';

    $('roomLabel').textContent = code;
    stage.classList.toggle('role-right', role === 'right');
    $('labelLocal').textContent = myName + ' (kamu)';

    lobby.classList.add('hidden');
    booth.classList.remove('hidden');

    try {
      history.replaceState(null, '', '?room=' + encodeURIComponent(code));
    } catch (e) {}

    joining = false;
  }

  function destroyPeer() {
    try {
      if (mediaCall) mediaCall.close();
    } catch (e) {}

    try {
      if (conn) conn.close();
    } catch (e) {}

    try {
      if (peer) peer.destroy();
    } catch (e) {}

    mediaCall = null;
    conn = null;
    peer = null;
  }

  function startPeer(code) {
    lobbyMsg.textContent = 'Menghubungkan ke server room...';
    startAsHost(code);
  }

  function startAsHost(code) {
    destroyPeer();
    isHost = true;

    try {
      peer = new Peer(PREFIX + code, peerOpts());
    } catch (e) {
      handlePeerError({ type: 'server-error', message: e.message });
      return;
    }

    peer.on('open', () => {
      enterBooth(code);
      setStatus('Room siap. Bagikan link/kode ini ke pasangan.');
    });

    peer.on('connection', c => {
      if (conn && conn.open) {
        const reject = () => {
          try {
            c.send({ type: 'full' });
          } catch (e) {}

          setTimeout(() => {
            try {
              c.close();
            } catch (e) {}
          }, 300);
        };

        if (c.open) reject();
        else c.on('open', reject);

        return;
      }

      conn = c;
      bindConn(c);
    });

    peer.on('error', err => {
      if (err.type === 'unavailable-id') {
        startAsGuest(code);
        return;
      }

      handlePeerError(err);
    });

    peer.on('disconnected', () => {
      if (peer && !peer.destroyed) {
        setStatus('Koneksi sinyal terputus, mencoba menyambung ulang...');

        try {
          peer.reconnect();
        } catch (e) {}
      }
    });
  }

  function startAsGuest(code) {
    destroyPeer();
    isHost = false;

    try {
      peer = new Peer(peerOpts());
    } catch (e) {
      handlePeerError({ type: 'server-error', message: e.message });
      return;
    }

    // Pasang listener panggilan sebelum koneksi data dibuat.
    peer.on('call', c => {
      if (!outStream) {
        showError('Kamera belum siap. Keluar lalu coba gabung lagi.');

        try {
          c.close();
        } catch (e) {}

        return;
      }

      try {
        c.answer(outStream);
        bindCall(c);
      } catch (e) {
        console.error(e);
        showError('Gagal menjawab panggilan video. Coba gabung lagi.');
      }
    });

    peer.on('open', () => {
      if (!peer || peer.destroyed) return;

      lobbyMsg.textContent = 'Menyambung ke room ' + code + '...';

      try {
        conn = peer.connect(PREFIX + code, {
          serialization: 'json',
          reliable: true
        });

        bindConn(conn);
      } catch (e) {
        handlePeerError({ type: 'server-error', message: e.message });
      }
    });

    peer.on('error', handlePeerError);

    peer.on('disconnected', () => {
      if (peer && !peer.destroyed) {
        setStatus('Koneksi sinyal terputus, mencoba menyambung ulang...');

        try {
          peer.reconnect();
        } catch (e) {}
      }
    });
  }

  function handlePeerError(err) {
    joining = false;

    const messages = {
      'peer-unavailable':
        'Room tidak ditemukan atau host belum online. Minta host membuat room terlebih dahulu.',
      'network':
        'Tidak dapat menjangkau server sinyal. Periksa jaringan, VPN/proxy, atau coba jaringan lain.',
      'server-error':
        'Server sinyal sedang bermasalah atau tidak dapat dijangkau.',
      'socket-error':
        'Koneksi WebSocket gagal. Pastikan situs memakai HTTPS dan jaringan mengizinkan WebSocket.',
      'socket-closed':
        'Koneksi ke server sinyal terputus. Coba gabung kembali.',
      'webrtc':
        'Koneksi media gagal. Jaringan mungkin memblokir koneksi P2P; TURN server sendiri mungkin diperlukan.',
      'invalid-id':
        'Kode room tidak valid.',
      'browser-incompatible':
        'Browser tidak mendukung fitur koneksi yang dibutuhkan.'
    };

    showError(
      messages[err.type] ||
      ('Koneksi bermasalah (' + (err.type || 'unknown') + '). ' +
      (err.message || 'Coba muat ulang halaman.'))
    );
  }

  function bindConn(c) {
    let initialized = false;

    const init = () => {
      if (initialized || !c.open) return;
      initialized = true;

      try {
        c.send({ type: 'hello', name: myName });
      } catch (e) {}

      if (!isHost) {
        enterBooth(room || roomInput.value.trim().toUpperCase());
      }
    };

    if (c.open) init();
    else c.on('open', init);

    c.on('data', onData);
    c.on('close', onPeerLeft);

    c.on('error', e => {
      console.warn('Data connection error:', e);
      showError('Koneksi data terputus. Coba gabung kembali.');
    });
  }

  function bindCall(c) {
    mediaCall = c;

    c.on('stream', s => {
      remoteVideo.srcObject = s;
      remoteVideo.play().catch(() => {});

      waiting.classList.add('hidden');
      btnShoot.disabled = false;

      setStatus('Live bersama ' + (peerName || 'pasangan') + ' ❤️');
    });

    c.on('close', () => {
      if (mediaCall === c) mediaCall = null;

      remoteVideo.srcObject = null;
      waiting.classList.remove('hidden');
    });

    c.on('error', e => {
      console.warn('Media call error:', e);
      showError('Video gagal tersambung. Coba jaringan lain atau konfigurasi TURN.');
    });
  }

  function onData(msg) {
    if (!msg || typeof msg !== 'object') return;

    switch (msg.type) {
      case 'hello':
        peerName = String(msg.name || 'Pasangan').slice(0, 20);
        $('labelRemote').textContent = peerName;

        setStatus('Menyambungkan video dengan ' + peerName + '...');

        if (isHost && peer && outStream && conn) {
          try {
            if (mediaCall) mediaCall.close();

            bindCall(peer.call(conn.peer, outStream));
            sendBg();
          } catch (e) {
            console.error(e);
            showError('Tidak bisa memulai video call.');
          }
        }
        break;

      case 'full':
        joining = false;
        destroyPeer();
        stopCamera();

        booth.classList.add('hidden');
        lobby.classList.remove('hidden');

        lobbyMsg.textContent = 'Room sudah penuh (maksimal 2 orang).';
        break;

      case 'bg':
        applyRemoteBg(msg);
        break;

      case 'shoot':
        runSequence(Math.max(1, Math.min(6, Number(msg.count) || 3)));
        break;
    }
  }

  async function applyRemoteBg(msg) {
    if (msg.id === 'custom' && msg.data) {
      const img = new Image();

      await new Promise(resolve => {
        img.onload = resolve;
        img.onerror = resolve;
        img.src = msg.data;
      });

      if (img.complete && img.naturalWidth) {
        setCustomFromImage(img);
      }
    }

    if (msg.id !== 'custom' || bgCache.custom) {
      setBg(msg.id, false);
    }
  }

  function onPeerLeft() {
    conn = null;

    try {
      if (mediaCall) mediaCall.close();
    } catch (e) {}

    mediaCall = null;
    remoteVideo.srcObject = null;

    waiting.classList.remove('hidden');
    btnShoot.disabled = true;

    peerName = null;
    $('labelRemote').textContent = 'Pasangan';

    setStatus('Pasangan terputus. Room tetap terbuka; pasangan bisa mencoba gabung lagi.');
  }

  const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

  function randomCode() {
    let s = '';

    for (let i = 0; i < 5; i++) {
      s += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
    }

    return s;
  }

  async function join(code) {
    if (joining) return;

    code = String(code || '')
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, '');

    if (!code) {
      lobbyMsg.textContent = 'Isi kode room dulu.';
      return;
    }

    joining = true;
    myName = nameInput.value.trim() || 'Aku';

    try {
      localStorage.setItem('pb-name', myName);
    } catch (e) {}

    lobbyMsg.textContent = 'Menyalakan kamera...';

    try {
      if (!cam) await startCamera();
    } catch (e) {
      joining = false;

      if (e.message === 'INSECURE') {
        lobbyMsg.textContent =
          'Kamera/mikrofon hanya bisa dipakai lewat HTTPS atau localhost. Buka situs dengan HTTPS.';
      } else if (e.message === 'MEDIA_UNAVAILABLE') {
        lobbyMsg.textContent =
          'Browser tidak mendukung akses kamera. Gunakan browser modern.';
      } else if (e.name === 'NotAllowedError') {
        lobbyMsg.textContent =
          'Izin kamera/mikrofon ditolak. Izinkan akses di browser lalu coba lagi.';
      } else {
        lobbyMsg.textContent =
          'Kamera tidak bisa diakses: ' + (e.message || e.name || 'periksa izin/perangkat');
      }

      return;
    }

    room = code;
    startPeer(code);
  }

  let myCode = randomCode();

  const codeEl = $('myCode');

  const inviteLink = () =>
    location.origin + location.pathname + '?room=' + encodeURIComponent(myCode);

  const inviteText = () =>
    `Yuk foto bareng! ${inviteLink()} (kode: ${myCode})`;

  codeEl.textContent = myCode;

  $('btnNewCode').addEventListener('click', () => {
    myCode = randomCode();
    codeEl.textContent = myCode;
  });

  $('btnCopyLobby').addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(inviteLink());
      lobbyMsg.textContent = 'Link disalin.';
    } catch (e) {
      window.prompt('Salin link:', inviteLink());
    }
  });

  $('btnShareLobby').addEventListener('click', async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Photobooth LDR',
          text: inviteText()
        });
        return;
      } catch (e) {}
    }

    window.open(
      'https://wa.me/?text=' + encodeURIComponent(inviteText()),
      '_blank'
    );
  });

  $('btnCreate').addEventListener('click', () => join(myCode));
  $('btnJoin').addEventListener('click', () => join(roomInput.value));

  roomInput.addEventListener('keydown', e => {
    if (e.key === 'Enter') join(roomInput.value);
  });

  $('btnCopy').addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(location.href);
      setStatus('Link disalin!');
    } catch (e) {
      window.prompt('Salin:', location.href);
    }
  });

  $('btnLeave').addEventListener('click', () => {
    destroyPeer();
    stopCamera();
    location.href = location.pathname;
  });

  document.addEventListener('visibilitychange', () => {
    if (
      document.visibilityState !== 'visible' ||
      !peer ||
      peer.destroyed
    ) {
      return;
    }

    if (peer.disconnected) {
      try {
        peer.reconnect();
      } catch (e) {}
    }
  });

  window.addEventListener('online', () => {
    if (peer && !peer.destroyed && peer.disconnected) {
      try {
        peer.reconnect();
      } catch (e) {}
    }
  });

  btnMic.addEventListener('click', () => {
    const t = cam && cam.getAudioTracks()[0];
    if (!t) return;

    t.enabled = !t.enabled;
    btnMic.textContent = '🎤 Mic: ' + (t.enabled ? 'On' : 'Off');
  });

  btnCam.addEventListener('click', () => {
    const t = cam && cam.getVideoTracks()[0];
    if (!t) return;

    t.enabled = !t.enabled;
    btnCam.textContent = '📹 Kamera: ' + (t.enabled ? 'On' : 'Off');
  });

  function snap(src) {
    const [c, x] = mk();

    x.fillStyle = '#000';
    x.fillRect(0, 0, W, H);

    drawCover(x, src, W, H);

    return c;
  }

  async function runSequence(count) {
    if (shooting) return;

    shooting = true;
    closeModal();
    btnShoot.disabled = true;

    const shots = [];

    try {
      for (let i = 0; i < count; i++) {
        shotInfo.textContent = `Foto ${i + 1} dari ${count} — bersiap!`;

        for (let n = 3; n >= 1; n--) {
          countdownEl.classList.remove('show');
          void countdownEl.offsetWidth;

          countdownEl.textContent = n;
          countdownEl.classList.add('show');

          await sleep(1000);
        }

        countdownEl.classList.remove('show');
        flashEl.classList.add('on');

        setTimeout(() => flashEl.classList.remove('on'), 120);

        shots.push({
          local: snap(localCanvas),
          remote: remoteVideo.srcObject && remoteVideo.readyState >= 2
            ? snap(remoteVideo)
            : null
        });

        await sleep(800);
      }

      lastShots = shots;

      shotInfo.textContent = '';
      $('btnLast').classList.remove('hidden');

      openResult();
    } finally {
      shooting = false;
      btnShoot.disabled = !(conn && conn.open && remoteVideo.srcObject);
      countdownEl.classList.remove('show');
    }
  }

  btnShoot.addEventListener('click', () => {
    if (shooting) return;

    const count = Math.max(
      1,
      Math.min(6, parseInt($('shotCount').value, 10) || 3)
    );

    send({ type: 'shoot', count });
    runSequence(count);
  });

  function isLight(hex) {
    const n = parseInt(hex.slice(1), 16);
    const r = n >> 16;
    const g = (n >> 8) & 255;
    const b = n & 255;

    return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.55;
  }

  function renderResult() {
    const n = lastShots.length;
    if (!n) return;

    const pad = 24;
    const gap = 12;
    const cw = 420;
    const ch = 315;
    const footer = 110;

    const solo = lastShots.some(s => !s.remote);

    const cvW = solo ? pad * 2 + cw : pad * 2 + cw * 2;
    const cvH = pad + n * ch + (n - 1) * gap + footer;

    resultCanvas.width = cvW;
    resultCanvas.height = cvH;

    const c = resultCanvas.getContext('2d');

    c.fillStyle = $('frameColor').value;
    c.fillRect(0, 0, cvW, cvH);

    lastShots.forEach((s, i) => {
      const y = pad + i * (ch + gap);

      if (solo) {
        c.drawImage(s.local, pad, y, cw, ch);
      } else {
        const leftImg = role === 'left' ? s.local : s.remote;
        const rightImg = role === 'left' ? s.remote : s.local;

        const tmp = document.createElement('canvas');
        tmp.width = cw * 2;
        tmp.height = ch;

        const tx = tmp.getContext('2d');

        if (leftImg) tx.drawImage(leftImg, 0, 0, cw, ch);
        if (rightImg) tx.drawImage(rightImg, cw, 0, cw, ch);

        c.drawImage(tmp, pad, y, cw * 2, ch);
      }
    });

    const dark = isLight($('frameColor').value);

    c.fillStyle = dark ? '#3b2a33' : '#ffffff';
    c.textAlign = 'center';

    c.font = 'bold 36px Georgia, serif';
    c.fillText($('captionInput').value || '', cvW / 2, cvH - footer + 44);

    c.font = '20px system-ui, sans-serif';
    c.globalAlpha = 0.8;

    const leftName = role === 'left' ? myName : (peerName || 'Pasangan');
    const rightName = role === 'left' ? (peerName || 'Pasangan') : myName;

    const date = new Date().toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });

    c.fillText(
      solo
        ? `${myName} • ${date}`
        : `${leftName} ❤ ${rightName} • ${date}`,
      cvW / 2,
      cvH - footer + 80
    );

    c.globalAlpha = 1;
  }

  function openResult() {
    modal.classList.remove('hidden');
    renderResult();
  }

  function closeModal() {
    modal.classList.add('hidden');
  }

  $('btnLast').addEventListener('click', openResult);
  $('frameColor').addEventListener('input', renderResult);
  $('captionInput').addEventListener('input', renderResult);
  $('btnClose').addEventListener('click', closeModal);

  $('btnRetake').addEventListener('click', () => {
    closeModal();
    btnShoot.click();
  });

  $('btnDownload').addEventListener('click', () => {
    resultCanvas.toBlob(blob => {
      if (!blob) {
        alert('Gagal membuat gambar. Silakan coba lagi.');
        return;
      }

      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);

      const d = new Date();
      const p = v => String(v).padStart(2, '0');

      a.download =
        `photobooth-${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}.png`;

      a.click();

      setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    }, 'image/png');
  });

  try {
    nameInput.value = localStorage.getItem('pb-name') || '';
  } catch (e) {}

  const qRoom = new URLSearchParams(location.search).get('room');

  if (qRoom) {
    roomInput.value = qRoom.toUpperCase();

    document.querySelector('.codebox')?.classList.add('hidden');
    $('btnCreate').parentElement.classList.add('hidden');
    document.querySelector('.divider')?.classList.add('hidden');

    lobbyMsg.textContent =
      'Kamu diundang ke room ' + roomInput.value + '. Isi nama lalu Gabung.';
  }
})();