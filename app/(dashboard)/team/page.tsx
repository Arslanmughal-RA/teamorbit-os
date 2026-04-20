import { getCurrentUser } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { Users } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { ROLE_LABELS } from '@/lib/constants';
import type { UserRole } from '@/types/database';

async function getUsers() {
  const res = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/users`, { cache: 'no-store' });
  const json = await res.json();
  return json.data ?? [];
}

const ROLE_ORDER: UserRole[] = [
  'studio_lead', 'producer', 'developer', 'game_designer',
  'post_production_artist', 'creative_artist', 'ua_manager', 'aso_specialist',
];

export default async function TeamPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  if (!['studio_lead', 'producer'].includes(user.role)) redirect('/dashboard');

  const users = await getUsers();
  const sorted = [...users].sort((a: any, b: any) =>
    ROLE_ORDER.indexOf(a.role) - ROLE_ORDER.indexOf(b.role)
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Team</h1>
        <p className="text-muted-foreground text-sm mt-1">
          {users.length} active team members
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {sorted.map((member: any) => {
          const initials = member.full_name
            .split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase();

          return (
            <Card key={member.id} className="hover:border-primary/40 transition-colors">
              <CardContent className="pt-5 pb-4">
                <div className="flex flex-col items-center text-center gap-3">
                  <Avatar className="h-14 w-14">
                    <AvatarFallback className="text-base font-bold">{initials}</AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-semibold text-sm leading-tight">{member.full_name}</p>
                    <Badge variant="secondary" className="mt-1.5 text-xs font-medium">
                      {ROLE_LABELS[member.role as UserRole]}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">{member.email}</p>
                  <Link href={`/team/${member.id}`} className="w-full">
                    <Button variant="outline" size="sm" className="w-full text-xs">
                      View Profile
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          );
        })}

        {users.length === 0 && (
          <div className="col-span-4 text-center py-16 text-muted-foreground">
            <Users className="w-8 h-8 mx-auto mb-3 opacity-40" />
            <p className="text-sm">No team members found.</p>
          </div>
        )}
      </div>
    </div>
  );
}
