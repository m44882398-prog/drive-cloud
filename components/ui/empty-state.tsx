import { FolderOpen, Inbox } from 'lucide-react';
import { cn } from '@/lib/utils';

export function EmptyState({
  title,
  description,
  action,
  icon = 'inbox',
  className,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  icon?: 'inbox' | 'folder';
  className?: string;
}) {
  const Icon = icon === 'folder' ? FolderOpen : Inbox;

  return (
    <div className={cn('flex min-h-[220px] flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center', className)}>
      <div className="mb-4 rounded-full bg-slate-200 p-3 text-slate-600">
        <Icon className="h-6 w-6" />
      </div>
      <h3 className="text-lg font-semibold text-slate-800">{title}</h3>
      {description ? <p className="mt-2 max-w-md text-sm text-slate-500">{description}</p> : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}
