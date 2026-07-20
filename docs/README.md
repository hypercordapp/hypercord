# docs/

Ana `README.md` içinde referans verilen görseller:

- `logo.png` — proje logosu (README'nin en üstünde gösterilir)
- `banner.png` — tanıtım banner'ı

Değiştirmek istersen bu dosyaların üzerine aynı isimle yenisini koyman yeterli, README otomatik günceller.

## badges.json

HyperCord istemcisinin `BadgeAPI` pluginin her 30 dakikada bir bu dosyayı
(`main` dalından, raw.githubusercontent.com üzerinden) çekip profil
rozetlerini gösterdiği yer burası. Buraya eklenen her şey **HyperCord
kullanan herkesin istemcisinde** görünür — Discord tarafında gerçek bir
karşılığı yoktur, sadece HyperCord'un kendi profil kartı render'ına
eklenir.

Format, Discord ID'sini bir rozet dizisine eşler:

```json
{
    "123456789012345678": [
        { "badge": "https://i.imgur.com/xxxxxxx.png", "tooltip": "Benim Rozetim" }
    ]
}
```

- `badge`: rozet ikonunun (kare, tercihen şeffaf arka plan) resim URL'i. Repo dışında barındırılmalı (imgur, kendi CDN'in vb.) — bu dosya sadece eşleştirmeyi tutar.
- `tooltip`: rozetin üzerine gelince çıkan yazı.
- Bir kullanıcı birden fazla rozete sahip olabilir (dizi).
- Yeni bir rozet eklemek için bu dosyaya PR at; mevcut Nitro/Discord rozetleriyle çakışmaz, ek bir rozet olarak sıraya eklenir.
