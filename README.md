# ChatApp V9 Online Ready

Versi ini memakai Express + WebSocket + JSON file sehingga lebih mudah dideploy tanpa `better-sqlite3`.

## Jalankan
npm install
npm start

Lalu buka URL server di Chrome Android.

## Deploy online
Upload seluruh folder ini ke layanan hosting Node.js yang menyediakan HTTPS dan persistent disk/file storage. Set environment `PORT` jika diminta.

## Fitur
- register/login
- private chat
- real-time WebSocket
- edit/delete/reaction API
- group API
- PWA-ready
- database JSON sederhana

## Catatan produksi
JSON file bukan database produksi untuk skala besar. Untuk penggunaan serius, pindahkan data ke PostgreSQL/Supabase, gunakan Argon2/bcrypt, secure session, HTTPS, rate limiting, validasi upload, backup, dan object storage.
