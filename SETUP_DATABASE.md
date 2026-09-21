# Setup Database Supabase untuk Cloud Drive

Dokumen ini berisi panduan lengkap setup database, storage, authentication, dan environment variables untuk project Cloud Drive di Supabase.

> Catatan: Dokumen ini ditulis dalam Bahasa Indonesia agar memudahkan implementasi step-by-step.

---

## 1. Prerequisites

Sebelum memulai, pastikan hal-hal berikut sudah tersedia:

- Akun Supabase aktif di https://supabase.com
- Project Supabase sudah dibuat
- Akses ke:
  - SQL Editor
  - Table Editor
  - Authentication
  - Storage
  - Settings > API Keys
- Project lokal sudah siap dengan file `.env.local`

### Persiapan minimum

1. Buat project baru di Supabase.
2. Catat nama project Anda.
3. Pastikan project sudah aktif dan statusnya `Running`.
4. Siapkan akses ke SQL Editor untuk menjalankan migration.

---

## 2. Cara Ambil API Keys

### 2.1 Ambil Project URL

1. Buka dashboard Supabase Anda.
2. Masuk ke project yang sudah dibuat.
3. Pilih menu `Project Settings`.
4. Buka submenu `API`.
5. Cari field `Project URL`.
6. Copy nilai URL seperti contoh:

```text
https://your-project.supabase.co
```

Gunakan nilai ini untuk variable:

```env
NEXT_PUBLIC_BASE_SUPABASE_URL=https://base-project.supabase.co
```

### 2.2 Ambil Anon Public Key

1. Masuk ke `Project Settings` > `API`.
2. Cari field `anon public` key.
3. Copy value-nya.

Contoh:

```text
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

Gunakan untuk:

```env
NEXT_PUBLIC_BASE_SUPABASE_ANON_KEY=your-base-anon-key
```

### 2.3 Ambil Service Role Key

1. Masuk ke `Project Settings` > `API`.
2. Cari field `service_role` key.
3. Copy value-nya.

Gunakan untuk:

```env
BASE_SUPABASE_SERVICE_ROLE_KEY=your-base-service-role-key
```

> Peringatan: service_role key bersifat sangat sensitif. Jangan di-commit ke Git publik, jangan disimpan di client-side, dan jangan pernah dipakai di frontend.

### 2.4 Perbedaan anon key vs service_role key

| Key | Fungsi | Aman dipakai di browser? | Keterangan |
| --- | --- | --- | --- |
| `anon key` | Untuk public access dan client-side auth | Ya | Cocok dipakai di frontend, tetapi tetap dibatasi oleh RLS |
| `service_role key` | Full admin access ke database dan storage | Tidak | Dipakai di server-side / backend / admin scripts |

Ringkasnya:

- `anon key` = untuk user / frontend
- `service_role key` = untuk server / backend / admin

---

## 3. Apply Migrations

Pada project ini, migration sudah disediakan di folder:

- `supabase/migrations/001_initial_schema.sql`
- `supabase/migrations/002_rls_policies.sql`
- `supabase/migrations/003_functions.sql`

### 3.1 Buka SQL Editor di Supabase

1. Login ke dashboard Supabase.
2. Pilih project Anda.
3. Buka menu `SQL Editor`.
4. Klik `New query`.

### 3.2 Urutan apply migrations

Lakukan urutan berikut:

1. `001_initial_schema.sql`
2. `002_rls_policies.sql`
3. `003_functions.sql`

### 3.3 Copy-paste dan run

Buka file migration satu per satu lalu copy isi file ke SQL Editor, lalu klik `Run`.

#### Contoh

```sql
create extension if not exists "uuid-ossp";
create extension if not exists pgcrypto;
```

Setelah query dijalankan, Supabase akan membuat schema yang dibutuhkan.

### 3.4 Verifikasi tables berhasil dibuat

Setelah semua migration berhasil dipanggil, cek di `Table Editor`.

Pastikan table berikut ada:

- `projects`
- `folders`
- `files`
- `shared_links`
- `devices`
- `activity_logs`
- `app_releases`

Anda juga bisa cek lewat SQL:

```sql
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;
```

Jika berhasil, Anda akan melihat daftar table cloud drive.

---

## 4. Buat Storage Buckets

Storage digunakan untuk file user dan installer desktop client.

### 4.1 Bucket yang dibutuhkan

Buat 3 bucket berikut:

1. `drive-files`
2. `thumbnails`
3. `installers`

### 4.2 Cara membuat bucket

1. Buka menu `Storage` di Supabase.
2. Klik `Create a new bucket`.
3. Masukkan nama bucket.
4. Pilih `public` untuk setiap bucket.
5. Simpan.

### 4.3 Set bucket jadi public

Untuk masing-masing bucket:

1. Klik bucket yang akan diubah
2. Buka settings bucket
3. Aktifkan opsi `Public bucket`
4. Simpan perubahan

### 4.4 File size limit

Untuk bucket `drive-files`, atur limit sesuai kebutuhan:

- Max file size: `5GB`

Anda dapat menyesuaikan limit storage di pengaturan bucket atau konfigurasi terkait.

### 4.5 Struktur path yang disarankan

```text
{user_id}/{project_id}/{file_id}/{filename}
```

Contoh:

```text
4fbd3d11-.../a1b2c3-.../9d1f9d-.../presentation.pdf
```

Untuk thumbnail:

```text
{user_id}/{project_id}/{file_id}/thumb.jpg
```

Untuk installer:

```text
desktop/{version}/cloud-drive-setup.exe
```

---

## 5. Setup Authentication

### 5.1 Enable Email/Password untuk Login Private

1. Masuk ke `Authentication`.
2. Pilih tab `Providers`.
3. Aktifkan `Email` provider.
4. Matikan `Enable Sign Ups` agar tidak ada pendaftaran mandiri.
5. Simpan perubahan.

### 5.2 Buat User Manual di Supabase

User untuk project private dibuat langsung oleh admin:

1. Buka Supabase -> `Authentication` -> `Users`.
2. Klik `Add User` -> `Create New User`.
3. Isi email dan password.
4. Aktifkan `Auto Confirm User` agar tidak perlu verifikasi email.
5. Klik `Create`.

User tersebut sekarang dapat login melalui halaman `/login` menggunakan email dan password.

### 5.3 Configure email templates (opsional)

Di Supabase, Anda dapat mengatur:

- Email confirmation template
- Reset password template
- Magic link template

Untuk project ini, reset password dan login sudah dipersiapkan.

---

## 6. Setup Environment Variables

Buat file `.env.local` di root project dan isi seperti berikut:

```env
NEXT_PUBLIC_BASE_SUPABASE_URL=https://base-project.supabase.co
NEXT_PUBLIC_BASE_SUPABASE_ANON_KEY=your-base-anon-key
BASE_SUPABASE_SERVICE_ROLE_KEY=your-base-service-role-key
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_SITE_NAME=Cloud Drive
SUPABASE_STORAGE_URL=https://your-project.supabase.co/storage/v1
```

### Penjelasan setiap variable

| Variable | Fungsi |
| --- | --- |
| `NEXT_PUBLIC_BASE_SUPABASE_URL` | URL DB data dasar untuk auth dan konfigurasi |
| `NEXT_PUBLIC_BASE_SUPABASE_ANON_KEY` | Key publik DB data dasar |
| `BASE_SUPABASE_SERVICE_ROLE_KEY` | Key admin DB data dasar, hanya server-side |
| `NEXT_PUBLIC_APP_URL` | URL aplikasi lokal atau Vercel |
| `NEXT_PUBLIC_SITE_NAME` | Nama aplikasi yang ditampilkan di UI |
| `SUPABASE_STORAGE_URL` | Base URL untuk storage Supabase |

> Untuk production, variabel ini juga harus di-set di Vercel dashboard.

---

## 7. Verifikasi Setup

### 7.1 Cara test koneksi

Buka SQL Editor dan jalankan query sederhana:

```sql
SELECT 1;
```

Jika query berhasil, koneksi SQL sudah aktif.

### 7.2 Cara test login

1. Jalankan aplikasi lokal.
2. Pastikan user sudah dibuat manual melalui `Authentication` > `Users`.
3. Uji login di halaman `/login`.
4. Pastikan user yang tidak terdaftar tidak dapat masuk.

### 7.3 Cara test upload file

1. Login ke app.
2. Buat project baru.
3. Masuk ke file explorer.
4. Upload file melalui UI.
5. Cek apakah file muncul di Supabase Storage bucket `drive-files`.

### 7.4 Cara test storage bucket

Buka `Storage` > pilih bucket `drive-files`.

Pastikan file yang diupload muncul di list.

### 7.5 Query SQL untuk mengecek data

```sql
SELECT * FROM projects;
SELECT * FROM files;
SELECT * FROM activity_logs;
```

Jika data tampil, berarti setup database dan aplikasi sudah berjalan dengan baik.

---

## 8. Troubleshooting

### 8.1 Error RLS policy

Masalah umum:

- `permission denied for table ...`
- `new row violates row-level security policy`

Solusi:

1. Cek apakah policy sudah benar di file `002_rls_policies.sql`.
2. Pastikan user sudah login / session valid.
3. Cek `auth.uid()` pada policy.
4. Pastikan `user_id` di data sama dengan user login.

### 8.2 Error storage bucket not found

Solusi:

1. Cek apakah bucket `drive-files`, `thumbnails`, dan `installers` sudah dibuat.
2. Pastikan nama bucket sesuai dengan kode project.
3. Pastikan bucket status public jika diperlukan.

### 8.3 Error auth callback

Masalah umum:

- redirect callback tidak valid
- Pastikan login menggunakan email/password user yang dibuat admin

Solusi:

1. Pastikan `NEXT_PUBLIC_APP_URL` benar.
2. Cek redirect URI di Google Console / Supabase.
3. Cek callback URL di Authentication provider.

### 8.4 Error CORS

Biasanya terjadi saat memanggil storage atau API dari domain yang tidak diizinkan.

Solusi:

1. Pastikan domain lokal atau Vercel sudah terdaftar di CORS config.
2. Cek `NEXT_PUBLIC_APP_URL`.
3. Pastikan project URL benar.

### 8.5 Cara cek logs di Supabase

1. Buka `Logs` atau `Dashboard` di Supabase.
2. Cek request log dari API.
3. Cek storage logs.
4. Cek auth logs jika login gagal.

---

## 9. Backup & Maintenance

### 9.1 Cara backup database

Supabase menyediakan backup otomatis untuk project berbayar. Untuk backup manual:

1. Buka `Database` > `Backups`
2. Pilih opsi backup sekarang jika tersedia
3. Simpan export SQL atau dump database

Untuk export SQL manual:

```sql
COPY (SELECT * FROM projects) TO '/tmp/projects.csv' WITH CSV HEADER;
```

atau gunakan tool psql / pg_dump jika tersedia.

### 9.2 Cara monitor storage usage

1. Buka dashboard Supabase.
2. Cek `Storage` usage panel.
3. Lihat size bucket `drive-files` / `thumbnails` / `installers`.

### 9.3 Cara cleanup trash

Project ini memiliki function `cleanup_trash()` untuk menghapus file yang sudah dihapus > 30 hari.

Contoh SQL manual untuk menjalankan cleanup:

```sql
SELECT public.cleanup_trash();
```

Anda juga bisa mengaktifkan cron schedule / scheduled task jika diizinkan di Supabase.

---

## 10. Screenshot Placeholder

Berikut placeholder area yang bisa Anda isi saat dokumentasi final dibuat:

### Screenshot 1: Supabase Dashboard

```text
[Placeholder: Screenshot Dashboard Supabase]
```

### Screenshot 2: SQL Editor

```text
[Placeholder: Screenshot SQL Editor dengan query migration]
```

### Screenshot 3: Storage Bucket

```text
[Placeholder: Screenshot Storage bucket drive-files]
```

### Screenshot 4: Authentication Settings

```text
[Placeholder: Screenshot Authentication > Providers]
```

---

## 11. Ringkasan Setup Sukses

Setelah semua tahapan selesai, maka project Cloud Drive Anda akan siap untuk:

- Login user yang dibuat manual oleh admin
- Create project
- Upload file ke Supabase Storage
- Akses file dari browser
- Download desktop client installer
- Sinkronisasi data ke Windows desktop client

---

## 12. Checklist Akhir

- [ ] Project Supabase dibuat
- [ ] API keys sudah diambil
- [ ] Migration 001, 002, 003 sudah dijalankan
- [ ] Table berhasil terbuat
- [ ] Bucket drive-files, thumbnails, installers dibuat
- [ ] Bucket public enabled
- [ ] Email auth enabled
- [ ] `Enable Sign Ups` dimatikan di provider Email
- [ ] User dibuat manual dan `Auto Confirm User` diaktifkan
- [ ] .env.local dibuat
- [ ] Aplikasi local bisa login
- [ ] Upload file berhasil
- [ ] Storage bucket terisi
- [ ] deploy ke Vercel siap

Jika semua checklist sudah selesai, project Anda siap dipakai untuk tahap berikutnya: UI web aplikasi, upload logic, dan desktop client sync.
