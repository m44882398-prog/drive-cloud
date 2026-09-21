import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function TrashPage() {
  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Trash</h1>
          <p className="text-sm text-slate-500">File yang dihapus dan bisa dipulihkan.</p>
        </div>
        <Button variant="outline">Empty Trash</Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Deleted Items</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {['Old Presentation.pdf', 'Budget 2024.xlsx', 'Draft Design.fig'].map((item) => (
              <div key={item} className="flex items-center justify-between rounded-xl border border-slate-200 p-3">
                <span className="font-medium">{item}</span>
                <div className="flex gap-2">
                  <Button variant="secondary" size="sm">Restore</Button>
                  <Button variant="destructive" size="sm">Delete</Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
