#!/usr/bin/env node
/*
 * Menyesuaikan proyek Android hasil `npx cap add android` agar cocok untuk game ini.
 * Dipanggil otomatis oleh .github/workflows/android-apk.yml; bisa juga dijalankan manual dari folder mobile/:
 *   node scripts/patch-android.mjs
 *
 * Yang dilakukan:
 *   1. Manifest: layar landscape (boleh terbalik, ikut sensor), izin VIBRATE (agar getar jalan di WebView),
 *      keyboard layar mengecilkan tampilan (adjustResize).
 *   2. Ikon aplikasi (chip kasino + sekop emas) untuk semua kepadatan layar, ikon adaptif Android 8+.
 *   3. Latar splash gelap (hijau tua) agar tidak ada kilatan putih saat aplikasi dibuka.
 *   4. versionCode / versionName.
 *
 * Prinsip: tiap penyesuaian dikerjakan "sebisanya". Bila bentuk berkas template berbeda dari perkiraan,
 * penyesuaian itu DILEWATI dengan peringatan, dan build tetap berjalan (aplikasi tetap jadi; hanya
 * bagian kosmetik yang tidak terpasang). Skrip ini aman dijalankan berulang kali.
 *
 * Variabel lingkungan:
 *   RF_SAFE=1           hanya penyesuaian paling minimal (manifest). Dipakai untuk build ulang bila build penuh gagal.
 *   RF_VERSION_CODE     bilangan bulat untuk versionCode (mis. nomor run GitHub). Kosong = tidak diubah.
 *   RF_VERSION_NAME     versionName (mis. 0.7.1). Bawaan: versi di mobile/package.json.
 *   RF_ANDROID_DIR      lokasi proyek Android (bawaan: mobile/android). Dipakai untuk uji.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const mobile = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const androidDir = process.env.RF_ANDROID_DIR ? path.resolve(process.env.RF_ANDROID_DIR) : path.join(mobile, 'android');
const assets = path.join(mobile, 'assets');
const main = path.join(androidDir, 'app', 'src', 'main');
const res = path.join(main, 'res');
const safe = process.env.RF_SAFE === '1';

const results = [];
const note = (ok, what, detail = '') => {
  results.push(ok);
  console.log(`${ok ? '✔' : '⚠'} ${what}${detail ? ` — ${detail}` : ''}`);
  if (!ok && process.env.GITHUB_ACTIONS) console.log(`::warning::Penyesuaian dilewati: ${what}${detail ? ` (${detail})` : ''}`);
};
const exists = (p) => fs.existsSync(p);
const read = (p) => fs.readFileSync(p, 'utf8');
const write = (p, s) => fs.writeFileSync(p, s);
const step = (what, fn) => {
  try {
    fn();
  } catch (e) {
    note(false, what, `galat: ${e && e.message ? e.message : e}`);
  }
};

function walk(dir, out = []) {
  if (!exists(dir)) return out;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}

/** Salin gambar PNG ke `dir/base.png`; hapus berkas gambar lain bernama sama (mis. .webp) agar tidak bentrok. */
function putImage(dir, base, src) {
  fs.mkdirSync(dir, { recursive: true });
  for (const ext of ['.png', '.webp', '.jpg', '.jpeg']) {
    const p = path.join(dir, base + ext);
    if (exists(p)) fs.rmSync(p);
  }
  fs.copyFileSync(src, path.join(dir, `${base}.png`));
}

if (!exists(androidDir) || !exists(main)) {
  console.error(`Proyek Android tidak ditemukan di ${androidDir}. Jalankan dulu: npx cap add android`);
  process.exit(1);
}
console.log(`Menyesuaikan proyek Android di ${androidDir}${safe ? ' (MODE AMAN: hanya manifest)' : ''}`);

// ---------------------------------------------------------------- 1. manifest
step('AndroidManifest', () => {
  const p = path.join(main, 'AndroidManifest.xml');
  if (!exists(p)) return note(false, 'AndroidManifest.xml', 'berkas tidak ditemukan');
  let s = read(p);
  const applied = [];
  if (!/<activity[\s>]/.test(s)) return note(false, 'AndroidManifest.xml', 'tag <activity> tidak ditemukan');

  if (/android:screenOrientation=/.test(s)) {
    applied.push('orientasi sudah diatur (dibiarkan)');
  } else {
    s = s.replace(/<activity(\s)/, (_, ws) => `<activity android:screenOrientation="sensorLandscape"${ws}`);
    applied.push('landscape');
  }
  if (!safe) {
    if (/android:windowSoftInputMode=/.test(s)) {
      applied.push('mode keyboard sudah diatur (dibiarkan)');
    } else {
      s = s.replace(/<activity(\s)/, (_, ws) => `<activity android:windowSoftInputMode="adjustResize"${ws}`);
      applied.push('keyboard adjustResize');
    }
  }
  if (/android\.permission\.VIBRATE/.test(s)) {
    applied.push('izin getar sudah ada');
  } else if (/<\/manifest>/.test(s)) {
    s = s.replace(/<\/manifest>/, () => '    <uses-permission android:name="android.permission.VIBRATE" />\n</manifest>');
    applied.push('izin getar');
  }
  write(p, s);
  const okOrientation = /android:screenOrientation="[a-zA-Z]*[lL]andscape"/.test(s);
  note(okOrientation, 'AndroidManifest', applied.join(', '));
});

if (!safe) {
  // -------------------------------------------------------------- 2. warna + ikon
  step('warna kustom', () => {
    const dir = path.join(res, 'values');
    fs.mkdirSync(dir, { recursive: true });
    write(
      path.join(dir, 'rf_colors.xml'),
      `<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="rf_icon_bg">#0B3D2A</color>\n    <color name="rf_splash_bg">#061711</color>\n</resources>\n`
    );
    note(true, 'warna kustom (rf_colors.xml)');
  });

  step('ikon aplikasi', () => {
    const srcRes = path.join(assets, 'res');
    if (!exists(srcRes)) return note(false, 'ikon aplikasi', 'mobile/assets/res tidak ada');
    let n = 0;
    for (const d of fs.readdirSync(srcRes, { withFileTypes: true })) {
      if (!d.isDirectory() || !d.name.startsWith('mipmap-')) continue;
      for (const f of fs.readdirSync(path.join(srcRes, d.name))) {
        if (!f.endsWith('.png')) continue;
        putImage(path.join(res, d.name), f.slice(0, -4), path.join(srcRes, d.name, f));
        n++;
      }
    }
    // ikon adaptif (Android 8+): tulis ulang semua ic_launcher(.round).xml agar memakai lapisan kita
    const adaptive =
      `<?xml version="1.0" encoding="utf-8"?>\n` +
      `<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">\n` +
      `    <background android:drawable="@color/rf_icon_bg"/>\n` +
      `    <foreground android:drawable="@mipmap/rf_icon_fg"/>\n` +
      `</adaptive-icon>\n`;
    const existing = walk(res).filter((f) => /[\\/]mipmap-anydpi[^\\/]*[\\/]ic_launcher(_round)?\.xml$/.test(f));
    const targets = new Set(existing);
    if (!existing.some((f) => /ic_launcher\.xml$/.test(f))) targets.add(path.join(res, 'mipmap-anydpi-v26', 'ic_launcher.xml'));
    if (!existing.some((f) => /ic_launcher_round\.xml$/.test(f))) targets.add(path.join(res, 'mipmap-anydpi-v26', 'ic_launcher_round.xml'));
    for (const t of targets) {
      fs.mkdirSync(path.dirname(t), { recursive: true });
      write(t, adaptive);
    }
    note(n > 0, 'ikon aplikasi', `${n} gambar, ${targets.size} berkas ikon adaptif`);
  });

  // -------------------------------------------------------------- 3. splash
  step('gambar splash', () => {
    const src = path.join(assets, 'splash.png');
    if (!exists(src)) return note(false, 'gambar splash', 'mobile/assets/splash.png tidak ada');
    const found = walk(res).filter((f) => /[\\/]drawable[^\\/]*[\\/]splash\.(png|webp|jpg|jpeg)$/.test(f));
    for (const f of found) putImage(path.dirname(f), 'splash', src);
    note(found.length > 0, 'gambar splash gelap', found.length ? `${found.length} berkas diganti` : 'template tidak punya splash.png (dilewati)');
  });

  step('tema splash', () => {
    const p = path.join(res, 'values', 'styles.xml');
    if (!exists(p)) return note(false, 'tema splash', 'styles.xml tidak ada');
    const s = read(p);
    if (/windowSplashScreenBackground/.test(s)) return note(true, 'tema splash', 'sudah diatur (dibiarkan)');
    const gradleText = ['app/build.gradle', 'variables.gradle']
      .map((f) => path.join(androidDir, f))
      .filter(exists)
      .map(read)
      .join('\n');
    const re = /(<style\s+name="AppTheme\.NoActionBarLaunch"\s+parent="Theme\.SplashScreen"\s*>)/;
    if (!/core-splashscreen|coreSplashScreen/i.test(gradleText) || !re.test(s)) {
      return note(false, 'tema splash', 'bentuk template berbeda dari perkiraan; dilewati');
    }
    write(p, s.replace(re, (m) => `${m}\n        <item name="windowSplashScreenBackground">@color/rf_splash_bg</item>`));
    note(true, 'tema splash', 'latar gelap saat membuka di Android 12+');
  });

  // -------------------------------------------------------------- 4. versi
  step('versi aplikasi', () => {
    const p = path.join(androidDir, 'app', 'build.gradle');
    if (!exists(p)) return note(false, 'versi aplikasi', 'app/build.gradle tidak ada');
    let s = read(p);
    const code = process.env.RF_VERSION_CODE;
    const name = process.env.RF_VERSION_NAME || JSON.parse(read(path.join(mobile, 'package.json'))).version;
    const done = [];
    if (code && /^\d+$/.test(code)) {
      const re = /(versionCode\s*=?\s*)\d+/;
      if (re.test(s)) {
        s = s.replace(re, (_, pre) => `${pre}${code}`);
        done.push(`versionCode ${code}`);
      }
    }
    if (name && /^[0-9A-Za-z.+-]+$/.test(name)) {
      const re = /(versionName\s*=?\s*)"[^"]*"/;
      if (re.test(s)) {
        s = s.replace(re, (_, pre) => `${pre}"${name}"`);
        done.push(`versionName ${name}`);
      }
    }
    if (done.length) write(p, s);
    note(done.length > 0, 'versi aplikasi', done.length ? done.join(', ') : 'pola versionCode/versionName tidak ditemukan');
  });
}

const okCount = results.filter(Boolean).length;
console.log(`\nSelesai: ${okCount} penyesuaian terpasang, ${results.length - okCount} dilewati.`);
