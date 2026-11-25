'use strict';
// Weather from Open-Meteo (free, no key, no account). The place is a city the user types once in
// Settings; only its coordinates are sent to Open-Meteo. Refreshed every 20 minutes.
const { EventEmitter } = require('events');

// WMO weather codes -> a simple kind (drives the lighthouse's weather) + Turkish words
const CODES = [
  [[0], 'clear', 'Açık'],
  [[1], 'clear', 'Az bulutlu'],
  [[2], 'partly', 'Parçalı bulutlu'],
  [[3], 'cloudy', 'Kapalı'],
  [[45, 48], 'fog', 'Sisli'],
  [[51, 53, 55, 56, 57], 'drizzle', 'Çisenti'],
  [[61, 63, 66, 80, 81], 'rain', 'Yağmurlu'],
  [[65, 67, 82], 'rain', 'Sağanak'],
  [[71, 73, 77, 85], 'snow', 'Karlı'],
  [[75, 86], 'snow', 'Yoğun kar'],
  [[95], 'storm', 'Gök gürültülü'],
  [[96, 99], 'storm', 'Dolu ve fırtına'],
];
function describe(code) {
  for (const [list, kind, text] of CODES) if (list.includes(Number(code))) return { kind, text };
  return { kind: 'cloudy', text: 'Bulutlu' };
}

class Weather extends EventEmitter {
  constructor(fetchFn) {
    super();
    this.fetch = fetchFn || globalThis.fetch;
    this.place = null;     // { name, admin, country, lat, lon }
    this.state = { configured: false };
    this.timer = null;
  }

  setPlace(place) {
    this.place = place && Number.isFinite(place.lat) && Number.isFinite(place.lon) ? place : null;
    this.state = { configured: !!this.place, place: this.place };
    this.push();
  }

  /** "Trabzon" -> [{ name, admin, country, lat, lon }] (up to 5) */
  async find(name) {
    const q = String(name || '').trim();
    if (!q) return [];
    const res = await this.fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q)}&count=5&language=tr&format=json`);
    if (!res.ok) throw new Error(`Şehir aranamadı (${res.status})`);
    const j = await res.json();
    return (j.results || []).map((r) => ({ name: r.name, admin: r.admin1 || '', country: r.country || '', lat: r.latitude, lon: r.longitude }));
  }

  start() {
    this.stop();
    if (!this.place) return;
    const tick = async () => {
      await this.refresh().catch(() => {});
      this.timer = setTimeout(tick, 20 * 60 * 1000);
    };
    tick();
  }

  stop() { clearTimeout(this.timer); }

  async refresh() {
    if (!this.place) return this.state;
    const { lat, lon } = this.place;
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}`
      + '&current=temperature_2m,apparent_temperature,weather_code,is_day,wind_speed_10m,relative_humidity_2m,precipitation'
      + '&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,sunrise,sunset'
      + '&timezone=auto&forecast_days=4';
    try {
      const res = await this.fetch(url);
      if (!res.ok) throw new Error(`Hava durumu alınamadı (${res.status})`);
      const j = await res.json();
      const c = j.current || {};
      const d = j.daily || {};
      const now = { temp: Math.round(c.temperature_2m), feels: Math.round(c.apparent_temperature), code: c.weather_code, isDay: !!c.is_day, wind: Math.round(c.wind_speed_10m), humidity: c.relative_humidity_2m, ...describe(c.weather_code) };
      const days = (d.time || []).map((t, i) => ({
        date: t, max: Math.round(d.temperature_2m_max[i]), min: Math.round(d.temperature_2m_min[i]),
        rain: d.precipitation_probability_max ? d.precipitation_probability_max[i] : null,
        code: d.weather_code[i], ...describe(d.weather_code[i]),
      }));
      this.state = { configured: true, place: this.place, now, days, sunrise: d.sunrise && d.sunrise[0], sunset: d.sunset && d.sunset[0], updated: Date.now() };
    } catch (e) {
      this.state = { ...this.state, configured: true, place: this.place, error: e.message };
    }
    this.push();
    return this.state;
  }

  push() { this.emit('state', this.state); }
}

module.exports = { Weather, describe };
