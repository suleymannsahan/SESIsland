# Katkıda bulunma

Ada'ya ilgi gösterdiğin için teşekkürler! Hata bildirmek, öneri yazmak ve kod göndermek için bu sayfa yeterli.

## Hata ve öneriler

- **Hata:** [Hata bildir](https://github.com/suleymannsahan/SESIsland/issues/new?template=hata.yml) şablonunu kullan. Tepsi menüsünden **Sorun giderme → Tanı raporu oluştur** ile masaüstüne yazılan `ada-tani.txt`'yi eklersen sorun çok daha hızlı bulunur.
- **Öneri:** [Özellik öner](https://github.com/suleymannsahan/SESIsland/issues/new?template=oneri.yml) şablonunu kullan. Ne yapmak istediğini anlatman yeterli.

## Geliştirme ortamı

Gerekenler: Windows 10/11, [Node.js](https://nodejs.org) 20 veya üstü, Git.

```bash
git clone https://github.com/suleymannsahan/SESIsland.git
cd SESIsland
npm install
npm start      # Ada'yı geliştirme modunda açar
npm test       # birim testleri
```

Kurulu bir Ada açıksa önce onu kapat; ikisi aynı portu (`127.0.0.1:47821`) kullanır.

Testler saf modülleri (hesap makinesi, elektronik, iCal, LRC, seri port ayrıştırma, sürüm karşılaştırma, CHANGELOG) kapsar ve Linux'ta da çalışır. Windows'a bağlı kısımları (`scripts/*.ps1`, pencere, tepsi) elle dene.

## Kod

- Bağımlılık eklemeden önce sor; Ada bilerek Electron dışında çalışma zamanı bağımlılığı taşımıyor.
- Arayüz metinleri Türkçe, kod yorumları İngilizce.
- Renderer tarafı `src/renderer/core.js` + her sekme için bir `tab-*.js` dosyası. Ana süreçle konuşma `src/preload.js` üzerinden.
- Yeni bir saf fonksiyon yazdıysan `test/` altına küçük bir test ekle.
- Ağa yeni bir istek ya da diske yeni bir kayıt ekliyorsan README'deki **Gizlilik** bölümüne de yaz.

## Pull request

1. Depoyu fork'la, `main`'den bir dal aç.
2. Değişikliği yap; `npm test` geçsin.
3. Kullanıcının göreceği bir değişiklikse `CHANGELOG.md`'de `## [Yayınlanmamış]` altına bir satır ekle.
4. PR'ı aç; şablondaki kontrol listesini doldur.

## Sürüm çıkarma (bakımcı)

1. `package.json`'daki sürümü artır.
2. `CHANGELOG.md`'de `## [Yayınlanmamış]` başlığını `## [x.y.z] - YYYY-AA-GG` yap, üstüne boş bir `## [Yayınlanmamış]` ekle, alttaki bağlantıları güncelle.
3. `git tag vx.y.z && git push origin vx.y.z` — GitHub Actions testleri çalıştırır, kurulum dosyasını derler ve sürüm notlarını CHANGELOG'dan doldurur.
