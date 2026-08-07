import { useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Bell, CheckCheck } from "lucide-react";

import {
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
  useNotifications,
} from "@/hooks/useNotifications";
import { useOnClickOutside } from "@/hooks/useOnClickOutside";
import { cn } from "@/utils/cn";
import type { AppNotification } from "@/types/notification";
import { getNotificationTypeMeta } from "@/utils/notificationMeta";
import { DropdownPanel } from "./DropdownPanel";

function formatRelativeTime(iso: string): string {
  const diffMin = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (diffMin < 1) return "Just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.round(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  return `${Math.round(diffHr / 24)}d ago`;
}

function NotificationRow({
  notification,
  onRead,
}: {
  notification: AppNotification;
  onRead: (id: string) => void;
}) {
  const meta = getNotificationTypeMeta(notification.type);
  const Icon = meta.icon;

  const inner = (
    <div
      className={cn(
        "flex gap-3 rounded-xl px-3 py-2.5 transition-colors",
        notification.read
          ? "hover:bg-slate-50"
          : "bg-emerald-50/50 hover:bg-emerald-50"
      )}
    >
      <span
        aria-hidden
        className={cn(
          "flex h-9 w-9 shrink-0 items-center justify-center rounded-full",
          meta.iconClassName
        )}
      >
        <Icon className="h-4 w-4" />
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <p className="truncate text-sm font-semibold text-slate-900">
            {notification.title}
          </p>
          {!notification.read && (
            <span
              aria-hidden
              className="mt-1 h-2 w-2 shrink-0 rounded-full bg-rose-500 shadow-sm shadow-rose-400/50"
            />
          )}
        </div>
        <p className="mt-0.5 line-clamp-2 text-xs text-slate-500">
          {notification.message}
        </p>
        <p className="mt-1 text-[11px] font-medium uppercase tracking-wide text-slate-400">
          {formatRelativeTime(notification.createdAt)}
        </p>
      </div>
    </div>
  );

  return (
    <li role="none">
      {notification.href ? (
        <Link
          role="menuitem"
          to={notification.href}
          onClick={() => onRead(notification.id)}
        >
          {inner}
        </Link>
      ) : (
        <button
          role="menuitem"
          type="button"
          className="w-full text-left"
          onClick={() => onRead(notification.id)}
        >
          {inner}
        </button>
      )}
    </li>
  );
}

export function NotificationsDropdown() {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const { data: notifications = [], isLoading } = useNotifications();
  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllNotificationsRead();

  useOnClickOutside(containerRef, () => setOpen(false), open);

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Notifications${unreadCount > 0 ? `, ${unreadCount} unread` : ""}`}
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "relative flex h-10 w-10 items-center justify-center rounded-full text-slate-500 transition-all duration-200",
          "hover:bg-slate-100 hover:text-slate-900",
          open && "bg-slate-100 text-slate-900"
        )}
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span
            aria-hidden
            className="absolute right-1.5 top-1.5 flex h-4 min-w-4 animate-pulse items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white shadow-sm shadow-rose-500/50 motion-reduce:animate-none"
          >
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      <DropdownPanel open={open} label="Notifications" width="w-[380px]">
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
          <div>
            <p className="text-sm font-bold text-slate-900">Notifications</p>
            {unreadCount > 0 && (
              <p className="text-xs text-slate-500">{unreadCount} unread</p>
            )}
          </div>
          {unreadCount > 0 && (
            <button
              type="button"
              onClick={() => markAllRead.mutate()}
              className="flex items-center gap-1 text-xs font-semibold text-emerald-600 transition-colors hover:text-emerald-700"
            >
              <CheckCheck className="h-3.5 w-3.5" />
              Mark all read
            </button>
          )}
        </div>

        <ul className="max-h-[360px] overflow-y-auto p-2">
          {isLoading ? (
            <li className="px-3 py-8 text-center text-sm text-slate-400">
              Loading notifications…
            </li>
          ) : notifications.length === 0 ? (
            <li className="px-3 py-8 text-center">
              <p className="text-sm font-medium text-slate-600">
                You're all caught up
              </p>
              <p className="mt-1 text-xs text-slate-400">
                New bids and tournament updates will show up here.
              </p>
            </li>
          ) : (
            notifications.map((n) => (
              <NotificationRow
                key={n.id}
                notification={n}
                onRead={(id) => {
                  markRead.mutate(id);
                  setOpen(false);
                }}
              />
            ))
          )}
        </ul>

        <div className="border-t border-slate-100 px-4 py-2.5">
          <Link
            to="/notifications"
            onClick={() => setOpen(false)}
            className="block text-center text-xs font-semibold text-slate-500 transition-colors hover:text-slate-900"
          >
            View all notifications
          </Link>
        </div>
      </DropdownPanel>
    </div>
  );
}