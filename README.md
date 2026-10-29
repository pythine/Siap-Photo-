# 📸 Photobooth LDR (HTML + CSS + JavaScript)

Photobooth online untuk pasangan jarak jauh. Video live berdua, pilih background, ambil foto strip dengan hitung mundur, lalu download hasilnya. **Tanpa server sendiri**: hanya 3 file statis, gratis di-host.

## Fitur

- Video + suara live antar dua orang (WebRTC lewat PeerJS)
- Room dengan kode / link undangan (maksimal 2 orang)
- **Ganti background**: asli, blur, 6 preset (sunset, pastel, malam, hati, polkadot, pantai), atau **upload foto sendiri**. Pilihan ikut berlaku untuk pasangan.
- Foto 1 / 3 / 4 pose, countdown 3-2-1 + flash, tersinkron di dua layar
- **Download foto** sebagai PNG, dengan warna frame dan caption yang bisa diubah
- Tombol mic dan kamera on/off

## File

```
photobooth-ldr/
├── index.html   # tampilan
├── style.css    # gaya
└── app.js       # video, background, countdown, strip foto
```

## Cara menjalankan

### A. Coba di komputer sendiri

Kamera browser hanya jalan di `localhost` atau HTTPS, jadi jangan buka dengan klik dua kali file `index.html`. Jalankan server lokal sederhana di folder ini:

```bash
# jika punya Python
python -m http.server 8000
# atau jika punya Node.js
npx serve .
```

Buka **http://localhost:8000**. Untuk mencoba sendiri, buka dua tab: tab pertama "Buat Room Baru", tab kedua masukkan kode room lalu "Gabung".

### B. Online gratis dengan GitHub Pages (supaya bisa dipakai berdua)

1. Buat akun di https://github.com, lalu klik **New repository** (nama bebas, misalnya `photobooth-ldr`, pilih **Public**).
2. Upload ketiga file (`index.html`, `style.css`, `app.js`) dan `README.md` ke repository, lewat **Add file → Upload files**. Pastikan file ada di root, bukan di subfolder.
3. Buka **Settings → Pages**. Di bagian *Build and deployment*, pilih **Deploy from a branch**, branch **main**, folder **/ (root)**, lalu **Save**.
4. Tunggu 1-2 menit. Alamatnya akan muncul, bentuknya `https://USERNAME.github.io/photobooth-ldr/`.
5. Buka alamat itu, dan HTTPS-nya sudah otomatis.

Alternatif lain yang juga gratis: Netlify (drag & drop folder di app.netlify.com/drop), Vercel, atau Cloudflare Pages.

## Cara memakai berdua

1. Orang pertama membuka web dan isi nama. Di kotak **Kode room kamu**, klik **📤 Kirim ke pasangan** (atau **🔗 Salin link**) dan kirim lewat WhatsApp **sebelum** membuat room.
2. Setelah link terkirim, kembali ke halaman dan klik **Buat Room dengan Kode Ini**. Izinkan kamera dan mikrofon, lalu tunggu pasangan masuk. Jangan tutup halaman ini.
3. Pasangan membuka link, isi nama, klik **Gabung**. Setelah tersambung, video keduanya muncul berdampingan.
4. Pilih **Background** di panel kanan, atau **Upload background sendiri**. Pilihan otomatis ikut ke pasangan.
5. Pilih jumlah foto, klik **📷 Ambil Foto**. Countdown muncul di dua layar.
6. Setelah selesai, hasil muncul. Atur **warna frame** dan **caption**, lalu klik **⬇️ Download PNG**. Klik **Ulangi** jika ingin foto ulang.

## Pemecahan masalah

| Masalah | Solusi |
|---|---|
| Kamera tidak menyala | Pakai `localhost` atau HTTPS, dan izinkan kamera di browser |
| "Tidak bisa menghubungi server PeerJS" | Internet bermasalah, atau server publik PeerJS sedang gangguan. Coba lagi beberapa saat |
| "Tidak bisa tersambung ke room" / video pasangan tidak muncul | Penyebab tersering: jaringan (kartu seluler, WiFi kantor/kampus) memblokir koneksi langsung. Solusi: pasang server **TURN** (lihat bagian di bawah). Cek juga: pasangan harus masih membuka halaman room, dan sementara coba pindah WiFi ↔ data seluler |
| Tombol background abu-abu | Model AI dimuat dari internet (`cdn.jsdelivr.net`). Cek koneksi lalu muat ulang |
| Video patah-patah | Pilih background **Asli**, tutup aplikasi berat lain, dan biarkan tab tetap terbuka di depan |
| Suara berdengung | Pakai headset / earphone |
| "Room sudah penuh" | Satu room hanya untuk 2 orang. Buat room baru |
| Kode room "sedang dipakai" | Gunakan Buat Room Baru untuk mendapat kode lain |

## Mengatasi "Tidak bisa tersambung" (TURN)

Aplikasi sudah mencoba server TURN cadangan otomatis, tapi tidak dijamin aktif. Cara yang andal dan gratis:

1. Daftar akun gratis di https://www.metered.ca/tools/openrelay/ (gratis 20 GB TURN per bulan).
2. Di dashboard Metered, buat aplikasi (misalnya nama `photobooth`) dan salin **API key**-nya.
3. Buka `app.js`, isi dua baris di bagian atas:
   ```js
   const METERED_APP = 'photobooth';      // nama aplikasi kamu
   const METERED_KEY = 'API_KEY_KAMU';
   ```
4. Upload ulang file ke hosting. Kedua orang cukup memuat ulang halaman.

Catatan: API key ini akan terlihat di kode web. Itu wajar untuk proyek kecil, tapi jangan bagikan link situsmu ke banyak orang.

## Kustomisasi

- **Background baru**: tambah fungsi di objek `PRESETS` dan daftar `BG_LIST` pada `app.js`.
- **Ukuran video**: ubah `W` dan `H` di bagian atas `app.js`.
- **Warna tema**: ubah variabel `:root` di `style.css`.
- **Layout strip foto**: ubah `pad`, `cw`, `ch` di fungsi `renderResult()`.

## Catatan

- Video dan suara dikirim langsung antar browser (peer-to-peer). Foto dibuat dan disimpan hanya di browser kalian.
- Server publik PeerJS hanya dipakai untuk mempertemukan kalian di awal, dan tidak dijamin selalu aktif.
