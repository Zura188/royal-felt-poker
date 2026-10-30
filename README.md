# Royal Felt — Capsa Banting (v0.7.1)

Game kartu Capsa Banting (gaya Big Two) dengan koin virtual saja. Web + Android (APK dibangun otomatis lewat Capacitor + GitHub Actions). UI Bahasa Indonesia, landscape.

## Fitur
- 4 pemain: kamu + 3 bot, 13 kartu, habiskan kartu lebih dulu. Dialog "Pilih Aturan Permainan" (urutan simbol, A2345/23456, triple, flush, penalti, dll).
- Bot kuat (determinisasi Monte Carlo: menghitung kartu yang sudah keluar dan mensimulasikan ratusan kemungkinan tangan lawan). Benchmark melawan 3 bot heuristik lama: menang ±60% (acak = 25%).
- Mode: Main Offline (vs bot) atau Mabar Online (room 4 huruf, kursi kosong diisi bot, server memegang kartu).
- Taruhan 8 tingkat, **maksimal 1.000.000** per kartu sisa (100 · 500 · 2K · 10K · 50K · 100K · 500K · 1JT), misi harian + seumur hidup (hadiah 100.000 sampai 1.000.000), saldo awal 100.000 koin virtual, riwayat, simpan lokal.
- Karakter 3D bergaya kasino (sprite hasil render, tanpa library 3D saat runtime).

### Baru di v0.7.1 — APK Android otomatis lewat GitHub
- Folder `mobile/` (Capacitor 8) + `.github/workflows/android-apk.yml`: tiap push ke GitHub, GitHub Actions membangun web, membungkusnya jadi APK Android (landscape penuh layar, getar aktif, ikon chip + sekop emas, splash hijau tua), lalu menyimpannya di **Artifacts** (dan di **Releases** bila kamu membuat tag `v*`). Kunci tanda tangan debug dibuat tetap (`mobile/signing/debug.keystore`) agar APK baru bisa dipasang menimpa yang lama tanpa menghapus koinmu.
- Alamat server mabar bisa ditanam ke APK lewat variabel repo `VITE_DEFAULT_SERVER` (lihat "APK Android" dan "Deploy server ke Render" di bawah).
- `npm run build` kini hanya `vite build` (tidak lagi gagal gara-gara pemeriksaan tipe); pemeriksaan ketat tetap ada: `npm run build:strict` dan `npm run typecheck`. `render.yaml` memakai salinan web siap pakai bila build web gagal.

### Baru di v0.7 — kartu besar, gerak luwes, taruhan sampai 1 juta
- **Kartu di tangan diperbesar 28%** (kipas melengkung; di HP 844×390 tiap kartu menyisakan ±44 px lebar untuk diketuk). Ketuk satu kartu, atau **geser jari menyapu beberapa kartu sekaligus** (geser balik untuk batal, maksimal 5). Kartu terpilih terangkat dengan gerak pegas; tombol **URUT** (angka/suit) dan **SARAN** ada di kolom kanan.
- **Gerak natural, tidak kaku**: kartu dibagi dari bandar satu per satu lalu terbuka, kartu terbang dari tanganmu ke tengah meja (kartu lawan dari kursinya) dan mendarat dengan sedikit memantul, kartu lama tenggelam atau disapu saat putaran baru, pita "GILIRANMU", titik "berpikir" di kursi bot, mahkota di pemegang kemenangan terakhir, napas halus pada avatar.
- **Taruhan sampai 1.000.000** (meja Legenda). Syarat duduk = kekalahan terbesar meja itu (mode peringkat: 6× taruhan = 6.000.000; mode menang-pertama: 39× taruhan = 39.000.000). Meja ≥100K berhias bola lampu, 1JT bersorot lampu + lencana emas berkilau, warna kain otomatis naik kelas (hijau → biru → merah → hitam). Penalti keluar di tengah game kini tidak melebihi "kalah maks." meja dan nominalnya ditampilkan di dialog konfirmasi.
- **Roda Hoki** harian gratis (10K–1JT; ada tik pada tiap sekat, penunjuk berkibas, konfeti/koin untuk hadiah besar). Hadiah dicatat saat diundi, jadi menutup aplikasi di tengah putaran tidak menghilangkan hadiah.
- **Koleksi**: warna kain meja (otomatis/hijau/biru/merah/hitam/ungu) dan punggung kartu (biru/merah/emas/hitam). **Pengaturan**: kecepatan bot (Normal/Cepat). **Profil**: kemenangan terbesar, menang beruntun, rekor beruntun.
- Dialog bantuan (tombol ?) di meja menjelaskan urutan kombinasi, taruhan, dan cara memilih kartu.
- **Obrolan cepat** (8 kalimat) — di mode online dikirim ke teman lewat server (dibatasi 1 pesan/1,5 detik); offline bot ikut menimpali.
- **Mabar**: host mengatur **taruhan (panah ‹ ›) dan aturan** di ruang tunggu, dan semua teman langsung melihatnya sebelum game mulai (pesan baru `config`; hanya host, tidak saat game berjalan). Tamu tidak bisa mengubah aturan.
- Perbaikan: saldo/riwayat/statistik **tamu** di mode online ikut tercatat setelah game (sebelumnya hanya host); kartu terluar tidak lagi terpotong tepi layar; tulisan pada chip di lencana taruhan tidak lagi kebesaran dan menempel ke angka (chip 1JT emas bertulisan gelap); dialog Bantuan bisa ditutup dengan tombol Esc.

### Di v0.6 — tampilan & efek
- **Suara** hasil sintesis WebAudio (18 efek: kartu, klik, kombo, bom, menang, koin, dll) — tanpa berkas audio, jalan offline.
- **Partikel** kanvas: koin, konfeti, percikan, debu emas di lobi; ada penjaga FPS dan mode **Hemat** (Pengaturan → Kualitas efek).
- **Getar** (HP) untuk pilih kartu, main, bom, menang, klaim misi.
- **Meja**: kartu dibagikan bandar, kartu terbang dari kursi pemain ke tengah, seruan kombo (TRIPLE/STRAIGHT/FULL HOUSE/BOM), peringatan "Satu lagi!", cincin waktu giliran (online), tombol MAINKAN menampilkan jenis kombinasi yang dipilih, kartu yang tak bisa dimainkan diredupkan.
- **Bandar** punya pose baru: membagi kartu dan bersorak (render 3D); bisa diketuk di lobi.
- **Hasil game**: medali, hitung naik koin, hujan konfeti/koin saat menang. Saldo berkedip hijau/merah saat berubah.
- Pengaturan: efek suara, getar, kualitas efek, kurangi animasi (mengikuti pengaturan sistem untuk pemain baru). Mendukung notch/safe-area.
- Kait uji: tambahkan `?debug` pada alamat untuk memakai `window.__rfp` (memicu efek, mengukur suara).

## Struktur
- `packages/capsa-engine`: mesin game + bot (39 tes). `apps/server`: server mabar (14 tes WebSocket). `npm test` menjalankan keduanya.
- `packages/shared`, `apps/web` (React 18 + Vite 6).
- `render.yaml`: blueprint Render (belum diuji di Render sungguhan).
- `mobile/`: pembungkus Android (Capacitor 8): `capacitor.config.json`, `scripts/patch-android.mjs` (landscape, getar, ikon, splash, versi), `assets/` (ikon), `signing/debug.keystore` (kunci debug tetap). Folder `android/` dibuat otomatis, tidak disimpan di repo.
- `.github/workflows/android-apk.yml`: build APK + (informasi) tes dan cek tipe. Salinan berkas yang sama ada di `mobile/android-apk.workflow.yml` untuk ditempel manual bila folder `.github` tidak ikut terunggah.

## Jalankan
`npm install`, lalu `npm run dev` (web), `npm run build` (web → `apps/web/dist`; `npm run build:strict` = dengan pemeriksaan tipe), `npm run server` (server mabar, port 8787; `PORT=...` untuk mengganti), `npm run typecheck`.

## Server mabar
- Server memegang state game dan hanya mengirim kartu milik pemain itu sendiri. Server juga menyajikan web (dari `apps/web/dist`, atau salinan siap pakai di `apps/server/public`), jadi teman cukup membuka satu alamat. `GET /healthz` → `ok`.
- **Tahan jaringan HP / hosting gratis**: klien mengirim ping tiap 20 detik (juga menjaga server gratis tetap terjaga), server memutus sambungan yang diam 75 detik, dan koneksi pertama sabar menunggu server "bangun" (sampai ±75 detik, dengan pesan di layar).
- **Kembali ke kursi**: bila sambungan putus tak sengaja (pindah aplikasi, sinyal hilang, aplikasi dimatikan), kursi ditahan 2 menit. Bot memainkan giliranmu sementara; klien menyambung ulang otomatis memakai token rahasia dan kembali ke meja. Tombol KELUAR melepas kursi seketika.
- Belum ada akun/saldo di server: koin online dihitung di perangkat dari hasil game (belum aman dari curang) — perlu akun + saldo server sebelum rilis umum.

## APK Android (GitHub Actions)
1. Buat repo di GitHub lalu unggah **seluruh isi** folder proyek ini, termasuk folder tersembunyi `.github`. Paling mudah lewat git: `git init && git add . && git commit -m "Royal Felt" && git branch -M main && git remote add origin https://github.com/NAMAMU/NAMA-REPO.git && git push -u origin main`. Lewat web GitHub (Add file → Upload files) ada batas 100 berkas per unggahan, jadi unggah per folder; bila `.github` tidak ikut, buat file baru bernama `.github/workflows/android-apk.yml` dan tempel isi `mobile/android-apk.workflow.yml`.
2. Buka tab **Actions**: workflow **Build APK Android** jalan otomatis (±8–12 menit pada run pertama). Bila belum jalan: Actions → Build APK Android → **Run workflow** (repo baru kadang meminta klik tombol untuk mengaktifkan workflow).
3. Setelah hijau ✓: buka run itu → bagian **Artifacts** paling bawah → **royal-felt-apk** → ekstrak zip → pasang file `.apk` di HP (izinkan "instal dari sumber tidak dikenal"; bila Play Protect bertanya pilih "Instal tetap").
4. Link unduh untuk teman: `git tag v0.7.1 && git push origin v0.7.1` → APK muncul di halaman **Releases** (repo publik: siapa pun bisa unduh; repo privat: hanya kolaborator).
5. Push berikutnya menghasilkan APK baru dengan kunci yang sama, jadi bisa dipasang menimpa APK lama dan koin/riwayat tetap ada. Ini kunci *debug* yang terbuka di repo: cukup untuk main bareng teman, bukan untuk Play Store.

Tampilan di APK: landscape penuh layar (bilah sistem disembunyikan; geser dari tepi layar untuk memunculkannya sebentar), getar aktif, ikon chip + sekop emas, splash hijau tua.

## Deploy server ke Render (gratis)
1. Daftar di render.com (boleh dengan akun GitHub) → **New + → Blueprint** → pilih repo ini → **Apply**. Render membaca `render.yaml` (layanan `royal-felt`, region Singapore, paket Free, cek kesehatan `/healthz`) lalu membangun otomatis (±3–6 menit). Tiap push ke GitHub memicu deploy ulang.
2. Setelah status **Live**, salin alamat layanan di bagian atas halaman (biasanya `https://royal-felt.onrender.com`; bila nama sudah dipakai orang lain, Render menambahkan akhiran acak — pakai alamat yang tertulis di dashboard). Uji: buka `<alamat>/healthz` di browser → tertulis `ok`.
3. Tanam ke APK: GitHub → repo → **Settings → Secrets and variables → Actions → tab Variables → New repository variable** → Name `VITE_DEFAULT_SERVER`, Value `wss://royal-felt.onrender.com` (boleh diketik `https://…`, otomatis dirapikan jadi `wss://`). Lalu Actions → **Build APK Android → Run workflow** untuk membuat APK baru yang sudah berisi alamat itu. Tanpa langkah ini pemain tetap bisa mengetik alamat sendiri di layar Mabar Online (alamat terakhir diingat).
4. Main bareng: satu orang **Buat Room** → bagikan kode 4 huruf → teman **Gabung** → host mengatur taruhan dan aturan → MULAI. Server gratis tidur setelah 15 menit sepi; sambungan pertama bisa menunggu ±1 menit sampai server bangun (aplikasi menampilkan pesannya). Selama ada yang tersambung, ping tiap 20 detik menjaganya tetap bangun.
5. Batas Render Free: 750 jam instans per bulan, file hilang saat restart (server tidak menyimpan akun/saldo — koin disimpan di HP masing-masing), memori 512 MB. Sambungan dari APK harus `wss://` (Render sudah menyediakan TLS).

## Masalah umum
- **Actions merah di "Bangun APK (Gradle)"**: workflow otomatis mengulang dengan penyesuaian minimal (tanpa ikon/splash kustom). Bila run tetap merah, salin ±40 baris terakhir log langkah yang gagal untuk diperiksa.
- **Merah di "Pasang dependensi" atau "Build web"**: jalankan ulang (Re-run all jobs); bila sama, kirim log langkahnya. Pemeriksaan tipe ketat ada di job "Tes dan cek tipe" (boleh merah tanpa menghalangi APK).
- **"Aplikasi tidak terpasang / bertentangan dengan paket yang ada"**: APK lama ditandatangani kunci lain (mis. dari Android Studio). Hapus aplikasi lama sekali, pasang APK baru; setelahnya update bisa menimpa.
- **Tidak bisa masuk room / "tidak dapat tersambung"**: pastikan alamat `wss://…` (bukan `ws://`), buka `<alamat>/healthz` di browser HP (harus `ok`), tunggu sampai 1 menit bila server baru bangun, dan cek kode room 4 huruf.
- **Teman tidak melihat taruhan/aturan baru**: hanya host yang bisa mengubahnya, dan hanya sebelum game dimulai.
- **Getar/suara tidak ada**: cek Pengaturan di dalam game (Getar, Efek suara) dan volume media HP.
- **Build lokal**: `npm install && npm run build`, lalu `cd mobile && npm install && npx cap add android && node scripts/patch-android.mjs && cd android && ./gradlew assembleDebug` (perlu JDK 21 + Android SDK). Hasil: `mobile/android/app/build/outputs/apk/debug/app-debug.apk`.

## Alamat server bawaan (untuk web dan APK)
Isian "Alamat server" di layar Mabar Online dibuat dari (berurutan): alamat terakhir yang dipakai pemain → `VITE_DEFAULT_SERVER` saat build → alamat halaman bila dibuka dari server sendiri → `ws://localhost:8787`. Alamat yang diketik dirapikan otomatis (`https://x` → `wss://x`, tanpa skema → `wss://`).

Menanam alamat ke APK: salin `apps/web/.env.production.example` menjadi `apps/web/.env.production`, isi `VITE_DEFAULT_SERVER=wss://nama-server-kamu`, lalu build ulang (di GitHub Actions cukup isi variabel repo `VITE_DEFAULT_SERVER`). **Wajib `wss://`** (TLS): aplikasi di APK/Capacitor berasal dari origin `https`, sehingga `ws://` (tanpa TLS) diblokir sebagai mixed content. Layanan seperti Render sudah memberi TLS otomatis; untuk VPS sendiri pasang domain + Caddy/nginx (Let's Encrypt).

## Hosting server gratis (kondisi per 24 Okt 2026 — cek ulang sebelum memakai)
| Opsi | Gratis | Catatan |
|---|---|---|
| **Render Free** (disarankan untuk mulai) | 750 jam/bulan, 512 MB; tanpa kartu untuk mulai | Tidur setelah 15 menit tanpa lalu lintas masuk (pesan WebSocket dari klien dihitung), bangun ±1 menit. File hilang saat restart. Domain `*.onrender.com` dengan TLS. |
| Oracle Cloud Always Free | VM sungguhan: 2× AMD micro (1 GB) dan Arm A1 (setara 2 OCPU/12 GB), 10 TB keluar/bulan | Aktif terus, tapi bisa diambil kembali bila terlalu sepi (CPU/jaringan <20% selama 7 hari), daftar umumnya minta kartu, kapasitas A1 sering penuh. Perlu pasang TLS sendiri. |
| Google Cloud e2-micro | 1 VM, hanya region AS | Butuh kartu; jauh dari Indonesia (latensi tinggi). |
| Koyeb | 1 layanan, 512 MB / 0,1 vCPU; Frankfurt atau Washington | Butuh kartu (pra-otorisasi). |
| Railway | uji 30 hari ($5), lalu kredit $1/bulan | Kredit $1 hanya cukup untuk ±100 MB RAM — kurang untuk server ini. |
| Fly.io | tidak ada jatah gratis | Wajib kartu; sekitar $2/bulan untuk mesin terkecil. |

Langkah Render lengkap: lihat "Deploy server ke Render" di atas.

## Status jujur
- **Pipeline APK (v0.7.1) belum pernah dijalankan.** Pembuatnya tidak punya akses npm/Gradle/Android SDK, jadi yang teruji hanya: sintaks YAML + seluruh blok shell workflow (`bash -n`), simulasi langkah pemeriksaan APK, skrip penyesuaian Android terhadap template tiruan (termasuk mode aman, template yang berbeda, dan jalan ulang), kunci debug terbaca `keytool`, ikon diperiksa visual. Baru terbukti saat run pertama di GitHub: `vite build` asli, `cap add android` (Capacitor 8.5.x), Gradle, dan pemasangan di HP. Bila penyesuaian kosmetik bermasalah, workflow mengulang otomatis dalam mode aman; bila tetap gagal, kirim log langkah yang merah.
- `render.yaml` belum diuji di Render sungguhan (sintaks YAML valid; kunci mengikuti spesifikasi Blueprint).
- Teruji: mesin + bot (39 tes), server (14 tes: alur game, putus-kembali ke kursi, sambungan mati, healthz, obrolan cepat, taruhan 1 jt, pengaturan host), alur UI di browser lewat bundle esbuild (lobi, pilih meja 8 tingkat, Roda Hoki termasuk tutup-di-tengah-putaran, Koleksi, pengaturan, profil, offline satu game penuh di meja 1 jt + keluar di tengah game, mabar dua browser satu game penuh di meja 1 jt + obrolan + game kedua, putus/kembali, muat ulang), tampilan 1280×720 / 844×390 / 667×375, efek suara diukur lewat render offline.
- `tsc` strict (termasuk noUnusedLocals) lolos untuk seluruh kode memakai stub tipe React buatan sendiri (npm diblokir di sandbox). Belum teruji: `vite build` asli, APK Capacitor, `render.yaml` di Render, rasa suara di speaker nyata, performa partikel di HP kelas bawah, gestur sentuh di layar sungguhan (tes memakai mouse), akun/saldo server, VIP. Jalankan `npm run build` sekali di mesinmu untuk konfirmasi akhir.
- Asumsi aturan yang perlu dikonfirmasi: straight spesial di atas biasa, makna "Straight > Full House", pengali penalti, pembayaran peringkat, taruhan per kartu sisa.
- Taruhan tinggi online: koin dihitung di perangkat masing-masing, jadi pemain yang mengutak-atik aplikasinya bisa curang. Aman untuk main bareng teman; untuk umum perlu saldo di server.
- Tamu di mabar tidak dicek saldonya terhadap taruhan host (hanya diberi peringatan); kerugian tamu dijepit sebesar saldonya, jadi saldo tidak pernah negatif.
