'use strict';
// Engineering calculator for the island. A small recursive-descent parser (no eval):
//   numbers with SI prefixes      4.7k  10u  2M  100n  3m  (µ works too)
//   operators                    + - * / ^ %  ( )   and  a || b  for parallel resistors
//   functions                    sqrt sin cos tan asin acos atan ln log log2 abs exp round floor ceil db
//   constants                    pi  e
//   units after numbers           12V 20mA 100nF 50Hz (ignored, the prefix still counts)
//   ans                          the previous result
(function (root) {
  const PREFIX = { p: 1e-12, n: 1e-9, u: 1e-6, 'µ': 1e-6, m: 1e-3, k: 1e3, K: 1e3, M: 1e6, G: 1e9, T: 1e12 };
  const FUNCS = {
    sqrt: Math.sqrt, sin: Math.sin, cos: Math.cos, tan: Math.tan, asin: Math.asin, acos: Math.acos, atan: Math.atan,
    ln: Math.log, log: Math.log10, log2: Math.log2, abs: Math.abs, exp: Math.exp, round: Math.round,
    floor: Math.floor, ceil: Math.ceil, db: (x) => 20 * Math.log10(x),
  };
  const CONSTS = { pi: Math.PI, e: Math.E };

  function tokenize(src) {
    const t = [];
    let i = 0;
    const s = String(src).replace(/,/g, '.').replace(/×/g, '*').replace(/÷/g, '/').replace(/Ω|ohm/gi, '');
    while (i < s.length) {
      const c = s[i];
      if (/\s/.test(c)) { i++; continue; }
      if (c === '|' && s[i + 1] === '|') { t.push({ op: '||' }); i += 2; continue; }
      if ('+-*/^%()'.includes(c)) { t.push({ op: c }); i++; continue; }
      const num = /^(\d+\.?\d*|\.\d+)(e[-+]?\d+)?/i.exec(s.slice(i));
      if (num) {
        let v = parseFloat(num[0]);
        i += num[0].length;
        // SI prefix right after the number (but not the start of a word like "max")
        const p = s[i];
        if (p && p in PREFIX && !/[a-z]/i.test(s[i + 1] || '')) { v *= PREFIX[p]; i++; }
        else if (p && p in PREFIX && /^[pnuµmkKMGT](V|A|W|F|H|Hz)(?![a-z])/.test(s.slice(i))) { v *= PREFIX[p]; i++; }
        // a unit symbol after the number is ignored: 12V, 20mA, 100nF, 50Hz
        const unit = /^(Hz|V|A|W|F|H)(?![a-zA-Z])/.exec(s.slice(i));
        if (unit) i += unit[0].length;
        t.push({ num: v });
        continue;
      }
      const id = /^[a-zA-Zµ_]\w*/.exec(s.slice(i));
      if (id) { t.push({ id: id[0].toLowerCase() }); i += id[0].length; continue; }
      throw new Error(`Anlaşılmayan karakter: ${c}`);
    }
    return t;
  }

  function parse(tokens, ans) {
    let i = 0;
    const peek = () => tokens[i];
    const take = (op) => { if (peek() && peek().op === op) { i++; return true; } return false; };

    function expr() {               // + -
      let v = term();
      for (;;) {
        if (take('+')) v += term();
        else if (take('-')) v -= term();
        else return v;
      }
    }
    function term() {               // * / % ||  and implicit multiplication: 2pi, 3(4+1)
      let v = unary();
      for (;;) {
        if (take('*')) v *= unary();
        else if (take('/')) v /= unary();
        else if (take('%')) v %= unary();
        else if (take('||')) { const b = unary(); v = 1 / (1 / v + 1 / b); }
        else if (peek() && (peek().op === '(' || peek().id !== undefined)) v *= unary();
        else return v;
      }
    }
    function unary() {
      if (take('-')) return -unary();
      if (take('+')) return unary();
      return power();
    }
    function power() {
      const b = atom();
      if (take('^')) return Math.pow(b, unary());
      return b;
    }
    function atom() {
      const tk = peek();
      if (!tk) throw new Error('İfade eksik');
      if (tk.num !== undefined) { i++; return tk.num; }
      if (tk.op === '(') {
        i++;
        const v = expr();
        if (!take(')')) throw new Error('Kapanmayan parantez');
        return v;
      }
      if (tk.id !== undefined) {
        i++;
        if (tk.id === 'ans') return ans ?? 0;
        if (tk.id in CONSTS) return CONSTS[tk.id];
        if (tk.id in FUNCS) {
          if (!take('(')) throw new Error(`${tk.id}( bekleniyor`);
          const v = expr();
          if (!take(')')) throw new Error('Kapanmayan parantez');
          return FUNCS[tk.id](v);
        }
        throw new Error(`Bilinmeyen: ${tk.id}`);
      }
      throw new Error('Beklenmeyen işaret');
    }

    const v = expr();
    if (i < tokens.length) throw new Error('Fazladan bir şey var');
    return v;
  }

  function evaluate(src, ans) {
    const tokens = tokenize(src);
    if (!tokens.length) return null;
    const v = parse(tokens, ans);
    if (!Number.isFinite(v)) throw new Error('Sonuç tanımsız');
    return v;
  }

  /** 4700 -> "4.7k", 0.000022 -> "22µ" */
  function si(v) {
    if (v === 0) return '0';
    const steps = [[1e12, 'T'], [1e9, 'G'], [1e6, 'M'], [1e3, 'k'], [1, ''], [1e-3, 'm'], [1e-6, 'µ'], [1e-9, 'n'], [1e-12, 'p']];
    const a = Math.abs(v);
    for (const [f, p] of steps) {
      if (a >= f * 0.9999999) return +(v / f).toPrecision(4) + p;
    }
    return v.toExponential(3);
  }

  function plain(v) {
    const a = Math.abs(v);
    if (a !== 0 && (a >= 1e9 || a < 1e-4)) return v.toExponential(4);
    return String(+v.toPrecision(10));
  }

  const api = { evaluate, si, plain };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.AdaCalc = api;
})(typeof window !== 'undefined' ? window : globalThis);
