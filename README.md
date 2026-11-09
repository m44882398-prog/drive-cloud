# Cloud Drive Windows dengan Supabase

Project monorepo untuk aplikasi web Next.js dan client desktop Electron untuk cloud drive Windows. Project ini dirancang untuk deploy ke Vercel, dengan data dan autentikasi dikelola di Supabase.

## Struktur

- app/ : aplikasi Next.js App Router
- components/ : komponen UI dan fitur drive
- lib/ : helper Supabase, util, dan konfigurasi
- hooks/ : hooks custom React
- stores/ : state management Zustand
- desktop/ : aplikasi Electron desktop client
- supabase/migrations/ : SQL migration schema

## Quick Start

1. Install dependencies:
   ```bash
   pnpm install
   ```

2. Salin env:
   ```bash
   cp .env.example .env.local
   ```

3. Isi nilai Supabase.

4. Buat user secara manual di Supabase Dashboard (lihat panduan di bawah).

5. Jalankan web app:
   ```bash
   pnpm dev
   ```

5. Jalankan desktop client:
   ```bash
   pnpm desktop:dev
   ```

## Deploy ke Vercel

1. Push repo ke GitHub
2. Import repo ke Vercel
3. Set environment variables:
   - NEXT_PUBLIC_BASE_SUPABASE_URL
   - NEXT_PUBLIC_BASE_SUPABASE_ANON_KEY
   - BASE_SUPABASE_SERVICE_ROLE_KEY
   - NEXT_PUBLIC_APP_URL
4. Deploy otomatis

## Catatan

- Desktop client hanya untuk Windows dan menggunakan virtual drive via Dokan/WinFsp.
- Installer .exe built via electron-builder dan diupload ke Supabase Storage bucket `installers`.
- Aplikasi web bersifat production-ready boilerplate dengan komentar dalam Bahasa Indonesia.

## Akses Private dan User Manual

DB pada environment hanya menyimpan konfigurasi dasar, autentikasi, kategori, setting, dan daftar koneksi. Data project, folder, dan file disimpan di DB cloud yang dipilih dari tabel `databases`.

Aplikasi ini hanya menyediakan login email/password. Pendaftaran mandiri dan login Google
tidak tersedia. User harus dibuat manual oleh admin di Supabase:

1. Buka Supabase -> `Authentication` -> `Users`.
2. Klik `Add User` -> `Create New User`.
3. Isi email dan password.
4. Aktifkan `Auto Confirm User` agar user tidak perlu verifikasi email.
5. Klik `Create`.

Setelah itu, user dapat masuk melalui halaman `/login`. Untuk menutup pendaftaran mandiri,
buka `Authentication` -> `Providers` -> `Email`, lalu matikan `Enable Sign Ups`.
