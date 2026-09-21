import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';

export default function SettingsPage() {
  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-3xl font-bold">Settings</h1>
        <p className="text-sm text-slate-500">Atur profil, storage, dan perangkat Anda.</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Profile</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="mb-2 block text-sm text-slate-600">Full Name</label>
              <Input defaultValue="John Doe" />
            </div>
            <div>
              <label className="mb-2 block text-sm text-slate-600">Email</label>
              <Input defaultValue="john@example.com" />
            </div>
            <Button>Save Changes</Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Device Management</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {['Windows Laptop', 'Office PC'].map((item) => (
              <div key={item} className="flex items-center justify-between rounded-xl border border-slate-200 p-3">
                <span>{item}</span>
                <Button variant="outline" size="sm">Remove</Button>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Danger Zone</CardTitle>
        </CardHeader>
        <CardContent>
          <Button variant="destructive">Delete Account</Button>
        </CardContent>
      </Card>
    </div>
  );
}
