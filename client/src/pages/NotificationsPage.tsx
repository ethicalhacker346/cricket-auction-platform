import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  AlertTriangle,
  Bell,
  Check,
  CheckCheck,
  Inbox,
  Loader2,
  Search,
  SearchX,
} from "lucide-react";

import {
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
  useNotifications,
} from "@/hooks/useNotifications";
import { cn } from "@/utils/cn";
import type { AppNotification, NotificationType } from "@/types/notification";
import {
  NOTIFICATION_TYPE_META,
  getNotificationTypeMeta,
} from "@/utils/notificationMeta";

type FilterKey = "all" | "unread" | NotificationType;

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: "all", label: "All" },
  { key: "unread", label: "Unread" },
  ...(Object.entries(NOTIFICATION_TYPE_META) as [NotificationType, (typeof NOTIFICATION_TYPE_META)[NotificationType]][]).map(
    ([key, meta]) => ({ key, label: meta.label })
  ),
];

const DATE_GROUP_ORDER = ["Today", "Yesterday", "This week", "This month", "Earlier"] as const;

function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function getDateGroup(iso: string): (typeof DATE_GROUP_ORDER)[number] {
  const day = startOfDay(new Date(iso));
  const today = startOfDay(new Date());
  const diffDays = Math.round((today.getTime() - day.getTime()) / 86_400_000);

  if (diffDays <= 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return "This week";
  if (diffDays < 30) return "This month";
  return "Earlier";
}

function formatRelativeTime(iso: string): string {
  const diffMin = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
  if (diffMin < 1) return "Just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.round(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.round(diffHr / 24);
  if (diffDay < 7) return `${diffDay}d ago`;
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: diffDay > 365 ? "numeric" : undefined,
  });
}

function CardSkeleton() {
  return (
    <div className="flex gap-3 rounded-2xl border border-slate-100 p-3.5 sm:gap-4 sm:p-4">
      <div className="h-10 w-10 shrink-0 animate-pulse rounded-full bg-slate-100 motion-reduce:animate-none sm:h-11 sm:w-11" />
      <div className="flex-1 space-y-2 py-0.5">
        <div className="h-3.5 w-2/5 animate-pulse rounded bg-slate-100 motion-reduce:animate-none" />
        <div className="h-3 w-4/5 animate-pulse rounded bg-slate-100 motion-reduce:animate-none" />
        <div className="h-2.5 w-1/5 animate-pulse rounded bg-slate-100 motion-reduce:animate-none" />
      </div>
    </div>
  );
}

function EmptyState({
  icon: Icon,
  title,
  subtitle,
  action,
}: {
  icon: typeof Bell;
  title: string;
  subtitle: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 px-6 py-16 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-50 text-slate-400">
        <Icon className="h-5 w-5" />
      </span>
      <p className="mt-4 text-sm font-semibold text-slate-700">{title}</p>
      <p className="mt-1 max-w-xs text-sm text-slate-400">{subtitle}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

function NotificationCard({
  notification,
  onOpen,
  onMarkRead,
}: {
  notification: AppNotification;
  onOpen: (id: string) => void;
  onMarkRead: (id: string) => void;
}) {
  const meta = getNotificationTypeMeta(notification.type);
  const Icon = meta.icon;
  const isUnread = !notification.read;

  const body = (
    <>
      <span
        aria-hidden
        className={cn(
          "flex h-10 w-10 shrink-0 items-center justify-center rounded-full sm:h-11 sm:w-11",
          meta.iconClassName
        )}
      >
        <Icon className="h-4.5 w-4.5 sm:h-5 sm:w-5" />
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-3">
          <p
            className={cn(
              "text-[13.5px] leading-snug sm:text-[15px]",
              isUnread ? "font-semibold text-slate-900" : "font-medium text-slate-700"
            )}
          >
            {notification.title}
          </p>
          {notification.priority === "HIGH" && (
            <span className="hidden shrink-0 items-center rounded-full bg-rose-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-rose-600 sm:inline-flex">
              High
            </span>
          )}
        </div>

        <p className="mt-1 text-[13px] leading-relaxed text-slate-500 sm:text-sm">
          {notification.message}
        </p>

        <div className="mt-2 flex items-center gap-2 text-xs font-medium text-slate-400">
          <span title={new Date(notification.createdAt).toLocaleString()}>
            {formatRelativeTime(notification.createdAt)}
          </span>
          <span aria-hidden className="text-slate-300">
            &middot;
          </span>
          <span>{meta.label}</span>
        </div>
      </div>
    </>
  );

  const sharedClasses = "flex flex-1 min-w-0 gap-3 text-left sm:gap-4";

  return (
    <li className="group relative">
      <div
        className={cn(
          "relative flex items-stretch gap-1 overflow-hidden rounded-2xl border p-3.5 transition-colors duration-200 sm:p-4",
          isUnread
            ? "border-emerald-100 bg-emerald-50/40 hover:border-emerald-200 hover:bg-emerald-50/70"
            : "border-slate-100 bg-white hover:border-slate-200 hover:bg-slate-50"
        )}
      >
        {isUnread && (
          <span aria-hidden className="absolute inset-y-3 left-0 w-1 rounded-full bg-emerald-500" />
        )}

        {notification.href ? (
          <Link
            to={notification.href}
            onClick={() => onOpen(notification.id)}
            className={sharedClasses}
          >
            {body}
          </Link>
        ) : (
          <button type="button" onClick={() => onOpen(notification.id)} className={sharedClasses}>
            {body}
          </button>
        )}

        {isUnread && (
          <button
            type="button"
            aria-label="Mark as read"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onMarkRead(notification.id);
            }}
            className="ml-1 flex h-7 w-7 shrink-0 items-center justify-center self-start rounded-full text-slate-300 opacity-0 transition-all duration-150 hover:bg-emerald-100 hover:text-emerald-700 focus-visible:opacity-100 group-hover:opacity-100 sm:mt-0.5"
          >
            <Check className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    </li>
  );
}

export function NotificationsPage() {
  const [filter, setFilter] = useState<FilterKey>("all");
  const [query, setQuery] = useState("");

  const { data: notifications = [], isLoading, isFetching, isError, refetch } = useNotifications();
  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllNotificationsRead();

  const unreadCount = notifications.filter((n) => !n.read).length;

  const filtered = useMemo(() => {
    let list = notifications;
    if (filter === "unread") {
      list = list.filter((n) => !n.read);
    } else if (filter !== "all") {
      list = list.filter((n) => n.type === filter);
    }
    if (query.trim()) {
      const q = query.trim().toLowerCase();
      list = list.filter(
        (n) => n.title.toLowerCase().includes(q) || n.message.toLowerCase().includes(q)
      );
    }
    return [...list].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }, [notifications, filter, query]);

  const groups = useMemo(() => {
    const byGroup = new Map<string, AppNotification[]>();
    for (const n of filtered) {
      const g = getDateGroup(n.createdAt);
      if (!byGroup.has(g)) byGroup.set(g, []);
      byGroup.get(g)!.push(n);
    }
    return DATE_GROUP_ORDER.filter((g) => byGroup.has(g)).map((g) => ({
      label: g,
      items: byGroup.get(g)!,
    }));
  }, [filtered]);

  const activeFilterLabel = FILTERS.find((f) => f.key === filter)?.label ?? "All";

  return (
    <div className="min-h-screen bg-slate-50/60">
      <div className="mx-auto w-full max-w-3xl px-0.5 py-1 sm:px- sm:py-0.5 lg:px-8">
        {/* Header */}
        <div className="sticky top-0 z-10 -mx-4 bg-slate-50/60 px-4 pb-4 pt-1 backdrop-blur-sm sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <h1 className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">
                Notifications
              </h1>
              {isFetching && !isLoading && (
                <Loader2 aria-hidden className="h-4 w-4 animate-spin text-slate-300" />
              )}
            </div>

            {unreadCount > 0 && (
              <button
                type="button"
                onClick={() => markAllRead.mutate()}
                disabled={markAllRead.isPending}
                className="flex shrink-0 items-center gap-1.5 rounded-full border border-emerald-200 bg-white px-3 py-1.5 text-xs font-semibold text-emerald-700 transition-colors hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-60 sm:text-sm"
              >
                <CheckCheck className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                <span className="hidden xs:inline">Mark all read</span>
                <span className="xs:hidden">All read</span>
              </button>
            )}
          </div>

          {unreadCount > 0 && (
            <p className="mt-0.5 text-sm text-slate-500">
              {unreadCount} unread notification{unreadCount === 1 ? "" : "s"}
            </p>
          )}

          {/* Search */}
          <div className="relative mt-4">
            <Search
              aria-hidden
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
            />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search notifications"
              className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-9 pr-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-100"
            />
          </div>

          {/* Filters */}
          <div className="-mx-4 mt-3 flex gap-2 overflow-x-auto px-4 pb-1 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
            {FILTERS.map((f) => {
              const isActive = f.key === filter;
              return (
                <button
                  key={f.key}
                  type="button"
                  onClick={() => setFilter(f.key)}
                  aria-pressed={isActive}
                  className={cn(
                    "shrink-0 whitespace-nowrap rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-colors sm:text-sm",
                    isActive
                      ? "border-slate-900 bg-slate-900 text-white"
                      : "border-slate-200 bg-white text-slate-500 hover:border-slate-300 hover:text-slate-900"
                  )}
                >
                  {f.label}
                  {f.key === "unread" && unreadCount > 0 && (
                    <span className={cn("ml-1.5", isActive ? "text-emerald-300" : "text-emerald-600")}>
                      {unreadCount}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Body */}
        <div className="mt-2">
          {isError ? (
            <EmptyState
              icon={AlertTriangle}
              title="Couldn't load notifications"
              subtitle="Something went wrong on our end. Check your connection and try again."
              action={
                <button
                  type="button"
                  onClick={() => refetch()}
                  className="rounded-full bg-slate-900 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-slate-800"
                >
                  Try again
                </button>
              }
            />
          ) : isLoading ? (
            <ul className="space-y-2.5" aria-label="Loading notifications">
              {Array.from({ length: 6 }).map((_, i) => (
                <li key={i}>
                  <CardSkeleton />
                </li>
              ))}
            </ul>
          ) : notifications.length === 0 ? (
            <EmptyState
              icon={Inbox}
              title="You're all caught up"
              subtitle="New bids, auction updates, and team activity will show up here."
            />
          ) : query.trim() && filtered.length === 0 ? (
            <EmptyState
              icon={SearchX}
              title={`No matches for "${query.trim()}"`}
              subtitle="Try a different search term or clear it to see everything."
              action={
                <button
                  type="button"
                  onClick={() => setQuery("")}
                  className="rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-600 transition-colors hover:border-slate-300 hover:text-slate-900"
                >
                  Clear search
                </button>
              }
            />
          ) : filtered.length === 0 ? (
            <EmptyState
              icon={filter === "unread" ? CheckCheck : Bell}
              title={
                filter === "unread"
                  ? "No unread notifications"
                  : `No ${activeFilterLabel.toLowerCase()} notifications yet`
              }
              subtitle={
                filter === "unread"
                  ? "You've read everything — nice work."
                  : "Check back later, or switch filters to see other activity."
              }
            />
          ) : (
            <div className="space-y-6">
              {groups.map((group) => (
                <section key={group.label}>
                  <h2 className="mb-2 px-1 text-xs font-bold uppercase tracking-wider text-slate-400">
                    {group.label}
                  </h2>
                  <ul className="space-y-2.5">
                    {group.items.map((n) => (
                      <NotificationCard
                        key={n.id}
                        notification={n}
                        onOpen={(id) => markRead.mutate(id)}
                        onMarkRead={(id) => markRead.mutate(id)}
                      />
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default NotificationsPage;