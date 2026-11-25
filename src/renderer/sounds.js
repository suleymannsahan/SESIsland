'use strict';
// Ada's sounds, made on the spot with Web Audio (no sound files). Four packs:
//   klasik   – the clear bell tones Ada always had
//   yumusak  – soft, low, slowly fading marimba-like notes
//   mekanik  – short clicks and ticks, like a mechanical keyboard
//   bit      – square-wave blips, like an old game console
// kinds: done · ask · pomo · alarm · hello
(() => {
  let ctx = null;
  const NOTES = {
    done: [659.25, 987.77],
    ask: [880, 880],
    pomo: [523.25, 659.25, 783.99],
    alarm: [783.99, 987.77, 783.99, 987.77, 1174.66],
    hello: [523.25, 783.99, 1046.5],
  };
  const GAP = { done: 0.12, ask: 0.18, pomo: 0.16, alarm: 0.15, hello: 0.11 };

  function audio() {
    ctx = ctx || new AudioContext();
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    return ctx;
  }

  function tone(a, t, f, { type = 'sine', peak = 0.11, attack = 0.015, decay = 0.7, filter = 0, detune = 0 } = {}) {
    const o = a.createOscillator();
    const g = a.createGain();
    o.type = type;
    o.frequency.value = f;
    o.detune.value = detune;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(peak, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + decay);
    let out = o.connect(g);
    if (filter) {
      const lp = a.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = filter;
      out = out.connect(lp);
    }
    out.connect(a.destination);
    o.start(t);
    o.stop(t + decay + 0.05);
  }

  // a short burst of filtered noise: the "click" of a key
  let noiseBuf = null;
  function click(a, t, { freq = 2400, peak = 0.22, len = 0.035 } = {}) {
    if (!noiseBuf) {
      noiseBuf = a.createBuffer(1, Math.floor(a.sampleRate * 0.08), a.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    const src = a.createBufferSource();
    src.buffer = noiseBuf;
    const bp = a.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = freq;
    bp.Q.value = 1.4;
    const g = a.createGain();
    g.gain.setValueAtTime(peak, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + len);
    src.connect(bp).connect(g).connect(a.destination);
    src.start(t);
    src.stop(t + len + 0.02);
  }

  const PACKS = {
    klasik(a, kind, t0) {
      NOTES[kind].forEach((f, i) => tone(a, t0 + i * GAP[kind], f));
    },
    yumusak(a, kind, t0) {
      const gap = GAP[kind] * 1.5;
      NOTES[kind].forEach((f, i) => {
        tone(a, t0 + i * gap, f / 2, { type: 'triangle', peak: 0.13, attack: 0.03, decay: 1.4, filter: 1400 });
        tone(a, t0 + i * gap, f, { type: 'sine', peak: 0.03, attack: 0.04, decay: 0.9 });
      });
    },
    mekanik(a, kind, t0) {
      const n = { done: 2, ask: 3, pomo: 3, alarm: 6, hello: 2 }[kind];
      for (let i = 0; i < n; i++) {
        const t = t0 + i * (kind === 'alarm' ? 0.11 : 0.085);
        click(a, t, { freq: i % 2 ? 1800 : 2600 });
        click(a, t + 0.012, { freq: 900, peak: 0.12, len: 0.05 });
      }
      // the last key "lands" with a little pitch so done and ask still sound different
      const end = t0 + n * 0.09;
      tone(a, end, kind === 'ask' ? 660 : 990, { type: 'sine', peak: 0.05, attack: 0.005, decay: 0.18 });
    },
    bit(a, kind, t0) {
      const gap = GAP[kind] * 0.7;
      NOTES[kind].forEach((f, i) => {
        // each note is a quick arpeggio of the note and its fifth, the old-console way
        for (let j = 0; j < 3; j++) {
          const t = t0 + i * gap * 1.6 + j * gap * 0.33;
          tone(a, t, j === 1 ? f * 1.5 : f, { type: 'square', peak: 0.045, attack: 0.002, decay: gap * 0.45 });
        }
      });
    },
  };

  function play(kind, pack = 'klasik') {
    if (!NOTES[kind]) kind = 'ask';
    try {
      const a = audio();
      (PACKS[pack] || PACKS.klasik)(a, kind, a.currentTime + 0.01);
    } catch { /* audio unavailable */ }
  }

  window.AdaSound = { play, packs: Object.keys(PACKS) };
})();
