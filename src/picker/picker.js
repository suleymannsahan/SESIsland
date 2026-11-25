'use strict';
/* global picker */
// Full-screen colour picker: a frozen screenshot of the display, a magnifier under the cursor.
(() => {
  const shot = document.getElementById('shot');
  const zoom = document.getElementById('zoom');
  const loupe = document.getElementById('loupe');
  const hexEl = document.getElementById('hex');
  const src = document.createElement('canvas');   // the screenshot at its real pixel size
  const sctx = src.getContext('2d', { willReadFrequently: true });
  const zctx = zoom.getContext('2d');
  const N = 11;                                    // pixels across the magnifier
  let scale = 1;
  let pos = null;                                  // in physical pixels
  let ready = false;

  const hex = (r, g, b) => '#' + [r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('').toUpperCase();

  picker.onImage(({ dataUrl, scaleFactor }) => {
    const img = new Image();
    img.onload = () => {
      src.width = img.naturalWidth;
      src.height = img.naturalHeight;
      sctx.drawImage(img, 0, 0);
      scale = img.naturalWidth / window.innerWidth || scaleFactor || 1;
      shot.width = img.naturalWidth;
      shot.height = img.naturalHeight;
      shot.getContext('2d').drawImage(img, 0, 0);
      ready = true;
      if (pos) draw();
    };
    img.src = dataUrl;
  });

  function color() {
    const x = Math.max(0, Math.min(src.width - 1, Math.round(pos.x)));
    const y = Math.max(0, Math.min(src.height - 1, Math.round(pos.y)));
    const d = sctx.getImageData(x, y, 1, 1).data;
    return { r: d[0], g: d[1], b: d[2], hex: hex(d[0], d[1], d[2]) };
  }

  function draw() {
    if (!ready || !pos) return;
    const x = Math.round(pos.x);
    const y = Math.round(pos.y);
    const half = (N - 1) / 2;
    const cell = zoom.width / N;
    zctx.imageSmoothingEnabled = false;
    zctx.clearRect(0, 0, zoom.width, zoom.height);
    zctx.drawImage(src, x - half, y - half, N, N, 0, 0, zoom.width, zoom.height);
    // grid + the centre pixel
    zctx.strokeStyle = 'rgba(255,255,255,.12)';
    zctx.lineWidth = 1;
    for (let i = 1; i < N; i++) {
      zctx.beginPath(); zctx.moveTo(i * cell, 0); zctx.lineTo(i * cell, zoom.height); zctx.stroke();
      zctx.beginPath(); zctx.moveTo(0, i * cell); zctx.lineTo(zoom.width, i * cell); zctx.stroke();
    }
    zctx.strokeStyle = '#fff';
    zctx.lineWidth = 2;
    zctx.strokeRect(half * cell, half * cell, cell, cell);
    const c = color();
    hexEl.innerHTML = '';
    const sw = document.createElement('i');
    sw.style.background = c.hex;
    hexEl.append(sw, document.createTextNode(c.hex));
    // keep the magnifier on screen
    const cx = pos.x / scale;
    const cy = pos.y / scale;
    const lx = cx + 150 > window.innerWidth ? cx - 160 : cx + 24;
    const ly = cy + 180 > window.innerHeight ? cy - 190 : cy + 24;
    loupe.style.transform = `translate(${Math.round(lx)}px, ${Math.round(ly)}px)`;
    loupe.hidden = false;
  }

  window.addEventListener('mousemove', (e) => { pos = { x: e.clientX * scale, y: e.clientY * scale }; draw(); });
  window.addEventListener('mousedown', (e) => {
    if (e.button !== 0) { picker.cancel(); return; }
    if (!ready) return;
    pos = { x: e.clientX * scale, y: e.clientY * scale };
    picker.done(color());
  });
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { picker.cancel(); return; }
    if (!pos) return;
    const step = e.shiftKey ? 10 : 1;
    if (e.key === 'ArrowLeft') pos.x -= step;
    else if (e.key === 'ArrowRight') pos.x += step;
    else if (e.key === 'ArrowUp') pos.y -= step;
    else if (e.key === 'ArrowDown') pos.y += step;
    else if (e.key === 'Enter') { picker.done(color()); return; }
    else return;
    e.preventDefault();
    draw();
  });
  window.addEventListener('contextmenu', (e) => { e.preventDefault(); picker.cancel(); });
})();
