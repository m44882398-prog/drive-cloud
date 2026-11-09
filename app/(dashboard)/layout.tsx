import Link from 'next/link';
import { Button } from '@/components/ui/button';

const navigation = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/projects', label: 'Projects' },
  { href: '/databases', label: 'Databases' },
  { href: '/drive', label: 'Drive' },
  { href: '/trash', label: 'Trash' },
  { href: '/activity', label: 'Activity' },
  { href: '/settings', label: 'Settings' },
  { href: '/download', label: 'Download' },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <aside className="fixed inset-y-0 left-0 w-64 border-r border-slate-200 bg-white">
        <div className="flex h-16 items-center border-b border-slate-200 px-6 text-xl font-bold">Cloud Drive</div>
        <nav className="space-y-2 p-4">
          {navigation.map((item) => (
            <Link key={item.href} href={item.href} className="block rounded-lg px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100">
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="absolute bottom-4 left-4 right-4">
          <Button variant="outline" className="w-full">
            Logout
          </Button>
        </div>
      </aside>

      <main className="ml-64 min-h-screen">{children}</main>
    </div>
  );
}
