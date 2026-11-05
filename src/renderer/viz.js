'use strict';
/* global Ada, ada */
// Live sound bars: listens to what the computer is playing (Windows loopback capture, nothing is
// recorded or sent anywhere) and drives every [data-viz] element's bars plus --lvl on the island.
// Runs only while music is playing and the island shows it; otherwise the bars fall back to CSS.
(() => {
  const V = {
    on: false, starting: false, failedAt: 0,
    ctx: null, stream: null, analyser: null, data: null, timer: null,
    bars: [0, 0, 0, 0, 0], level: 0, stopTimer: null,
  };
  // band edges in Hz for five bars: bass … air
  const EDGES = [35, 140, 400, 1100, 3000, 9000];

  async function getStream() {
    // 1) getDisplayMedia; the main process answers with the screen + system audio (loopback)
    try {
      const s = await navigator.mediaDevices.getDisplayMedia({ audio: true, video: { width: 16, height: 16, frameRate: 1 } });
      if (s.getAudioTracks().length) return s;
      s.getTracks().forEach((t) => t.stop());
    } catch { /* try the older way */ }
    // 2) the older Chromium desktop capture constraints (Windows only for audio)
    for (const withId of [false, true]) {
      try {
        const id = withId ? await ada.vizSource() : null;
        if (withId && !id) break;
        const s = await navigator.mediaDevices.getUserMedia({
          audio: { mandatory: { chromeMediaSource: 'desktop' } },
          video: { mandatory: { chromeMediaSource: 'desktop', ...(id ? { chromeMediaSourceId: id } : {}), maxWidth: 16, maxHeight: 16, maxFrameRate: 1 } },
        });
        if (s.getAudioTracks().length) return s;
        s.getTracks().forEach((t) => t.stop());
      } catch { /* not available */ }
    }
    return null;
  }

  function useStream(stream) {
    stop(true);
    // only the sound is needed
    stream.getVideoTracks().forEach((t) => t.stop());
    V.stream = stream;
    V.ctx = new AudioContext();
    const src = V.ctx.createMediaStreamSource(stream);
    V.analyser = V.ctx.createAnalyser();
    V.analyser.fftSize = 1024;
    V.analyser.smoothingTimeConstant = 0.72;
    V.analyser.minDecibels = -88;
    V.analyser.maxDecibels = -22;
    src.connect(V.analyser);   // not connected to the speakers: no echo
    V.data = new Uint8Array(V.analyser.frequencyBinCount);
    V.on = true;
    clearInterval(V.timer);
    V.timer = setInterval(frame, 33);
  }

  function frame() {
    if (!V.analyser) return;
    V.analyser.getByteFrequencyData(V.data);
    const hzPerBin = V.ctx.sampleRate / V.analyser.fftSize;
    for (let b = 0; b < 5; b++) {
      const from = Math.max(1, Math.floor(EDGES[b] / hzPerBin));
      const to = Math.max(from + 1, Math.ceil(EDGES[b + 1] / hzPerBin));
      let sum = 0;
      let peak = 0;
      for (let i = from; i < to && i < V.data.length; i++) { sum += V.data[i]; if (V.data[i] > peak) peak = V.data[i]; }
      const avg = sum / (to - from) / 255;
      const v = Math.min(1, Math.pow(avg * 0.6 + (peak / 255) * 0.4, 1.25) * 1.15);
      // fast attack, slower release: bars feel springy instead of jittery
      V.bars[b] = v > V.bars[b] ? v : V.bars[b] * 0.82 + v * 0.18;
    }
    const lvl = V.bars[0] * 0.45 + V.bars[1] * 0.3 + V.bars[2] * 0.25;
    V.level = V.level * 0.6 + lvl * 0.4;
    paint();
  }

  function paint() {
    const root = Ada.island;
    root.style.setProperty('--lvl', V.on ? V.level.toFixed(3) : '0');
    root.querySelectorAll('[data-viz]').forEach((el) => {
      el.classList.toggle('live', V.on);
      const bars = el.children;
      const n = bars.length;
      for (let k = 0; k < n; k++) {
        const v = V.on ? V.bars[n === 1 ? 0 : Math.round((k * 4) / (n - 1))] : 0;
        bars[k].style.height = V.on ? `${Math.round(18 + v * 82)}%` : '';
      }
    });
  }

  function stop(now) {
    clearTimeout(V.stopTimer);
    V.stopTimer = null;
    const kill = () => {
      V.stopTimer = null;
      clearInterval(V.timer);
      V.timer = null;
      if (V.stream) V.stream.getTracks().forEach((t) => t.stop());
      if (V.ctx) V.ctx.close().catch(() => {});
      V.stream = null; V.ctx = null; V.analyser = null; V.on = false;
      V.bars = [0, 0, 0, 0, 0]; V.level = 0;
      paint();
    };
    if (now) kill(); else V.stopTimer = setTimeout(kill, 4000); // a short gap between songs keeps it running
  }

  async function start() {
    clearTimeout(V.stopTimer);
    V.stopTimer = null;
    if (V.on || V.starting) return;
    if (V.failedAt && Date.now() - V.failedAt < 60 * 1000) return;
    V.starting = true;
    const s = await getStream();
    V.starting = false;
    if (!s) { V.failedAt = Date.now(); return; }
    if (!wanted()) { s.getTracks().forEach((t) => t.stop()); return; }
    useStream(s);
  }

  function wanted() {
    return Ada.S.config.visualizer !== false && typeof Ada.musicPlaying === 'function' && Ada.musicPlaying()
      && document.visibilityState === 'visible';
  }

  setInterval(() => {
    if (wanted()) start();
    else if (V.on && !V.stopTimer) stop(false);
    else if (!V.on) paint();
  }, 600);

  Ada.viz = {
    get on() { return V.on; },
    get level() { return V.level; },
    useStream,             // tests feed a generated stream here
    stop: () => stop(true),
  };
})();
