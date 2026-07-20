<div align="center">

<img src="./docs/logo.png" alt="HyperCord" width="200" />

# HyperCord

</div>

![](https://img.shields.io/github/package-json/v/hypercordapp/hypercord?style=for-the-badge&logo=github&logoColor=d3869b&label=&color=1d2021&labelColor=282828)
![](https://img.shields.io/github/license/hypercordapp/hypercord?style=for-the-badge&color=1d2021&labelColor=282828)

<!-- TODO(discord): Discord sunucun hazır olduğunda invite linkini ekleyip bu satırı aç -->
<!-- [![](https://img.shields.io/discord/YOUR_SERVER_ID?style=for-the-badge&label=Discord&color=5865F2&labelColor=282828)](https://discord.gg/YOUR_INVITE) -->

**[Türkçe](#türkçe) · [English](#english)**

![](./docs/banner.png)

---

## Türkçe

Vencord tabanlı, **Equicord'dan daha fazla plugin** içermeyi ve piyasada adını duyurmayı hedefleyen bir Discord client mod'u.

### Özellikler

-   Kurulumu kolay
-   Vencord'un tüm built-in plugin'leri + HyperCord'a özel onlarca ek plugin (Fun, Utility, Chat, Voice Chat, Themes, Experimental)
-   Bu kadar çok plugin'e rağmen oldukça hafif
-   Mükemmel tarayıcı desteği: extension veya UserScript ile tarayıcında çalıştır
-   Herhangi bir Discord branch'inde çalışır: Stable, Canary, PTB fark etmez
-   Özel CSS ve tema desteği: dahili CSS editörü, herhangi bir CSS dosyasını import edebilir (BetterDiscord temaları dahil)
-   Gizlilik dostu: Discord'un analytics ve crash reporting'ini kutudan çıktığı gibi engeller, telemetri yok
-   **Yol haritasında:** kendi plugin marketi, otomatik güncelleme sistemi, bulut ayar senkronizasyonu (bkz. [proje.md](./proje.md))

### Kurulum / Kaldırma

En kolay yol — [Releases](https://github.com/hypercordapp/hypercord/releases/latest) sayfasından işletim sistemine uygun installer'ı indir:

-   **Windows (GUI):** `HyperCordInstaller.exe` — indir, çalıştır, Discord'unu seç, kur
-   **Windows / Linux / macOS (CLI):** `HyperCordInstallerCli.exe`, `HyperCordInstallerCli-linux`, `HyperCordInstallerCli-macos`

Installer'ın kaynak kodu: [hypercordapp/HyperCordInstaller](https://github.com/hypercordapp/HyperCordInstaller)

Alternatif olarak kaynak koddan derleyip kurabilirsin:

```sh
git clone https://github.com/hypercordapp/hypercord
cd hypercord
pnpm install
pnpm build
pnpm inject
```

Kaldırmak için:

```sh
pnpm uninject
```

### Destek/Topluluk Sunucumuza Katıl

<!-- TODO(discord): Discord sunucun hazır olduğunda invite linkini buraya ekle -->

_yakında_

### Destek Ol

HyperCord'un henüz kendi bağış/sponsorluk altyapısı yok. Bu repodaki **Sponsor** butonu ya da [hypercord.pro/donate](https://hypercord.pro/donate) şu an için projeyi desteklemenin yollarını (yıldız bırakmak, katkıda bulunmak, issue açmak) listeliyor.

### Katkıda Bulunma

Katkı sağlamak istersen [CONTRIBUTING.md](./CONTRIBUTING.md) dosyasına göz at.

### Teşekkürler & Lisans

GNU General Public License v3.0 — bkz. [LICENSE](./LICENSE).

Bu proje [Vencord](https://github.com/Vendicated/Vencord)'un bir forku olarak başlamıştır. Orijinal Vencord ekibine ve tüm katkıda bulunanlara teşekkürler.

### Sorumluluk Reddi

Discord, Discord Inc.'in ticari markasıdır ve yalnızca açıklayıcı amaçla anılmıştır. Bu anılma Discord Inc. ile herhangi bir bağlantı veya onay anlamına gelmez.

<details>
<summary>HyperCord kullanmak Discord'un kullanım şartlarını ihlal eder</summary>

Client modifikasyonları Discord'un Kullanım Şartları'na aykırıdır.

Ancak Discord bu konuda oldukça kayıtsız ve client mod kullandığı için banlanan bilinen bir vaka yok! Kötüye kullanım içeren plugin'ler kullanmadığın sürece genelde sorun yaşamazsın. Merak etme, dahili plugin'lerin hepsi güvenli.

Yine de hesabın senin için çok önemliyse ve devre dışı kalması bir felaket olacaksa, güvenli olmak adına hiçbir client mod (sadece HyperCord değil) kullanmamayı düşünebilirsin.

Ayrıca, banlanma riski olan bir sunucuda HyperCord'un göründüğü ekran görüntüsü paylaşmamaya dikkat et.

</details>

### Yıldız Geçmişi

<a href="https://star-history.com/#hypercordapp/hypercord&Timeline">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://api.star-history.com/svg?repos=hypercordapp/hypercord&type=Timeline&theme=dark" />
    <source media="(prefers-color-scheme: light)" srcset="https://api.star-history.com/svg?repos=hypercordapp/hypercord&type=Timeline" />
    <img alt="Star History Chart" src="https://api.star-history.com/svg?repos=hypercordapp/hypercord&type=Timeline" />
  </picture>
</a>

---

## English

A Discord client mod based on Vencord, aiming to include **more plugins than Equicord** and build a name for itself.

### Features

-   Easy to install
-   All of Vencord's built-in plugins + dozens of HyperCord-exclusive plugins (Fun, Utility, Chat, Voice Chat, Themes, Experimental)
-   Fairly lightweight despite the many inbuilt plugins
-   Excellent Browser Support: Run HyperCord in your Browser via extension or UserScript
-   Works on any Discord branch: Stable, Canary or PTB all work
-   Custom CSS and Themes: Inbuilt css editor with support to import any css files (including BetterDiscord themes)
-   Privacy friendly: blocks Discord analytics & crash reporting out of the box and has no telemetry
-   **On the roadmap:** its own plugin marketplace, an automatic updater, cloud settings sync (see [proje.md](./proje.md))

### Installing / Uninstalling

Easiest way — grab the installer for your OS from [Releases](https://github.com/hypercordapp/hypercord/releases/latest):

-   **Windows (GUI):** `HyperCordInstaller.exe` — download, run, pick your Discord install, done
-   **Windows / Linux / macOS (CLI):** `HyperCordInstallerCli.exe`, `HyperCordInstallerCli-linux`, `HyperCordInstallerCli-macos`

Installer source: [hypercordapp/HyperCordInstaller](https://github.com/hypercordapp/HyperCordInstaller)

Alternatively, build and install from source:

```sh
git clone https://github.com/hypercordapp/hypercord
cd hypercord
pnpm install
pnpm build
pnpm inject
```

To uninstall:

```sh
pnpm uninject
```

### Join our Support/Community Server

<!-- TODO(discord): add the invite link once your Discord server is ready -->

_coming soon_

### Support

HyperCord doesn't have its own donation/sponsorship setup yet. This repo's **Sponsor** button and [hypercord.pro/donate](https://hypercord.pro/donate) currently list ways to support the project in the meantime (starring, contributing, opening issues).

### Contributing

If you want to contribute, check out [CONTRIBUTING.md](./CONTRIBUTING.md).

### Credits & License

GNU General Public License v3.0 — see [LICENSE](./LICENSE).

This project started as a fork of [Vencord](https://github.com/Vendicated/Vencord). Thanks to the original Vencord team and all its contributors.

### Disclaimer

Discord is trademark of Discord Inc. and solely mentioned for the sake of descriptivity.
Mention of it does not imply any affiliation with or endorsement by Discord Inc.

<details>
<summary>Using HyperCord violates Discord's terms of service</summary>

Client modifications are against Discord's Terms of Service.

However, Discord is pretty indifferent about them and there are no known cases of users getting banned for using client mods! So you should generally be fine as long as you don't use any plugins that implement abusive behaviour. But no worries, all inbuilt plugins are safe to use!

Regardless, if your account is very important to you and it getting disabled would be a disaster for you, you should probably not use any client mods (not exclusive to HyperCord), just to be safe.

Additionally, make sure not to post screenshots with HyperCord in a server where you might get banned for it.

</details>

### Star History

<a href="https://star-history.com/#hypercordapp/hypercord&Timeline">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://api.star-history.com/svg?repos=hypercordapp/hypercord&type=Timeline&theme=dark" />
    <source media="(prefers-color-scheme: light)" srcset="https://api.star-history.com/svg?repos=hypercordapp/hypercord&type=Timeline" />
    <img alt="Star History Chart" src="https://api.star-history.com/svg?repos=hypercordapp/hypercord&type=Timeline" />
  </picture>
</a>
