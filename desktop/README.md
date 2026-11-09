# Cloud Drive Desktop

## Windows prerequisites

- Windows 10/11 x64
- WinFsp installed
- A configured rclone remote that can access the Supabase bucket `drive-files`
- rclone installed and available on `PATH` (or select `rclone.exe` in Settings)

The Settings window mounts the preconfigured rclone remote's `drive-files` directory (for example `supabase:drive-files`) with WinFsp. Configure the remote with `rclone config` before mounting. The desktop client stores its drive letter, remote name, VFS cache mode, symbolic-link setting, auto-mount preference, and rclone executable path using `electron-store`. `rclone.exe` may be available on `PATH` or selected from Settings. stdout and stderr are written to the app's `rclone.log`, which is also viewable in Settings.

The Settings page and system tray control the preconfigured rclone remote. Enable **Mount otomatis saat aplikasi dimulai** to mount the drive whenever the desktop app starts. The installer uses NSIS and update metadata is published to GitHub Releases.

## Build and publish

```powershell
pnpm --dir desktop install
pnpm --dir desktop build
```

To publish releases, configure the GitHub repository and `GH_TOKEN`, then build the installer. To upload the generated installer to the BASE Supabase Storage `installers` bucket, set `NEXT_PUBLIC_BASE_SUPABASE_URL` and `BASE_SUPABASE_SERVICE_ROLE_KEY` in the environment and run:

```powershell
pnpm --dir desktop upload:installer
```

Create the `installers` bucket before uploading. Keep the service-role key out of source control.
