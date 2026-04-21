'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Users,
  Zap,
  CheckSquare,
  ClipboardList,
  BarChart2,
  Settings,
  Layers,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { User, UserRole } from '@/types/database';

interface NavItem {
  label: string;
  href: string;
  icon: React.ElementType;
  roles: UserRole[] | 'all';
}

const NAV_ITEMS: NavItem[] = [
  {
    label: 'Dashboard',
    href: '/dashboard',
    icon: LayoutDashboard,
    roles: 'all',
  },
  {
    label: 'Sprints',
    href: '/sprints',
    icon: Zap,
    roles: ['studio_lead', 'producer'],
  },
  {
    label: 'My Tasks',
    href: '/tasks',
    icon: CheckSquare,
    roles: 'all',
  },
  {
    label: 'Approvals',
    href: '/approvals',
    icon: ClipboardList,
    roles: ['studio_lead', 'producer', 'ua_manager', 'aso_specialist'],
  },
  {
    label: 'Pods',
    href: '/pods',
    icon: Layers,
    roles: 'all',
  },
  {
    label: 'Team',
    href: '/team',
    icon: Users,
    roles: ['studio_lead', 'producer'],
  },
  {
    label: 'Evaluations',
    href: '/evaluations',
    icon: BarChart2,
    roles: 'all',
  },
  {
    label: 'Settings',
    href: '/settings',
    icon: Settings,
    roles: ['studio_lead'],
  },
];

export function Sidebar({ user }: { user: User }) {
  const pathname = usePathname();

  const visibleItems = NAV_ITEMS.filter((item) =>
    item.roles === 'all' || item.roles.includes(user.role)
  );

  return (
    <aside className="w-60 shrink-0 border-r bg-card flex flex-col h-full">
      {/* Logo */}
      <div className="h-14 flex items-center px-4 border-b shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center">
            TO
          </div>
          <span className="font-semibold text-sm">TeamOrbit OS</span>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5">
        {visibleItems.map((item) => {
          const Icon = item.icon;
          const isActive =
            item.href === '/dashboard'
              ? pathname === '/dashboard'
              : pathname.startsWith(item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors',
                isActive
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
              )}
            >
              <Icon className="w-4 h-4 shrink-0" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* User footer */}
      <div className="border-t px-3 py-3 shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center text-xs font-semibold shrink-0">
            {user.full_name.charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium truncate">{user.full_name}</p>
            <p className="text-xs text-muted-foreground capitalize truncate">
              {user.role.replace(/_/g, ' ')}
            </p>
          </div>
        </div>
      </div>
    </aside>
  );
}
