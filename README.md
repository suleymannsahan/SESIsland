# Ada

Windows için ekranın üstünde yaşayan küçük bir ada. Claude Code ve Claude Desktop'u takip eder, izinleri oradan verirsin; Spotify'ı, Pomodoro'yu, ders programını, seri portu ve sistem durumunu da aynı yerden yönetirsin.

*A small Dynamic Island–style strip for Windows: follow Claude Code and Claude Desktop, approve their requests, control Spotify, run pomodoros, see your class schedule, watch a serial port and your PC's health — without leaving what you are doing.*

## Neler yapar

| Sekme | |
|---|---|
| **Claude** | Claude Code / Claude Desktop oturumları canlı. İzin kartları (İzin ver · Reddet), seçenekli soruları adadan yanıtlama, iş bitince ses ve bildirim, 5 saatlik ve haftalık kullanım limiti, oturuma tıklayınca pencereye geçiş. |
| **Müzik** | Spotify: kapak, ilerleme, oynat/duraklat, önceki/sonraki, karıştır, tekrar, beğen, ses, playlistler, cihazlar. Senkronize sözler (LRCLIB) ve isteğe bağlı Türkçe çeviri. Ada albüm kapağının rengini alır. |
| **Odak** | Pomodoro halkası, hazır süreler (25/5, 50/10, 15/3), odakta müzik çal / molada durdur, odakta bildirimleri sustur, bugünün ve son 7 günün özeti. |
| **Ders** | Bugünkü dersler (şimdi / sıradaki), sınavlara kalan gün, dersten önce hatırlatma. |
| **Araçlar** | Mühendislik hesap makinesi (`4.7k`, `100nF`, `1k\|\|2.2k`, `12V/220`, `db()`), hızlı not, pano geçmişi (sadece bellekte). |
| **Seri port** | COM port + baud seçimi, PASS yeşil / FAIL kırmızı satırlar, sayıları canlı grafik, veri gönderme. Sürücü ya da ek modül gerektirmez. |
| **Sistem** | İşlemci (grafikli), bellek, NVIDIA ekran kartı sıcaklığı ve yükü, pil, açık kalma süresi. |

Ayrıca: genel kısayollar, tam ekran uygulamalarda gizlenme, sol / orta / sağ ve ikinci monitör, boyut ayarı, boşta küçülme, günün özeti kartı, yeni sürüm bildirimi.

## Kısayollar

| | |
|---|---|
| `Ctrl+Alt+Boşluk` | Müzik: oynat / duraklat |
| `Ctrl+Alt+→` / `←` | Sonraki / önceki şarkı |
| `Ctrl+Alt+↑` / `↓` | Ses ±10 |
| `Ctrl+Alt+Y` / `N` | Claude: izin ver / reddet |
| `Ctrl+Alt+P` | Pomodoro başlat / duraklat |
| `Ctrl+Alt+A` | Adayı aç |

## Kurulum

[Releases](../../releases) sayfasından `Ada-Setup-x.y.z.exe`'yi indir ve çalıştır. Kurulum dosyası imzalı olmadığı için Windows SmartScreen uyarı verebilir: **Ek bilgi → Yine de çalıştır**.

İlk açılışta Ada, Claude Code hook'larını `~/.claude/settings.json`'a ekler (eski dosya tarihli bir yedekle saklanır). Ardından Claude Code'da yeni bir oturum başlat.

**Spotify** için bir kere ücretsiz bir Client ID alman gerekir; Ada'nın Ayarlar penceresi adım adım gösterir. Spotify'ın kuralları gereği uygulama sahibinin Premium olması gerekir.

## Gizlilik

- Ada'nın sunucusu yok, hesap istemez, kullanım verisi göndermez.
- Claude hook'ları sadece bilgisayarının içinde (`127.0.0.1`) konuşur.
- Spotify giriş anahtarı Windows'un şifreli deposunda (DPAPI) saklanır; şifren Ada'ya gelmez.
- Kullanım limiti, Claude Code'un bu bilgisayara kaydettiği girişle yalnızca `api.anthropic.com`'a sorulur.
- Pano geçmişi diske yazılmaz.
- Ağa çıkan diğer istekler: şarkı sözleri için `lrclib.net`, çeviri açıksa `mymemory.translated.net`, güncelleme kontrolü açıksa `api.github.com`.

## Geliştirme

```bash
npm install
npm start          # geliştirme
npm run dist       # Windows kurulum dosyası + zip (Linux'ta Wine gerekir)
```

Proje yapısı:

```
src/main.js            ana süreç: pencere, tray, kısayollar, modüller
src/server.js          Claude Code hook sunucusu (127.0.0.1:47821)
src/hooks.js           ~/.claude/settings.json kurulumu
src/desktop-watcher.js Claude Desktop izleyici (UI Automation)
src/spotify.js         Spotify Web API (PKCE)
src/lyrics.js          LRCLIB sözleri + çeviri
src/pomodoro.js ...    pomodoro, istatistik, sistem, pano, seri port, kullanım, güncelleme
src/renderer/          ada arayüzü (core.js + tab-*.js) ve ayarlar penceresi
scripts/*.ps1          Windows yardımcıları (UI Automation, seri port, pencere)
```

## Lisans

MIT · Süleyman Emre Şahan
