# Değişiklik günlüğü

Ada'daki önemli değişiklikler bu dosyada tutulur. Biçim [Keep a Changelog](https://keepachangelog.com/tr-TR/1.1.0/)'a, sürüm numaraları [Semantic Versioning](https://semver.org/lang/tr/)'e dayanır.

Her sürüm etiketinde GitHub Actions bu dosyadaki ilgili bölümü sürüm notlarına kopyalar. Yeni bir sürüm çıkarmadan önce değişiklikleri `## [Yayınlanmamış]` altına yaz, sonra başlığı sürüm numarasıyla değiştir.

## [Yayınlanmamış]

## [0.7.5] - 2026-11-25

### Eklendi
- **Claude ve müzik aynı anda:** Claude çalışırken bir şarkı da çalıyorsa toplanmış adanın sağında küçük kapak, şarkının adı ve ses çubukları görünür.
- **Sıvı açılış:** ada büyürken ve küçülürken bir damla gibi hafifçe esneyip yerine oturur.
- **Fareye tepki:** imleç yaklaşınca ada biraz öne eğilir ve kenarı parlar; üstüne gelince açılmadan önce bir tık daha büyür.
- **Basılınca çökme:** düğmeler, sekmeler ve kartlar basılınca içeri göçüp yaylanarak geri gelir.
- **Kayan rakamlar:** Pomodoro, sayaç ve sıcaklık değişirken rakamlar aşağıdan kayarak yerine gelir.
- **Kenar ışığı:** Claude çalışırken adanın kenarında dönen ince bir ışık; iş bitince bir an yeşile döner.
- **Duvar kâğıdının tonu:** ada, ekranın üstündeki duvar kâğıdının renginden biraz alır; açık bir duvar kâğıdında gölgesi derinleşir.
- **Açık tema** ve Windows'un açık/koyu moduna göre değişen **Windows'a göre** tema.
- **Sekme geçişi:** sekmeler arasında içerik kayarak değişir, seçili sekmenin arkasındaki vurgu da yeni sekmeye kayar.
- **Fenerin tepkileri:** uzun süre (50 dk) Claude ya da Pomodoro ile çalışınca ve gece geç saatte esner; Pomodoro'da odaklanmış dar bir ışıkla bakar; izin isterken ışığını sana çevirir; iş bitince zıplar.
- **Mevsimler ve özel günler:** kışın fenerin çatısında kar, baharda çiçek, sonbaharda düşen yaprak; yılbaşında ve doğum gününde parti şapkası ve konfeti; 23 Nisan, 19 Mayıs, 30 Ağustos ve 29 Ekim'de bayrak.
- **Sabah selamı:** günün ilk açılışında "Günaydın Emre · 11° · bugün 2 ders · 1 etkinlik".
- **Ses paketleri:** Klasik, Yumuşak, Mekanik klavye ve 8-bit; Ayarlar → Fener ve sesler'de **Dinle** ile denenir.
- Ayarlar'da yeni **Fener ve sesler** bölümü: ad, doğum günü, ses paketi.

### Değişti
- Simgeler aynı çizgi kalınlığında ve daha yuvarlak köşelerle yeniden çizildi.

### Düzeltildi
- Müzik sekmesinde süre ve ses yüzdesinin arkasında görünen gri kutu (sayaç satırlarıyla aynı sınıf adını kullanıyordu).

## [0.7.4] - 2026-11-25

### Kaldırıldı
- Adayı sürükleyerek taşıma. Ada yine ekranın üst ortasında (ya da Ayarlar'da seçilen solda / sağda) durur; daha önce taşındıysa yerine döner.

## [0.7.3] - 2026-11-25

### Eklendi
- **Hava durumu küçük adada:** fenerin yanında havanın simgesi (güneş, ay, bulut, yağmur, kar, fırtına, sis) ve sıcaklık.
- Şehir seçilmemişse Ada konumu Windows'tan bir kere alır; Ayarlar → Hava durumu'nda **Konumumu kullan** düğmesi.

## [0.7.2] - 2026-11-25

### Eklendi
- **Cihaz bağlanınca adada göster:** Bluetooth kulaklık, fare, klavye, oyun kolu, telefon, saat ya da USB bellek bağlanınca toplanmış adada türünün simgesi, adı ve pili varsa şarj göstergesi birkaç saniye görünür; ayrılınca da kısaca yazar.
- **Pil uyarısı:** bağlı bir cihazın ya da bilgisayarın pili seçtiğin seviyenin (%10 / %15 / %20 / %30) altına düşünce uyarı kartı ve bildirim; %10 ve %5'te bir kez daha.
- Sistem sekmesinde bağlı cihazların pilleri.

### Değişti
- Şarj takıldı / çıkarıldı bildirimi kart yerine kısa hap olarak görünür.

## [0.7.1] - 2026-11-25

### Değişti
- **Güncellemeler daha hızlı gelir:** Ada yeni sürümü 6 saatte bir yerine açılıştan 15 saniye sonra ve saatte bir kontrol eder; bilgisayar uykudan uyanınca da hemen bakar.
- **Arka planda indirme:** yeni sürüm bulununca Ada onu sessizce indirip doğrular; **Güncelle**'ye basınca beklemeden kurulur. Basmazsan Ada kapanırken kendiliğinden kurulur (Ayarlar → Güncellemeler'den kapatılabilir).
- Aynı sürüm için kart bir kez çıkar.
- Sürüm derlemesi Electron ve NSIS dosyalarını önbellekten alır.

## [0.7.0] - 2026-11-25

### Eklendi
- **Komut çubuğu** (`Ctrl+Alt+Boşluk`): ada bir arama kutusuna dönüşür. Uygulama aç, hesap yap, birim çevir, sayaç ya da alarm kur, Spotify'da şarkı ara ve çal, not al, ayar değiştir, sekme aç, Google'da ara.
- **Sayaç ve alarm:** "15 dk çay", "7:30 kalk" gibi yazılır; birkaç tanesi aynı anda çalışır, duraklatılır, ertelenir. Odak sekmesinde **Sayaç** modu; Ada kapalıyken dolan alarm açılışta çalar.
- **Tek tıkla güncelleme:** yeni sürüm kartında **Güncelle**; Ada kurulum dosyasını indirir, boyutunu ve GitHub'ın sha256 özetini doğrular, sessizce kurar ve yeniden açılır.
- **Hava durumu** (Open-Meteo): fenerin yanında sıcaklık, fenerde yağmur / kar / fırtına / sis; Sistem sekmesinde şu an ve 3 gün.
- **Renk seçici** (`Ctrl+Alt+C`): büyüteçle ekrandan renk; HEX / RGB / HSL kopyalama.
- **QR kod:** panodaki ya da yazılan metinden; resmi kopyala ya da kaydet.
- **Claude Desktop'a hızlı yanıt:** iş bitince çıkan karttan yazılan yanıt Desktop penceresine gönderilir.
- **Kullanım grafiği:** Claude sekmesinde son 7 günün günlük token kullanımı, haftalık limit geçmişi, en çok çalışılan projeler.
- **Adayı sürükleyerek taşıma** ve **imlecin olduğu ekranı takip etme**.
- **Eklenti sistemi:** `plugins` klasöründen sekme yükleme, örnek Döviz eklentisi, [`PLUGINS.md`](PLUGINS.md).
- Birim testleri (`npm test`) ve her gönderide çalışan GitHub Actions kontrolü.
- Hata, öneri ve PR şablonları; `CONTRIBUTING.md`.
- İngilizce README (`README.en.md`).

### Değişti
- Müziği oynat / duraklat kısayolu `Ctrl+Alt+Enter` oldu; `Ctrl+Alt+Boşluk` artık komut çubuğunu açar.
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
