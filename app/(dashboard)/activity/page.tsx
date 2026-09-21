import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export default function ActivityPage() {
  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Activity</h1>
          <p className="text-sm text-slate-500">Log semua aktivitas file dan project.</p>
        </div>
        <Button>Export CSV</Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent Logs</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[
              ['Uploaded', 'pitch-deck.pdf', 'Today, 09:30'],
              ['Renamed', 'Brand Guide', 'Today, 08:15'],
              ['Shared', 'presentation.pptx', 'Yesterday, 18:40'],
            ].map(([action, item, time]) => (
              <div key={`${action}-${item}`} className="flex items-center justify-between rounded-xl border border-slate-200 p-3">
                <div>
                  <div className="font-medium">{action}</div>
                  <div className="text-sm text-slate-500">{item}</div>
                </div>
                <span className="text-xs text-slate-400">{time}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
