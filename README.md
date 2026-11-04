<div align="center">

<img src="docs/logo.png" width="96" alt="Ada simgesi">

# Ada

**Windows için ekranın üstünde yaşayan küçük bir ada.**<br>
Claude'u takip et, müziğini yönet, odaklan — yaptığın işi bırakmadan.

<br>

<a href="https://github.com/suleymannsahan/SESIsland/releases/latest/download/Ada-Setup.exe">
  <img src="https://img.shields.io/badge/Windows%20i%C3%A7in%20indir-Ada%20Setup-5cc8c4?style=for-the-badge&logo=windows11&logoColor=white&labelColor=1a2533" height="44" alt="Windows için indir">
</a>

<br><br>

<a href="https://github.com/suleymannsahan/SESIsland/releases/latest"><img src="https://img.shields.io/github/v/release/suleymannsahan/SESIsland?style=flat-square&label=s%C3%BCr%C3%BCm&color=1a2533" alt="Son sürüm"></a>
<img src="https://img.shields.io/badge/Windows-10%20%2F%2011-1a2533?style=flat-square" alt="Windows 10 / 11">
<a href="LICENSE"><img src="https://img.shields.io/badge/lisans-MIT-1a2533?style=flat-square" alt="MIT lisansı"></a>

<br><br>

<img src="docs/ada.gif" width="820" alt="Ada: müzik hapı panele dönüşüyor">

</div>

<br>

## Ada nedir?

Ada, ekranının üst ortasında duran ince bir şerittir. Bir şey olmadığında küçük bir deniz feneri olarak bekler. Claude çalışırken ne yaptığını, müzik çalarken şarkıyı, Pomodoro'dayken kalan süreyi gösterir. Üzerine gelince yana doğru açılır; uzaklaşınca yine küçülür.

<p align="center"><img src="docs/pills.png" width="900" alt="Ada'nın toplanmış halleri: bekleme, Claude çalışıyor, müzik, Pomodoro, ders hatırlatması"></p>

<br>

## 🤖 Claude

Claude Code ve Claude Desktop'ı adadan takip et. İzin isteklerini terminale ya da pencereye geçmeden onayla, seçenekli soruları tek tıkla yanıtla, iş bitince sesli haber al. Kullanım limitin de üstte görünür.

<p align="center">
  <img src="docs/perm.png" width="49%" alt="İzin kartı">
  <img src="docs/ask.png" width="40%" alt="Soru kartı">
</p>
<p align="center"><img src="docs/claude.png" width="820" alt="Claude oturumları ve kullanım limiti"></p>

## 🎵 Müzik

Spotify'ı adadan yönet: kapak, ilerleme, oynat/duraklat, karıştır, tekrar, beğen, **çalan şarkıyı playliste ekle**, **ara ve çal**, cihaz değiştir. Şarkıyla birlikte kayan senkronize sözler ve isteğe bağlı Türkçe çeviri. Spotify kapalıysa Ada açar, sonra çalar. Ses sürgüsü bilgisayarın genel sesidir.

<p align="center"><img src="docs/music.png" width="820" alt="Müzik paneli ve senkronize sözler"></p>
<p align="center"><img src="docs/music-search.png" width="820" alt="Spotify'da arama"></p>

## ⏱️ Odak

Pomodoro halkası, hazır süreler (25/5, 50/10, 15/3), odak başlayınca müzik, molada duraklatma, odak sırasında bildirimleri susturma. Bugünün ve son 7 günün özeti.

<p align="center"><img src="docs/focus.png" width="820" alt="Pomodoro ve günlük özet"></p>

**Kronometre:** Odak sekmesinde Pomodoro yerine Kronometre'ye geçersen süre sıfırdan saymaya başlar. Tur alabilir, duraklatıp sıfırlayabilirsin; geçen süre bugünkü odak süresine eklenir. Ada gizliyken de saymaya devam eder.

<p align="center"><img src="docs/stopwatch.png" width="820" alt="Kronometre ve turlar"></p>

## 📚 Ders

Bugünkü dersler (şimdi / sıradaki), sınavlara kalan gün ve dersten birkaç dakika önce hatırlatma.

<p align="center"><img src="docs/ders.png" width="820" alt="Ders programı ve sınavlar"></p>

## 🧮 Araçlar

Mühendislik hesap makinesi (`4.7k*2`, `1k||2.2k`, `12V/220`, `1/(2pi*50Hz*100nF)`), hızlı not ve pano geçmişi. Pano geçmişi diske yazılmaz.

<p align="center"><img src="docs/tools.png" width="820" alt="Hesap makinesi, not ve pano"></p>

## 🔌 Seri port

ESP32 / Arduino çıktısını adada oku. `PASS` geçen satırlar yeşil, `FAIL` geçenler kırmızı; satırlardaki sayılar (`temp:41.2`) canlı grafiğe dönüşür. Sürücü ya da ek modül gerekmez.

<p align="center"><img src="docs/serial.png" width="820" alt="Seri port grafiği"></p>

## 📊 Sistem

İşlemci, bellek, NVIDIA ekran kartı sıcaklığı ve yükü, pil, açık kalma süresi.

<p align="center"><img src="docs/system.png" width="820" alt="Sistem durumu"></p>

<br>

## Kısayollar

| Kısayol | |
|---|---|
| `Ctrl` `Alt` `Boşluk` | Oynat / duraklat |
| `Ctrl` `Alt` `→` / `←` | Sonraki / önceki şarkı |
| `Ctrl` `Alt` `↑` / `↓` | Bilgisayar sesi ±5 |
| `Ctrl` `Alt` `M` | Sesi kapat / aç |
| `Ctrl` `Alt` `Y` / `N` | Claude: izin ver / reddet |
| `Ctrl` `Alt` `P` | Pomodoro başlat / duraklat |
| `Ctrl` `Alt` `K` | Kronometre başlat / duraklat |
| `Ctrl` `Alt` `A` | Adayı aç |

Fare adanın üstündeyken: **tekerlek** sesi değiştirir, **yana kaydırma** (ya da `Shift` + tekerlek) şarkı değiştirir.

## Kurulum

1. Yukarıdaki **Windows için indir** düğmesine bas ve `Ada-Setup.exe`'yi çalıştır.
2. Kurulum dosyası imzalı olmadığı için Windows SmartScreen uyarı verebilir: **Ek bilgi → Yine de çalıştır**.
3. İlk açılışta Ada, Claude Code hook'larını `~/.claude/settings.json`'a ekler (eski dosya tarihli bir yedekle saklanır). Claude Code'da yeni bir oturum başlat.
4. **Spotify** için Ada'nın Ayarlar penceresindeki 5 adımı izle (bir kere, yaklaşık 2 dakika). Spotify'ın kuralları gereği hesap sahibinin Premium olması gerekir.

Yeni sürümler çıktığında Ada adada haber verir.

## Gizlilik

- Ada'nın sunucusu yok, hesap istemez, kullanım verisi göndermez.
- Claude hook'ları yalnızca bilgisayarının içinde (`127.0.0.1`) konuşur.
- Spotify giriş anahtarı Windows'un şifreli deposunda saklanır; şifren Ada'ya hiç gelmez.
- Kullanım limiti, Claude Code'un bu bilgisayara kaydettiği girişle yalnızca `api.anthropic.com`'a sorulur.
- Pano geçmişi diske yazılmaz.
- Ağa çıkan diğer istekler: şarkı sözleri için `lrclib.net`, çeviri açıksa `mymemory.translated.net`, güncelleme kontrolü için `api.github.com`.

## Geliştirme

```bash
npm install
npm start          # geliştirme modunda çalıştır
npm run dist       # Windows kurulum dosyası + zip (Linux'ta Wine gerekir)
```

Bir sürüm etiketi (`git tag v0.5.0 && git push origin v0.5.0`) GitHub Actions'ta kurulum dosyasını derler ve Releases'e ekler.

<details>
<summary>Proje yapısı</summary>

```
src/main.js            ana süreç: pencere, tray, kısayollar, modüller
src/server.js          Claude Code hook sunucusu (127.0.0.1:47821)
src/hooks.js           ~/.claude/settings.json kurulumu
src/desktop-watcher.js Claude Desktop izleyici (UI Automation)
src/spotify.js         Spotify Web API (PKCE)
src/lyrics.js          LRCLIB sözleri + çeviri
src/volume.js          Windows ana ses
src/pomodoro.js …      pomodoro, istatistik, sistem, pano, seri port, kullanım, güncelleme
src/renderer/          ada arayüzü (core.js + tab-*.js) ve ayarlar penceresi
scripts/*.ps1          Windows yardımcıları (UI Automation, seri port, ses, pencere)
```
</details>

<br>

<div align="center">

MIT · Süleyman Emre Şahan

<sub>Ekran görüntülerindeki şarkılar, projeler ve dersler örnektir.</sub>

</div>
