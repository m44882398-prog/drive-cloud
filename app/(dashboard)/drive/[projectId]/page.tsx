import { Button } from '@/components/ui/button';

export default function ProjectDrivePage({ params }: { params: { projectId: string } }) {
  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Drive Explorer</h1>
          <p className="text-sm text-slate-500">Project ID: {params.projectId}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline">Upload</Button>
          <Button>Create Folder</Button>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4">
        <div className="mb-4 flex items-center justify-between">
          <div className="text-sm text-slate-500">/ root / project</div>
          <div className="flex gap-2 text-sm">
            <Button variant="ghost" size="sm">Grid</Button>
            <Button variant="ghost" size="sm">List</Button>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-4">
          {['Brand Assets', 'Q4 Campaign', 'Contracts', 'Team Photos'].map((name, index) => (
            <div key={name} className="rounded-xl border border-slate-200 p-4">
              <div className="mb-3 h-12 w-12 rounded-lg bg-slate-100" />
              <div className="font-medium">{name}</div>
              <div className="mt-2 text-xs text-slate-500">{index + 1} items</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
