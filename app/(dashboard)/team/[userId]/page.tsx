import { getCurrentUser } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Mail, Layers, CalendarDays, CheckSquare } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { ROLE_LABELS } from '@/lib/constants';
import { formatDate } from '@/lib/utils';
import type { UserRole } from '@/types/database';

async function getUserProfile(id: string) {
  const res = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/users/${id}`, { cache: 'no-store' });
  const json = await res.json();
  return json.data;
}

export default async function UserProfilePage({ params }: { params: { userId: string } }) {
  const currentUser = await getCurrentUser();
  if (!currentUser) redirect('/login');

  // Only studio_lead and producer can view all profiles; others can only view their own
  const canViewAll = ['studio_lead', 'producer'].includes(currentUser.role);
  if (!canViewAll && currentUser.id !== params.userId) redirect('/dashboard');

  const profile = await getUserProfile(params.userId);
  if (!profile) redirect('/team');

  const initials = profile.full_name
    .split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/team">
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <ArrowLeft className="w-4 h-4" />
          </Button>
        </Link>
        <h1 className="text-2xl font-bold tracking-tight">Employee Profile</h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Profile card */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col items-center text-center gap-3">
              <Avatar className="h-20 w-20">
                <AvatarFallback className="text-xl font-bold">{initials}</AvatarFallback>
              </Avatar>
              <div>
                <h2 className="text-lg font-bold">{profile.full_name}</h2>
                <Badge variant="secondary" className="mt-1">
                  {ROLE_LABELS[profile.role as UserRole]}
                </Badge>
              </div>
              <div className="w-full space-y-2 text-sm pt-2 border-t">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Mail className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate text-xs">{profile.email}</span>
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <CalendarDays className="w-3.5 h-3.5 shrink-0" />
                  <span className="text-xs">Joined {formatDate(profile.created_at)}</span>
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <CheckSquare className="w-3.5 h-3.5 shrink-0" />
                  <span className="text-xs">{profile.active_task_count} active tasks</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Pods */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Layers className="w-4 h-4 text-primary" />
              Pod Assignments
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {profile.pods?.length > 0 ? (
              profile.pods.map((pod: any) => (
                <Link key={pod.id} href={`/pods/${pod.id}`}>
                  <div className="flex items-center justify-between p-2 rounded-lg hover:bg-accent transition-colors">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-primary" />
                      <span className="text-sm font-medium">{pod.name}</span>
                    </div>
                    {pod.is_studio_wide && (
                      <Badge variant="outline" className="text-xs">Studio-Wide</Badge>
                    )}
                  </div>
                </Link>
              ))
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">Not assigned to any pod</p>
            )}
          </CardContent>
        </Card>

        {/* Performance placeholder */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Performance Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-center py-6 text-muted-foreground">
              <p className="text-sm">Metrics available after Phase 11</p>
              <p className="text-xs mt-1">Evaluations are generated at sprint completion</p>
              <Link href="/evaluations" className="mt-3 inline-block">
                <Button variant="outline" size="sm">View Evaluations</Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
