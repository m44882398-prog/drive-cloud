import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function ProjectsPage() {
  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Projects</h1>
          <p className="text-sm text-slate-500">Kelola project dan storage Anda.</p>
        </div>
        <Button>Create Project</Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {['Design Assets', 'Marketing', 'Operations', 'Client Files'].map((name, index) => (
          <Card key={name}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className={`h-3 w-3 rounded-full ${['bg-blue-500', 'bg-violet-500', 'bg-emerald-500', 'bg-amber-500'][index]}`} />
                <span className="rounded bg-slate-100 px-2 py-1 text-xs">{index + 1} project</span>
              </div>
              <CardTitle>{name}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 text-sm text-slate-600">
                <div>Storage: 1.2 GB</div>
                <div>Files: 184</div>
                <div>Updated: Today</div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
