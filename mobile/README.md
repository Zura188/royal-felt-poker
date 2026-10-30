# mobile — pembungkus Android (Capacitor 8)

Folder ini tidak berisi kode game; ia membungkus hasil build web (`apps/web/dist`) menjadi APK.

- `capacitor.config.json` — id aplikasi `com.royalfelt.capsa`, nama "Royal Felt", `webDir` ke `../apps/web/dist`, bilah sistem disembunyikan (plugin SystemBars).
- `scripts/patch-android.mjs` — dijalankan setelah `npx cap add android`: landscape (`sensorLandscape`), izin getar, keyboard `adjustResize`, ikon adaptif + ikon lama, splash gelap, versionCode/versionName. Tiap langkah "sebisanya": bila template Android berbeda, langkah dilewati dengan peringatan. `RF_SAFE=1` = hanya manifest.
- `scripts/make-icons.py` — membuat ulang ikon di `assets/` (butuh Pillow). `assets/res/mipmap-*` dan `assets/splash.png` dipakai skrip patch.
- `signing/debug.keystore` — kunci debug TETAP (sandi `android`, alias `androiddebugkey`) agar APK baru bisa menimpa APK lama. Kunci ini terbuka; jangan dipakai untuk Play Store.
- `android-apk.workflow.yml` — salinan `.github/workflows/android-apk.yml` untuk ditempel manual bila folder `.github` tidak ikut terunggah.

Folder `android/` dibuat otomatis (tidak disimpan di git). Build lokal: lihat "Masalah umum" di README utama.
