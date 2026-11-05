'use strict';
// Electronics helpers for the Tools tab: resistor colour code (both ways), nearest standard
// E-series values and a smart unit converter ("20dBm", "22AWG", "1kHz", "10mil", "4k7"…).
(function (root) {
  const PREFIX = { p: -12, n: -9, u: -6, 'µ': -6, m: -3, '': 0, k: 3, K: 3, M: 6, G: 9 };

  // ------------------------------------------------------------ resistor colours
  const COLORS = [
    { id: 'black', name: 'Siyah', hex: '#1b1b1b' },
    { id: 'brown', name: 'Kahverengi', hex: '#7a4a24', tol: 1 },
    { id: 'red', name: 'Kırmızı', hex: '#d63a2f', tol: 2 },
    { id: 'orange', name: 'Turuncu', hex: '#f08a24' },
    { id: 'yellow', name: 'Sarı', hex: '#f2d23a' },
    { id: 'green', name: 'Yeşil', hex: '#2f9e4f', tol: 0.5 },
    { id: 'blue', name: 'Mavi', hex: '#2f6fd6', tol: 0.25 },
    { id: 'violet', name: 'Mor', hex: '#8a4fd1', tol: 0.1 },
    { id: 'grey', name: 'Gri', hex: '#8b8f96', tol: 0.05 },
    { id: 'white', name: 'Beyaz', hex: '#f4f4f4' },
  ];
  const GOLD = { id: 'gold', name: 'Altın', hex: '#c9a227', tol: 5, mult: -1 };
  const SILVER = { id: 'silver', name: 'Gümüş', hex: '#b8bec6', tol: 10, mult: -2 };

  /** bands: { digits: [d1, d2(, d3)], mult: exponent (-2…9), tol: percent } -> ohms */
  function fromBands(b) {
    const n = b.digits.reduce((acc, d) => acc * 10 + d, 0);
    return n * Math.pow(10, b.mult);
  }

  /** value in ohms -> bands with 2 (4-band) or 3 (5-band) significant digits */
  function toBands(v, count = 4, tol = count === 5 ? 1 : 5) {
    if (!(v > 0)) return null;
    const sig = count === 5 ? 3 : 2;
    let e = Math.floor(Math.log10(v) + 1e-9) - (sig - 1);
    let n = Math.round(v / Math.pow(10, e));
    if (n >= Math.pow(10, sig)) { n = Math.round(n / 10); e += 1; }
    if (e < -2) { n = Math.round(v * 100); e = -2; if (n < 1) return null; }
    if (e > 9 || n >= Math.pow(10, sig)) return null;
    const digits = String(n).padStart(sig, '0').split('').map(Number);
    return { digits, mult: e, tol };
  }

  const multColor = (e) => (e === -1 ? GOLD : e === -2 ? SILVER : COLORS[e]);
  const tolColor = (t) => [...COLORS, GOLD, SILVER].find((c) => c.tol === t) || GOLD;

  /** the colours of all bands, left to right */
  function bandColors(b) {
    return [...b.digits.map((d) => COLORS[d]), multColor(b.mult), tolColor(b.tol)];
  }

  // ------------------------------------------------------------ E-series
  const E12 = [10, 12, 15, 18, 22, 27, 33, 39, 47, 56, 68, 82];
  const E24 = [10, 11, 12, 13, 15, 16, 18, 20, 22, 24, 27, 30, 33, 36, 39, 43, 47, 51, 56, 62, 68, 75, 82, 91];
  const E96 = [100, 102, 105, 107, 110, 113, 115, 118, 121, 124, 127, 130, 133, 137, 140, 143, 147, 150, 154, 158, 162, 165, 169, 174, 178, 182, 187, 191, 196, 200, 205, 210, 215, 221, 226, 232, 237, 243, 249, 255, 261, 267, 274, 280, 287, 294, 301, 309, 316, 324, 332, 340, 348, 357, 365, 374, 383, 392, 402, 412, 422, 432, 442, 453, 464, 475, 487, 499, 511, 523, 536, 549, 562, 576, 590, 604, 619, 634, 649, 665, 681, 698, 715, 732, 750, 768, 787, 806, 825, 845, 866, 887, 909, 931, 953, 976];

  function nearest(v, series) {
    if (!(v > 0)) return null;
    const list = series === 96 ? E96 : series === 12 ? E12 : E24;
    const base = list[0];
    const dec = Math.floor(Math.log10(v / base) + 1e-9);
    let best = null;
    for (const d of [dec - 1, dec, dec + 1]) {
      for (const x of list) {
        const c = x * Math.pow(10, d);
        if (!best || Math.abs(Math.log(c / v)) < Math.abs(Math.log(best / v))) best = c;
      }
    }
    return +best.toPrecision(3);
  }

  // ------------------------------------------------------------ numbers and units
  function si(v, unit = '', digits = 4) {
    if (v === 0) return `0 ${unit}`.trim();
    if (!Number.isFinite(v)) return '–';
    const steps = [[1e9, 'G'], [1e6, 'M'], [1e3, 'k'], [1, ''], [1e-3, 'm'], [1e-6, 'µ'], [1e-9, 'n'], [1e-12, 'p']];
    const a = Math.abs(v);
    const [k, p] = steps.find(([s]) => a >= s * 0.9999) || steps[steps.length - 1];
    const n = +(v / k).toPrecision(digits);
    return `${String(n).replace('.', ',')} ${p}${unit}`.trim();
  }
  const num = (v, d = 4) => String(+Number(v).toPrecision(d)).replace('.', ',');

  /**
   * "4.7k" "4k7" "220R" "20 dBm" "22AWG" "1kHz" "100nF" "25°C" "10mil" -> { v, unit, raw }
   * v is in base units (ohm, Hz, F…); for dB / dBm / AWG / temperature v is the number as typed.
   */
  function parse(src) {
    let s = String(src || '').trim().replace(/,/g, '.').replace(/\s+/g, '').replace(/Ω|ohm(s)?/gi, 'R');
    if (!s) return null;
    // RKM code: 4k7, 2R2, 1M5, 0R1
    const rkm = /^(\d+)([RKkMGm])(\d+)$/.exec(s);
    if (rkm) {
      const e = rkm[2] === 'R' ? 0 : PREFIX[rkm[2]];
      return { v: Number(`${rkm[1]}.${rkm[3]}`) * Math.pow(10, e), unit: 'R' };
    }
    const m = /^(-?\d*\.?\d+(?:e[-+]?\d+)?)(.*)$/i.exec(s);
    if (!m) return null;
    const n = Number(m[1]);
    let rest = m[2];
    // units without prefixes first
    const exact = {
      dbm: 'dBm', dbw: 'dBW', db: 'dB', awg: 'AWG', '°c': 'C', c: 'C', '°f': '°F', degf: '°F', k: null, mil: 'mil', mils: 'mil', in: 'in', inch: 'in', '"': 'in', mm: 'mm', mm2: 'mm2', 'mm²': 'mm2', r: 'R',
    };
    const low = rest.toLowerCase();
    if (low in exact && exact[low]) return { v: n, unit: exact[low] };
    // prefix + unit (Hz, F, H, V, A, W, s, R) or just a prefix
    const pm = /^([pnuµmkKMG]?)(hz|f|h|v|a|w|s|r)?$/i.exec(rest);
    if (pm) {
      let p = pm[1];
      let u = (pm[2] || '').toLowerCase();
      // "m" alone is milli; "M" mega. A lone "F"/"H" etc. keeps its unit.
      if (p === '' && !u) return { v: n, unit: '' };
      const e = PREFIX[p] ?? 0;
      const unit = { hz: 'Hz', f: 'F', h: 'H', v: 'V', a: 'A', w: 'W', s: 's', r: 'R', '': '' }[u];
      return { v: n * Math.pow(10, e), unit };
    }
    return null;
  }

  // AWG: d(mm) = 0.127 * 92^((36 - n) / 39)
  const awgDiameter = (n) => 0.127 * Math.pow(92, (36 - n) / 39);
  const awgFromArea = (mm2) => {
    const d = Math.sqrt((4 * mm2) / Math.PI);
    return 36 - 39 * Math.log(d / 0.127) / Math.log(92);
  };
  const capCode = (f) => {
    const pf = f * 1e12;
    if (pf < 10) return null;
    const e = Math.floor(Math.log10(pf)) - 1;
    const d = Math.round(pf / Math.pow(10, e));
    if (d >= 100) return `${String(d).slice(0, 2)}${e + 1}`;
    return e >= 0 && e <= 9 ? `${d}${e}` : null;
  };

  /** -> [{ k: label, v: text }] */
  function convert(src) {
    const q = parse(src);
    if (!q) return [];
    const { v, unit } = q;
    const out = [];
    const add = (k, val) => { if (val != null && val !== '') out.push({ k, v: val }); };
    switch (unit) {
      case 'Hz':
        add('Periyot', si(1 / v, 's'));
        add('Açısal frekans', si(2 * Math.PI * v, 'rad/s'));
        add('Dalga boyu (havada)', si(299792458 / v, 'm'));
        break;
      case 's':
        add('Frekans', si(1 / v, 'Hz'));
        break;
      case 'dBm': {
        const w = Math.pow(10, v / 10) / 1000;
        add('Güç', si(w, 'W'));
        add('dBW', `${num(v - 30)} dBW`);
        add('Gerilim (50 Ω)', si(Math.sqrt(w * 50), 'V') + ' rms');
        break;
      }
      case 'dBW':
        add('Güç', si(Math.pow(10, v / 10), 'W'));
        add('dBm', `${num(v + 30)} dBm`);
        break;
      case 'W':
        if (v > 0) { add('dBm', `${num(10 * Math.log10(v * 1000))} dBm`); add('dBW', `${num(10 * Math.log10(v))} dBW`); }
        break;
      case 'dB':
        add('Güç oranı', `× ${num(Math.pow(10, v / 10))}`);
        add('Gerilim oranı', `× ${num(Math.pow(10, v / 20))}`);
        break;
      case 'AWG': {
        const d = awgDiameter(v);
        const a = (Math.PI / 4) * d * d;
        add('Çap', `${num(d, 3)} mm`);
        add('Kesit', `${num(a, 3)} mm²`);
        add('Bakır direnci', `${num((0.01724 / a) * 1000, 3)} Ω/km`);
        add('Akım (yaklaşık, kablo içi)', `${num(Math.max(0.1, a * 3.5), 2)} A`);
        break;
      }
      case 'mm2':
        add('En yakın AWG', `${Math.round(awgFromArea(v))} AWG`);
        add('Çap', `${num(Math.sqrt((4 * v) / Math.PI), 3)} mm`);
        break;
      case 'C':
        add('Fahrenheit', `${num(v * 9 / 5 + 32)} °F`);
        add('Kelvin', `${num(v + 273.15, 5)} K`);
        break;
      case '°F':
        add('Celsius', `${num((v - 32) * 5 / 9)} °C`);
        break;
      case 'mil':
        add('Milimetre', `${num(v * 0.0254)} mm`);
        break;
      case 'in':
        add('Milimetre', `${num(v * 25.4)} mm`);
        add('mil', `${num(v * 1000)} mil`);
        break;
      case 'mm':
        add('mil', `${num(v / 0.0254)} mil`);
        add('İnç', `${num(v / 25.4)} in`);
        break;
      case 'F': {
        add('pF / nF / µF', `${num(v * 1e12)} pF · ${num(v * 1e9)} nF · ${num(v * 1e6)} µF`);
        const code = capCode(v);
        if (code) add('Kondansatör kodu', code);
        break;
      }
      case 'H':
        add('µH / mH', `${num(v * 1e6)} µH · ${num(v * 1e3)} mH`);
        break;
      case 'V': case 'A':
        add('Değer', si(v, unit));
        break;
      case 'R':
      case '': {
        const b = toBands(v, 4);
        add('Direnç', si(v, 'Ω'));
        add('E12 / E24 / E96', `${si(nearest(v, 12), 'Ω', 3)} · ${si(nearest(v, 24), 'Ω', 3)} · ${si(nearest(v, 96), 'Ω', 3)}`);
        if (b) add('Renk kodu', bandColors(b).map((c) => c.name).join(' · '));
        break;
      }
      default:
        break;
    }
    return out;
  }

  const api = { COLORS, GOLD, SILVER, fromBands, toBands, bandColors, multColor, tolColor, nearest, parse, convert, si, awgDiameter, capCode };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.AdaElec = api;
})(typeof window !== 'undefined' ? window : globalThis);
