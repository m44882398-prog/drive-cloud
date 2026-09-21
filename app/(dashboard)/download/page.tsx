import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function DownloadPage() {
  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold">Download Desktop Client</h1>
        <p className="text-slate-500">Unduh installer Windows untuk mount virtual drive di File Explorer.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Cloud Drive Windows Installer</CardTitle>
          <CardDescription>Versi terbaru tersedia untuk Windows 10/11.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 p-4">
            <div>
              <div className="font-semibold">cloud-drive-setup.exe</div>
              <div className="text-sm text-slate-500">Version 1.0.0 - 128 MB</div>
            </div>
            <Button>Download Installer</Button>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <div className="rounded-xl border p-4">
              <div className="text-sm text-slate-500">System Requirements</div>
              <ul className="mt-2 list-disc space-y-2 pl-5 text-sm">
                <li>Windows 10/11</li>
                <li>4 GB RAM</li>
                <li>500 MB free space</li>
              </ul>
            </div>
            <div className="rounded-xl border p-4">
              <div className="text-sm text-slate-500">Install Steps</div>
              <ol className="mt-2 list-decimal space-y-2 pl-5 text-sm">
                <li>Download installer</li>
                <li>Run as Administrator</li>
                <li>Login dengan akun Anda</li>
              </ol>
            </div>
            <div className="rounded-xl border p-4">
              <div className="text-sm text-slate-500">Version History</div>
              <ul className="mt-2 list-disc space-y-2 pl-5 text-sm">
                <li>v1.0.0 Initial Release</li>
                <li>Sync optimization</li>
                <li>Tray fix</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
