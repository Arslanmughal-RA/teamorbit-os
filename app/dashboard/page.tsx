import { getCurrentUser } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';

export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold">Welcome, {user.full_name}</h1>
      <p className="text-muted-foreground mt-1">Role: {user.role}</p>
      <p className="text-muted-foreground mt-4 text-sm">Dashboard — Phase 3 coming next.</p>
    </div>
  );
}
