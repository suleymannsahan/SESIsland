<div align="center">

**Türkçe** · [English](README.en.md)

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
<a href="https://github.com/suleymannsahan/SESIsland/releases"><img src="https://img.shields.io/github/downloads/suleymannsahan/SESIsland/total?style=flat-square&label=indirme&color=1a2533" alt="Toplam indirme"></a>
<a href="https://github.com/suleymannsahan/SESIsland/actions/workflows/ci.yml"><img src="https://img.shields.io/github/actions/workflow/status/suleymannsahan/SESIsland/ci.yml?style=flat-square&label=test" alt="Test durumu"></a>
<a href="LICENSE"><img src="https://img.shields.io/badge/lisans-MIT-1a2533?style=flat-square" alt="MIT lisansı"></a>

<br><br>

<img src="docs/ada.gif" width="820" alt="Ada: müzik hapı panele dönüşüyor">

</div>

<br>

> **SESIsland mı, Ada mı?** İkisi aynı şey. Uygulamanın adı **Ada**, deponun adı **SESIsland**. Kurulum dosyası, menüler ve ayarlar hep "Ada" der.

<details>
<summary><b>İçindekiler</b></summary>

- [Ada nedir?](#ada-nedir)
- [Neler yapıyor?](#neler-yapıyor)
- [Gereksinimler](#gereksinimler)
- [Kurulum](#kurulum)
- Sekmeler: [Claude](#-claude) · [Müzik](#-müzik) · [Odak](#️-odak) · [Ders](#-ders) · [Araçlar](#-araçlar) · [Seri port](#-seri-port) · [Sistem](#-sistem) · [Raf](#️-raf) · [Küçük dokunuşlar](#-küçük-dokunuşlar)
- [Kısayollar](#kısayollar)
- [Sorun giderme](#sorun-giderme)
- [Gizlilik](#gizlilik)
- [Geliştirme](#geliştirme)
- [Teşekkürler](#teşekkürler)

</details>

## Ada nedir?

Ada, ekranının üst ortasında duran ince bir şerittir. Bir şey olmadığında küçük bir deniz feneri olarak bekler. Claude çalışırken ne yaptığını, müzik çalarken şarkıyı, Pomodoro'dayken kalan süreyi gösterir. Üzerine gelince yana doğru açılır; uzaklaşınca yine küçülür.

<p align="center"><img src="docs/pills.png" width="900" alt="Ada'nın toplanmış halleri: bekleme, Claude çalışıyor, müzik, Pomodoro, ders hatırlatması"></p>

## Neler yapıyor?

| | Sekme | Bir satırda |
|---|---|---|
| 🤖 | [Claude](#-claude) | Claude Code / Desktop'ı takip et, izinleri onayla, soruları yanıtla, iş bitince adadan devam ettir |
| 🎵 | [Müzik](#-müzik) | Spotify ve Windows'ta çalan her şey: kontrol, arama, playliste ekleme, senkronize sözler, canlı ses çubukları |
| ⏱️ | [Odak](#️-odak) | Pomodoro, kronometre, odakta bildirimleri susturma, günlük ve haftalık özet |
| 📚 | [Ders](#-ders) | Ders programı, sınav geri sayımı, Google Takvim etkinlikleri ve tek tıkla toplantıya katılma |
| 🧮 | [Araçlar](#-araçlar) | Mühendislik hesap makinesi, direnç renk kodu, birim çevirici, not, pano geçmişi |
| 🔌 | [Seri port](#-seri-port) | ESP32 / Arduino çıktısı, PASS/FAIL renkleri, canlı grafik, CSV |
| 📊 | [Sistem](#-sistem) | İşlemci, bellek, NVIDIA GPU, pil |
| 🗂️ | [Raf](#️-raf) | Dosyaları adaya bırak, sonra istediğin yere sürükle |

## Gereksinimler

| | |
|---|---|
| **İşletim sistemi** | Windows 10 ya da 11, 64 bit |
| **Claude** | [Claude Code](https://docs.claude.com/en/docs/claude-code/overview) (terminal) ve/veya Claude Desktop. Claude sekmesi ikisinden birini ister; diğer sekmeler Claude olmadan da çalışır |
| **Spotify** *(isteğe bağlı)* | Adadan kontrol için Spotify'ın kuralları gereği **Premium** hesap ve bir kerelik ücretsiz Client ID (Ayarlar'da 5 adım). Premium yoksa Spotify uygulaması yine **Her uygulamanın müziği** üzerinden adada görünür |
| **Ekran kartı bilgisi** *(isteğe bağlı)* | NVIDIA kart ve sürücüsü (`nvidia-smi`) |

Ada'nın kendi sunucusu ya da hesabı yoktur; ek bir program ya da sürücü kurmanız gerekmez.

<br>

## Kurulum

1. Yukarıdaki **Windows için indir** düğmesine bas ve `Ada-Setup.exe`'yi çalıştır.
2. Kurulum dosyası imzalı olmadığı için Windows SmartScreen uyarı verebilir: **Ek bilgi → Yine de çalıştır**.
3. İlk açılışta Ada, Claude Code hook'larını `~/.claude/settings.json`'a ekler (eski dosya tarihli bir yedekle saklanır). Claude Code'da yeni bir oturum başlat.
4. **Spotify** için Ada'nın Ayarlar penceresindeki 5 adımı izle (bir kere, yaklaşık 2 dakika). Spotify'ın kuralları gereği hesap sahibinin Premium olması gerekir.

Yeni sürümler çıktığında Ada adada haber verir.

## 🤖 Claude

Claude Code ve Claude Desktop'ı adadan takip et. İzin isteklerini terminale ya da pencereye geçmeden onayla, seçenekli soruları tek tıkla yanıtla, iş bitince sesli haber al. Kullanım limitin de üstte görünür.

<p align="center">
  <img src="docs/perm.png" width="49%" alt="İzin kartı">
  <img src="docs/ask.png" width="40%" alt="Soru kartı">
</p>
<p align="center"><img src="docs/claude.png" width="820" alt="Claude oturumları ve kullanım limiti"></p>

**Adadan yanıt ver:** Claude Code bir işi bitirince kartta **Devam et**, **Test et**, **Açıkla**, **Commit at** düğmeleri ve bir yazı kutusu çıkar; yazdığın şey Claude'a iletilir, terminale dönmeden çalışmaya devam eder. Aynı anda birkaç oturum çalışıyorsa toplanmış ada hepsini yan yana gösterir; oturum listesinde her birinin son mesajı okunur.

<p align="center"><img src="docs/reply.png" width="480" alt="İş bitince adadan hızlı yanıt"></p>

## 🎵 Müzik

Spotify'ı adadan yönet: kapak, ilerleme, oynat/duraklat, karıştır, tekrar, beğen, **çalan şarkıyı playliste ekle**, **ara ve çal**, cihaz değiştir. Şarkıyla birlikte kayan senkronize sözler ve isteğe bağlı Türkçe çeviri. Spotify kapalıysa Ada açar, sonra çalar. Ses sürgüsü bilgisayarın genel sesidir.

<p align="center"><img src="docs/music.png" width="820" alt="Müzik paneli ve senkronize sözler"></p>
<p align="center"><img src="docs/music-search.png" width="820" alt="Spotify'da arama"></p>

**Her uygulamanın müziği:** YouTube (tarayıcıda), VLC, Medya Oynatıcı ya da API'siz Spotify uygulaması… Windows'un medya kontrolüne düşen her şey adada görünür ve oradan yönetilir; sözler de gelir. Birden fazla kaynak varsa **Kaynaklar**'dan seçersin. Çubuklar bilgisayardan çıkan gerçek sese göre oynar, ada albüm kapağının rengini alır.

<p align="center"><img src="docs/music-media.png" width="820" alt="YouTube'da çalan şarkı, canlı ses çubukları ve albüm rengi"></p>

## ⏱️ Odak

Pomodoro halkası, hazır süreler (25/5, 50/10, 15/3), odak başlayınca müzik, molada duraklatma, odak sırasında bildirimleri susturma. Bugünün ve son 7 günün özeti.

<p align="center"><img src="docs/focus.png" width="820" alt="Pomodoro ve günlük özet"></p>

**Kronometre:** Odak sekmesinde Pomodoro yerine Kronometre'ye geçersen süre sıfırdan saymaya başlar. Tur alabilir, duraklatıp sıfırlayabilirsin; geçen süre bugünkü odak süresine eklenir. Ada gizliyken de saymaya devam eder.

<p align="center"><img src="docs/stopwatch.png" width="820" alt="Kronometre ve turlar"></p>

## 📚 Ders

Bugünkü dersler (şimdi / sıradaki), sınavlara kalan gün ve dersten birkaç dakika önce hatırlatma. **Google Takvim**'ini (iCal adresiyle) bağlarsan etkinlikler derslerle aynı listede görünür, başlamadan önce ada haber verir; Meet / Zoom / Teams linki varsa **Katıl**'a basman yeter.

<p align="center"><img src="docs/ders.png" width="820" alt="Ders programı ve sınavlar"></p>

## 🧮 Araçlar

Mühendislik hesap makinesi (`4.7k*2`, `1k||2.2k`, `12V/220`, `1/(2pi*50Hz*100nF)`), hızlı not ve pano geçmişi. Pano geçmişi diske yazılmaz.

- **Direnç renk kodu:** bantlara tıklayıp renk seç ya da değeri yaz (`4k7`, `220`, `1M`); 4 ve 5 bant, en yakın E24 değeri.
- **Çevir:** `20dBm` → 100 mW, `22AWG` → çap/kesit/direnç, `1kHz` → periyot, `100nF` → kondansatör kodu (104), `10mil` → mm, `25C` → °F, ve E12/E24/E96 en yakın değerler.

<p align="center"><img src="docs/tools.png" width="820" alt="Hesap makinesi, not ve pano"></p>
<p align="center"><img src="docs/resistor.png" width="820" alt="Direnç renk kodu"></p>

## 🔌 Seri port

ESP32 / Arduino çıktısını adada oku. `PASS` geçen satırlar yeşil, `FAIL` geçenler kırmızı; satırlardaki sayılar (`temp:41.2`) canlı grafiğe dönüşür. Grafiği dondurabilir, son 120/300/600 ölçümü seçebilir, fareyle üstünde gezip değer okuyabilir, serileri gizleyebilir ve **CSV** olarak masaüstüne kaydedebilirsin. Sürücü ya da ek modül gerekmez.

<p align="center"><img src="docs/serial.png" width="820" alt="Seri port grafiği"></p>

## 📊 Sistem

İşlemci, bellek, NVIDIA ekran kartı sıcaklığı ve yükü, pil, açık kalma süresi.

<p align="center"><img src="docs/system.png" width="820" alt="Sistem durumu"></p>

## 🗂️ Raf

Dosyaları adanın üstüne sürükleyip bırak; Ada onları rafta tutar. Sonra buradan istediğin klasöre, tarayıcıdaki yükleme kutusuna ya da bir mesaja sürüklersin. Çift tıkla aç, tek tek ya da hepsini birden sürükle. Dosyalar kopyalanmaz, Ada sadece yerlerini hatırlar.

<p align="center"><img src="docs/shelf.png" width="820" alt="Dosya rafı"></p>

## ✨ Küçük dokunuşlar

- **Kamera / mikrofon noktası:** bir uygulama kamerayı kullanırken yeşil, mikrofonu kullanırken turuncu nokta yanar (üstüne gelince hangi uygulama olduğu yazar).
- **Cihazlar:** Bluetooth kulaklık bağlanınca (Windows biliyorsa pil yüzdesiyle), şarj takılınca/çıkınca ve pil %20, %10, %5'e düşünce kısa bir kart.
- **Olay animasyonları:** iş bitince ışık halkası ve parlama, Pomodoro bitince konfeti, izin beklerken amber nabız.
- **Tema:** gece mavisi ya da tamamen siyah ada, 7 vurgu rengi ya da Windows'un kendi rengi, Kompakt / Normal / Büyük boyut.
- **Fener:** gece yıldızlar ve ay, sabah güneş doğar, sınavdan önceki gün terler, uyurken "z" çıkarır.

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

## Sorun giderme

<details>
<summary><b>Claude izin isteyince adada kart çıkmıyor</b></summary>

1. Ada'yı açtıktan sonra Claude Code'da **yeni bir oturum** başlat; açık oturumlar eski ayarları kullanır.
2. Tepsi simgesine sağ tıkla: **Claude Code hook'larını kur** yazıyorsa bas (yazı *kaldır* ise kuruludur).
3. Ada'nın iki kopyası açık olmasın. "Port 47821 kullanımda" uyarısı görürsen tepsideki diğer Ada'yı kapat.
4. Tepsi → **Sorun giderme → Test bildirimi** ile adanın tepki verip vermediğine bak.
5. Claude Desktop için tepsideki **Claude Desktop sohbetini izle (deneysel)** açık olmalı.

</details>

<details>
<summary><b>Spotify bağlanmıyor</b></summary>

- Spotify geliştirici panelindeki **Redirect URI**, Ayarlar'da gösterilenle birebir aynı olmalı (`http://127.0.0.1:47822/callback`). `localhost` yazılırsa çalışmaz.
- Uygulamayı oluştururken **Web API** işaretlenmiş olmalı.
- "Bu kontrol için Spotify Premium gerekiyor" uyarısı Spotify'dan gelir: oynat/duraklat, atlama gibi kontroller Premium ister. Premium olmadan da şarkı **Her uygulamanın müziği** ile adada görünür.
- Çalan bir şey yoksa Spotify'da bir şarkı başlat; ada aktif cihazı öyle bulur.
- Ayarlar'da **Yeniden bağlan** tarayıcıda izni tazeler.

</details>

<details>
<summary><b>Windows SmartScreen "Windows bilgisayarınızı korudu" diyor</b></summary>

Kurulum dosyası henüz kod imzalı değil. **Ek bilgi → Yine de çalıştır**'a bas. Dosyanın bu depodan geldiğini Releases sayfasındaki adla karşılaştırarak doğrulayabilirsin.

</details>

<details>
<summary><b>Ada tam ekran oyunda / videoda kayboluyor</b></summary>

Bu bilerek böyle: tam ekran bir uygulama varken ada kenara çekilir, Claude izin beklerse yine görünür. Ayarlar'daki **Tam ekran uygulamalarda gizlen** ile kapatılabilir.

</details>

<details>
<summary><b>Tanı raporu: sorun bildirirken ne eklemeliyim?</b></summary>

Tepsi simgesine sağ tık → **Sorun giderme → Tanı raporu oluştur**. Masaüstüne `ada-tani.txt` yazılır; içinde sürüm, pencere durumu ve son olaylar vardır (şifre ya da Spotify anahtarı yoktur). Bu dosyayı [hata bildirimine](https://github.com/suleymannsahan/SESIsland/issues/new?template=hata.yml) ekle.

Claude Desktop'la ilgili sorunlarda aynı menüdeki **Desktop tanılama dosyası oluştur** (`ada-tanilama.txt`) de işe yarar.

</details>

## Gizlilik

- Ada'nın sunucusu yok, hesap istemez, kullanım verisi göndermez.
- Claude hook'ları yalnızca bilgisayarının içinde (`127.0.0.1`) konuşur.
- Spotify giriş anahtarı Windows'un şifreli deposunda saklanır; şifren Ada'ya hiç gelmez.
- Kullanım limiti, Claude Code'un bu bilgisayara kaydettiği girişle yalnızca `api.anthropic.com`'a sorulur.
- Pano geçmişi diske yazılmaz.
- Ses çubukları için bilgisayarın sesi yalnızca anlık olarak dinlenir; hiçbir şey kaydedilmez ya da gönderilmez.
- Takvim, verdiğin iCal adresinden doğrudan okunur; etkinlikler sadece bellekte tutulur.
- Ağa çıkan diğer istekler: şarkı sözleri için `lrclib.net`, çeviri açıksa `mymemory.translated.net`, güncelleme kontrolü için `api.github.com`.

## Geliştirme

```bash
npm install
npm start          # geliştirme modunda çalıştır
npm test           # birim testleri (Linux / macOS'ta da çalışır)
npm run dist       # Windows kurulum dosyası + zip (Linux'ta Wine gerekir)
```

Her gönderide GitHub Actions testleri çalıştırır. Bir sürüm etiketi (`git tag v0.6.0 && git push origin v0.6.0`) kurulum dosyasını derler, Releases'e ekler ve sürüm notlarını [`CHANGELOG.md`](CHANGELOG.md)'den doldurur. Katkı için: [`CONTRIBUTING.md`](CONTRIBUTING.md).

<details>
<summary>Proje yapısı</summary>

```
src/main.js              ana süreç: pencere, tepsi, kısayollar, modüller
src/preload.js           arayüz ile ana süreç arasındaki köprü
src/server.js            Claude Code hook sunucusu (127.0.0.1:47821)
src/hooks.js             ~/.claude/settings.json kurulumu
src/describe.js          araç çağrılarını kısa Türkçe etiketlere çevirir
src/desktop-watcher.js   Claude Desktop izleyici (UI Automation)
src/usage.js             Claude kullanım limiti (5 saatlik / haftalık)
src/spotify.js           Spotify Web API (PKCE)
src/media.js             Windows medya oturumları (YouTube, VLC, Medya Oynatıcı…)
src/lyrics.js            LRCLIB sözleri + çeviri
src/volume.js            Windows ana ses
src/pomodoro.js          Pomodoro      src/stopwatch.js  kronometre
src/stats.js             günlük özet   src/store.js      küçük JSON deposu
src/calendar.js          Google Takvim (iCal) ve tekrarlayan etkinlikler
src/clip.js              pano geçmişi (yalnızca bellekte)
src/shelf.js             dosya rafı
src/serial.js            seri port izleyici
src/system.js            işlemci, bellek, NVIDIA GPU
src/winctl.js            tam ekran algılama, pencereyi öne getirme
src/updater.js           GitHub Releases'ten sürüm kontrolü
src/renderer/            ada arayüzü: core.js + tab-*.js, viz.js (ses çubukları),
                         devices.js (cihaz kartları), calc.js, electronics.js, ayarlar
scripts/*.ps1            Windows yardımcıları: UI Automation, medya, ses, seri port,
                         kamera/mikrofon (privacy), Bluetooth pil, pencere
test/                    birim testleri (node --test)
```
</details>

## Teşekkürler

- [twocode.nl](https://twocode.nl) — ilham için.
- [LRCLIB](https://lrclib.net) — ücretsiz, topluluk tarafından tutulan senkronize şarkı sözleri.
- [MyMemory](https://mymemory.translated.net) — söz çevirisi.
- [Electron](https://www.electronjs.org) ve [electron-builder](https://www.electron.build).

<br>

<div align="center">

MIT · Süleyman Emre Şahan

<sub>Ekran görüntülerindeki şarkılar, projeler ve dersler örnektir.</sub>

</div>
