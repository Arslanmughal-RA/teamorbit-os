import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/supabase/server';
import { CronPanel } from '@/components/dashboard/cron-panel';

export default async function SettingsPage() {
  const user = await getCurrentUser();
  if (!user || user.role !== 'studio_lead') redirect('/dashboard');

  return (
    <div className="space-y-8 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground text-sm mt-1">Studio-level configuration and admin tools</p>
      </div>

      <CronPanel />
    </div>
  );
}
