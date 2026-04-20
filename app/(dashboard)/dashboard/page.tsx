import { getCurrentUser } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { StudioDashboard } from '@/components/dashboard/studio-dashboard';
import { PersonalDashboard } from '@/components/dashboard/personal-dashboard';

export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  const isManager = ['studio_lead', 'producer'].includes(user.role);

  return isManager
    ? <StudioDashboard user={user} />
    : <PersonalDashboard user={user} />;
}
