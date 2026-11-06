# Değişiklik günlüğü

Ada'daki önemli değişiklikler bu dosyada tutulur. Biçim [Keep a Changelog](https://keepachangelog.com/tr-TR/1.1.0/)'a, sürüm numaraları [Semantic Versioning](https://semver.org/lang/tr/)'e dayanır.

Her sürüm etiketinde GitHub Actions bu dosyadaki ilgili bölümü sürüm notlarına kopyalar. Yeni bir sürüm çıkarmadan önce değişiklikleri `## [Yayınlanmamış]` altına yaz, sonra başlığı sürüm numarasıyla değiştir.

## [Yayınlanmamış]

### Eklendi
- Birim testleri (`npm test`) ve her gönderide çalışan GitHub Actions kontrolü.
- Hata, öneri ve PR şablonları; `CONTRIBUTING.md`.
- İngilizce README (`README.en.md`).

### Değişti
- Sürüm notları artık bu dosyadan otomatik dolduruluyor.
- `docs/` görselleri kayıpsız sıkıştırıldı.

## [0.6.0] - 2026-11-06

### Eklendi
- **Her uygulamanın müziği:** YouTube, VLC, Medya Oynatıcı gibi Windows medya kontrolüne düşen her kaynak adada görünür ve yönetilir; birden fazla kaynak varsa **Kaynaklar**'dan seçilir.
- **Ses dalgası:** çubuklar bilgisayardan çıkan gerçek sese göre oynar; ada albüm kapağının rengini alır.
- **Dosya rafı:** dosyaları adaya bırak, sonra istediğin yere sürükle.
- **Direnç renk kodu** (4/5 bant, en yakın E24) ve **çevirici** (dBm, AWG, Hz, kondansatör kodu, mil, °C, E12/E24/E96).
- **Seri port grafiği:** dondurma, 120/300/600 ölçüm penceresi, değer okuma, seri gizleme, CSV'ye kaydetme.
- **Kamera / mikrofon noktası** ve **cihaz kartları** (Bluetooth kulaklık, şarj, düşük pil).
- **Adadan Claude'a yanıt:** iş bitince Devam et / Test et / Açıkla / Commit at düğmeleri ve yazı kutusu; çoklu oturum görünümü.
- **Google Takvim** (iCal) etkinlikleri ders listesinde; Meet / Zoom / Teams için **Katıl**.
- **Temalar:** siyah ada, 7 vurgu rengi ya da Windows rengi, Kompakt / Normal / Büyük boyut.

## [0.5.1] - 2026-11-04

### Eklendi
- Odak sekmesine kronometre: tur, duraklat, sıfırla, `Ctrl+Alt+K`.

## [0.5.0] - 2026-11-04

### Eklendi
- Morph animasyonu, buzlu cam görünümü, deniz feneri bekleme hali.
- Fare tekerleği ve yana kaydırma ile ses / şarkı kontrolü.
- Sürümlerde sabit adlı `Ada-Setup.exe`; README'deki indirme düğmesi hep son kurulumu indirir.

### Değişti
- Claude Desktop izleyicisi daha hafif.
- Güncelleme kontrolü `suleymannsahan/SESIsland` deposuna bakıyor.

## [0.4.2] - 2026-11-04

### Eklendi
- Tanı raporu (tepsi menüsü → Sorun giderme → masaüstüne `ada-tani.txt`).

### Düzeltildi
- Tam ekran algılama; Windows'ta tıklama odağı.

## [0.4.1] - 2026-11-04

### Düzeltildi
- Tıklama algılama: tıklanabilir alan artık ana süreçte imleç konumuyla belirleniyor, düğmeler basıldığı anda çalışıyor.

## [0.4.0] - 2026-11-04

### Eklendi
- Bilgisayarın genel ses kontrolü, çalan şarkıyı playliste ekleme, Spotify'da arama.
- Spotify kapalıysa açıp çalma.

### Düzeltildi
- PowerShell betikleri UTF-8 BOM ile kaydediliyor (Türkçe karakterler).
- Soruları adadan yanıtlama 60 sn sonra terminale düşüyor; Pomodoro halkası düzeltmesi.

## [0.3.0] - 2026-11-04

### Eklendi
- İlk açık sürüm: Claude, Spotify, Pomodoro, ders, araçlar, seri port ve sistem sekmeleri.

[Yayınlanmamış]: https://github.com/suleymannsahan/SESIsland/compare/v0.6.0...HEAD
[0.6.0]: https://github.com/suleymannsahan/SESIsland/compare/v0.5.0...v0.6.0
[0.5.1]: https://github.com/suleymannsahan/SESIsland/compare/v0.5.0...v0.5.1
[0.5.0]: https://github.com/suleymannsahan/SESIsland/releases/tag/v0.5.0
[0.4.2]: https://github.com/suleymannsahan/SESIsland/commit/f23af0a
[0.4.1]: https://github.com/suleymannsahan/SESIsland/commit/bd4ee31
[0.4.0]: https://github.com/suleymannsahan/SESIsland/commit/5e6ab19
[0.3.0]: https://github.com/suleymannsahan/SESIsland/commit/bd4d0d2
