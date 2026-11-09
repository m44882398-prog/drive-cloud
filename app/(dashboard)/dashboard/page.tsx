import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

const projects = [
  { name: 'Design Assets', value: '2.4 GB', color: 'bg-blue-500' },
  { name: 'Marketing', value: '1.1 GB', color: 'bg-violet-500' },
  { name: 'Client Files', value: '840 MB', color: 'bg-emerald-500' },
];

const activities = [
  { action: 'Upload file', item: 'pitch-deck.pdf', time: '15 minutes ago' },
  { action: 'Shared link', item: 'Brand Guide', time: '1 hour ago' },
  { action: 'Create folder', item: 'Campaign Q4', time: 'Yesterday' },
];

export default function DashboardPage() {
  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Dashboard</h1>
          <p className="text-sm text-slate-500">Ringkasan aktivitas cloud drive Anda.</p>
        </div>
        <Link href="/download">
          <Button>Download Desktop Client</Button>
        </Link>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {projects.map((project) => (
          <Card key={project.name}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className={`h-3 w-3 rounded-full ${project.color}`} />
                <span className="text-xs text-slate-500">Active</span>
              </div>
              <CardTitle>{project.name}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{project.value}</div>
              <p className="mt-2 text-sm text-slate-500">Storage used</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Storage Overview</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64 rounded-lg bg-slate-100 p-4">
              <div className="flex h-full items-end gap-3">
                {[42, 58, 72, 86, 68, 92, 76].map((height, index) => (
                  <div key={index} className="flex-1 rounded-t-lg bg-gradient-to-t from-blue-500 to-cyan-400" style={{ height: `${height}%` }} />
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {activities.map((item) => (
                <div key={`${item.action}-${item.item}`} className="flex items-center justify-between rounded-lg border border-slate-200 p-3">
                  <div>
                    <div className="font-medium">{item.action}</div>
                    <div className="text-sm text-slate-500">{item.item}</div>
                  </div>
                  <span className="text-xs text-slate-400">{item.time}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
