# Ada eklentileri

Bir eklenti adaya yeni bir sekme ekler. Eklentiler, Ada'nın kendi sekmeleriyle aynı yolla yazılır: tek bir JavaScript dosyası ve `Ada.tab({...})` çağrısı.

Hazır bir örnek için Ayarlar → Eklentiler → **Örnek eklentiyi kur (Döviz)** düğmesine bas. Kaynağı [`src/plugins-example/doviz`](src/plugins-example/doviz) klasöründe.

## Klasör yapısı

Eklentiler Ada'nın ayar klasöründeki `plugins` klasöründe durur (`%APPDATA%\Ada\plugins`). Ayarlar → Eklentiler → **Eklenti klasörünü aç** seni oraya götürür.

```
plugins/
  benim-eklentim/
    plugin.json
    tab.js
    style.css      (isteğe bağlı)
    ikon.svg …     (isteğe bağlı: png, svg, jpg, webp, json)
```

Klasörün adı, eklentinin `id`'si ile aynı olmalı.

## plugin.json

```json
{
  "id": "benim-eklentim",
  "name": "Benim eklentim",
  "version": "1.0.0",
  "description": "Ne işe yaradığı, tek cümle.",
  "author": "Adın",
  "homepage": "https://github.com/...",
  "main": "tab.js",
  "style": "style.css"
}
```

| Alan | Zorunlu | Açıklama |
| --- | --- | --- |
| `id` | evet | Küçük harf, rakam ve `-`; 2–40 karakter. Klasör adıyla aynı. |
| `name` | evet | Ayarlarda ve sekmede görünen ad. |
| `main` | evet | Çalışacak betik (`.js`). |
| `style` | hayır | Yüklenecek stil dosyası (`.css`). |
| `version`, `description`, `author`, `homepage` | hayır | Ayarlarda gösterilir. |

Yeni bir eklentiyi klasöre koyduktan sonra Ayarlar → Eklentiler listesinde açman gerekir. Açılan eklentiyle birlikte ada yeniden yüklenir.

## Bir sekme

```js
(() => {
  const { esc } = Ada;          // Ada'nın yardımcıları
  let sayac = 0;

  Ada.tab({
    id: 'plugin-benim',         // eşsiz olsun; "plugin-" ile başlatman önerilir
    label: 'Benim',             // fareyle üstüne gelince görünür
    icon: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8"/></svg>',
    body() {                    // panelde gösterilecek HTML
      return `<div class="today"><h3>Merhaba</h3>
        <p>${sayac} kez tıkladın</p>
        <button class="btn-allow sm" data-act="benim:tik">Tıkla</button></div>`;
    },
    onAct(act, id) {            // data-act'li öğelere basılınca
      if (act !== 'benim:tik') return false;
      sayac++;
      Ada.render();
      return true;              // "bunu ben hallettim"
    },
  });
})();
```

### `Ada.tab()` alanları

| Alan | Ne zaman çağrılır |
| --- | --- |
| `id`, `label`, `icon` | Sekme rayı için. `icon` bir SVG metnidir. |
| `body()` | Panel açıkken her çizimde. HTML metni döndürür. |
| `onAct(act, id, el)` | `data-act` taşıyan bir öğeye basılınca. `true` döndürürsen başka kimse işlemez. |
| `onEnter()` / `onLeave()` | Sekmeye girilince / çıkılınca. |
| `tick(root, force, visible)` | Saniyede beş kez; sayaç gibi canlı metinleri burada güncelle. |
| `after(root, rebuilt)` | Panel çizildikten sonra. |
| `badge()` | Raydaki simgenin yanına küçük bir işaret (HTML). |
| `pill()` | Ada toplanmışken gösterilecek hap: `{ status, html }` ya da `null`. `pillRank` küçük olan önce gelir. |
| `onEvent(ev)` | Adaya gelen olaylar (Claude bitti, Pomodoro bitti…). |
| `init()` | Eklenti yüklenince bir kez. |

### Yardımcılar

- `Ada.render()`: yeniden çiz.
- `Ada.toast({ kind: 'info' | 'error', text })`: kısa bildirim.
- `Ada.showCard({ key, status, html, until | sticky })`: adada kart göster; `Ada.closeCard()` kapatır.
- `Ada.chime('done' | 'ask' | 'pomo')`: ses.
- `Ada.esc(metin)`: HTML'e güvenle yazmak için kaçış. Dışarıdan gelen her metni bununla yaz.
- `Ada.S`: adanın durumu (`S.config`, `S.claude`, `S.music`, `S.mods.*`).
- `data-region="ad"` verdiğin bir öğe, sadece içeriği değiştiğinde yerinde güncellenir. Kaydırma konumu ve yazı kutuları korunur.

### Veri ve internet

Adanın sayfası doğrudan internete çıkamaz; isteği Ada yapar:

```js
const r = await ada.call('plugins', 'fetch', { url: 'https://api.ornek.com/veri' });
if (r.ok) console.log(r.result.status, r.result.text);   // en fazla 1 MB, sadece https
```

Küçük bir JSON saklamak için (en fazla 256 KB):

```js
await ada.call('plugins', 'save', { id: 'benim-eklentim', data: { ayar: 1 } });
const r = await ada.call('plugins', 'load', 'benim-eklentim');   // r.result
```

### Stil

Ada'nın hazır sınıflarını kullanabilirsin: `tile`, `chip`, `btn-allow`, `btn-text`, `segs` / `seg`, `hint-l`, `today`. Renkler CSS değişkenleriyle gelir: `--deniz`, `--yosun`, `--fener`, `--lila`, `--mercan`, `--foam`, `--mist`.

Satır içi `style="..."` çalışmaz; sayfanın güvenlik ayarı buna izin vermez. Stilleri `style.css`'e yaz ya da JavaScript'ten `el.style.x = ...` ile ver.

## Güvenlik

Açtığın bir eklenti adanın içinde çalışır ve Ada'nın yapabildiği her şeyi yapabilir: Claude izinlerini görebilir, müziği yönetebilir, internete istek gönderebilir. Sadece kodunu okuduğun ya da güvendiğin eklentileri aç. Eklenti dosyaları yalnızca kendi klasörlerinden okunur; başka bir klasördeki dosyaya erişemezler.
