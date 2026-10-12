# Panduan Kompilasi & Build APK Android: Pocketly

Proyek Android untuk Pocketly telah berhasil disiapkan menggunakan arsitektur **Capacitor (Ionic)**. Seluruh kode aplikasi web (HTML, CSS, JavaScript, Firebase, audio haptics, multi-language, dan PDF engine) telah di-bundle ke dalam folder native Android (`android/`).

---

## 📱 Keunggulan Setup Android Ini
1. **Performa Tinggi:** Mendukung hardware acceleration (`hardwareAccelerated="true"`), rendering 60/120 FPS mulus.
2. **Ikon & Splash Screen Resmi:** Menggunakan logo Pocketly (`logo-new.png`) untuk launcher icon (adaptive & round) serta splash screen pembuka.
3. **Izin Lengkap:** Izin kamera (scan struk/OCR Tesseract), penyimpanan (upload bukti transfer & download laporan PDF), getaran (haptics), dan autentikasi biometrik sudah terpasang di `AndroidManifest.xml`.
4. **Android Native Bridge (`capacitor-bridge.js`):**
   - Mendukung tombol Back fisik/gesture Android (menutup modal atau kembali ke halaman sebelumnya secara natural).
   - Status bar otomatis disesuaikan dengan tema aplikasi.
   - Haptics motor terhubung langsung ke hardware getaran ponsel.

---

## 🛠️ Cara Build APK Menggunakan Android Studio (Mudah & Cepat)

Jika Anda sudah menginstal **Android Studio** di komputer Anda, ikuti langkah berikut:

### Langkah 1: Buka Proyek di Android Studio
Bisa dilakukan dengan 2 cara:
- **Cara A (Lewat Terminal):**
  Jalankan perintah berikut di PowerShell / Terminal:
  ```bash
  npm run cap:open
  ```
- **Cara B (Buka Manual dari Android Studio):**
  1. Buka aplikasi **Android Studio**.
  2. Pilih menu **Open** (atau **File > Open**).
  3. Arahkan ke folder: `d:\Code\Pocketly Web\android` lalu klik **OK**.
  4. Tunggu beberapa saat hingga Android Studio selesai melakukan **Gradle Sync** (biasanya 1 - 3 menit saat pertama kali dibuka).

---

### Langkah 2: Build File .APK
1. Di bilah menu atas Android Studio, klik:
   **Build** > **Build Bundle(s) / APK(s)** > **Build APK(s)**.
2. Tunggu proses kompilasi hingga muncul notifikasi balon di pojok kanan bawah:
   `APK(s) generated successfully for 1 module: 'app'.`
3. Klik link biru bertuliskan **locate** pada notifikasi tersebut.

Lokasi file APK hasil build berada di:
```text
d:\Code\Pocketly Web\android\app\build\outputs\apk\debug\app-debug.apk
```

---

## 📲 Cara Memasang APK di HP Android

1. Salin file `app-debug.apk` ke HP Android Anda (melalui kabel USB, WhatsApp Web, Google Drive, atau kirim ke diri sendiri lewat Telegram).
2. Di HP Android, buka file `app-debug.apk`.
3. Jika muncul peringatan *"Install unknown apps"* atau *"Sumber tidak dikenal"*, pilih **Izinkan (Allow from this source)**.
4. Klik **Install**, lalu aplikasi Pocketly siap digunakan!

---

## 🔄 Cara Memperbarui APK Jika Ada Perubahan Kode Web

Jika di kemudian hari Anda mengedit tampilan atau fitur di `index.html`, `style.css`, atau `script.js`:
1. Jalankan perintah sinkronisasi otomatis:
   ```bash
   npm run cap:sync
   ```
   *Perintah ini akan menyalin file web terbaru ke proyek Android secara otomatis dalam hitungan detik.*
2. Buka kembali Android Studio dan klik **Build > Build APK(s)**.
