'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { Bell, CheckCheck, Zap, CheckSquare, RotateCcw, AlertCircle, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Popover, PopoverContent, PopoverTrigger,
} from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { formatDate } from '@/lib/utils';
import type { NotificationType } from '@/types/database';

const TYPE_ICONS: Partial<Record<NotificationType, React.ReactNode>> = {
  task_assigned:           <CheckSquare className="w-3.5 h-3.5 text-blue-400" />,
  task_submitted_for_review: <CheckSquare className="w-3.5 h-3.5 text-purple-400" />,
  revision_requested:      <RotateCcw className="w-3.5 h-3.5 text-orange-400" />,
  task_approved:           <CheckSquare className="w-3.5 h-3.5 text-green-400" />,
  task_overdue:            <AlertCircle className="w-3.5 h-3.5 text-destructive" />,
  sprint_starting:         <Zap className="w-3.5 h-3.5 text-primary" />,
  sprint_ending:           <Zap className="w-3.5 h-3.5 text-yellow-400" />,
  evaluation_ready:        <Info className="w-3.5 h-3.5 text-primary" />,
  lead_approval_needed:    <AlertCircle className="w-3.5 h-3.5 text-yellow-400" />,
};

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);

  const loadNotifications = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/notifications?limit=20');
      const json = await res.json();
      setNotifications(json.data ?? []);
      setUnreadCount(json.unread_count ?? 0);
    } finally {
      setLoading(false);
    }
  }, []);

  // Poll every 30s for new notifications
  useEffect(() => {
    loadNotifications();
    const interval = setInterval(loadNotifications, 30_000);
    return () => clearInterval(interval);
  }, [loadNotifications]);

  async function markRead(id: string) {
    await fetch(`/api/notifications/${id}`, { method: 'PATCH' });
    setNotifications(prev =>
      prev.map(n => n.id === id ? { ...n, is_read: true } : n)
    );
    setUnreadCount(prev => Math.max(0, prev - 1));
  }

  async function markAllRead() {
    await fetch('/api/notifications', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'mark_all_read' }),
    });
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
    setUnreadCount(0);
  }

  function getLink(n: any): string | null {
    if (n.related_task_id) return `/tasks/${n.related_task_id}`;
    if (n.related_sprint_id) return `/sprints/${n.related_sprint_id}`;
    return null;
  }

  return (
    <Popover open={open} onOpenChange={v => { setOpen(v); if (v) loadNotifications(); }}>
      <PopoverTrigger>
        <Button variant="ghost" size="icon" className="relative h-8 w-8">
          <Bell className="w-4 h-4" />
          {unreadCount > 0 && (
            <span className="absolute top-1 right-1 w-4 h-4 text-[9px] font-bold bg-destructive text-destructive-foreground rounded-full flex items-center justify-center leading-none">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>

      <PopoverContent align="end" className="w-80 p-0">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <p className="text-sm font-semibold">Notifications</p>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs gap-1 text-muted-foreground"
              onClick={markAllRead}
            >
              <CheckCheck className="w-3 h-3" />
              Mark all read
            </Button>
          )}
        </div>

        <ScrollArea className="h-80">
          {loading && notifications.length === 0 ? (
            <div className="py-8 text-center text-xs text-muted-foreground">Loading...</div>
          ) : notifications.length === 0 ? (
            <div className="py-8 text-center text-xs text-muted-foreground">
              <Bell className="w-5 h-5 mx-auto mb-2 opacity-30" />
              No notifications yet
            </div>
          ) : (
            <div className="divide-y">
              {notifications.map(n => {
                const link = getLink(n);
                const icon = TYPE_ICONS[n.type as NotificationType] ?? <Info className="w-3.5 h-3.5 text-muted-foreground" />;

                const content = (
                  <div
                    className={`flex gap-3 px-4 py-3 hover:bg-accent transition-colors cursor-pointer ${!n.is_read ? 'bg-primary/[0.03]' : ''}`}
                    onClick={() => !n.is_read && markRead(n.id)}
                  >
                    <div className="mt-0.5 shrink-0">{icon}</div>
                    <div className="flex-1 min-w-0 space-y-0.5">
                      <div className="flex items-start justify-between gap-1">
                        <p className={`text-xs leading-snug ${!n.is_read ? 'font-semibold' : 'font-medium'}`}>
                          {n.title}
                        </p>
                        {!n.is_read && (
                          <div className="w-1.5 h-1.5 rounded-full bg-primary mt-1 shrink-0" />
                        )}
                      </div>
                      <p className="text-[11px] text-muted-foreground leading-snug line-clamp-2">
                        {n.body}
                      </p>
                      <p className="text-[10px] text-muted-foreground">
                        {formatDate(n.created_at)}
                      </p>
                    </div>
                  </div>
                );

                return link ? (
                  <Link key={n.id} href={link} onClick={() => { setOpen(false); !n.is_read && markRead(n.id); }}>
                    {content}
                  </Link>
                ) : (
                  <div key={n.id}>{content}</div>
                );
              })}
            </div>
          )}
        </ScrollArea>

        {/* Footer */}
        {notifications.length > 0 && (
          <div className="border-t px-4 py-2.5 text-center">
            <Link href="/notifications" onClick={() => setOpen(false)}>
              <span className="text-xs text-primary hover:underline">View all notifications</span>
            </Link>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
