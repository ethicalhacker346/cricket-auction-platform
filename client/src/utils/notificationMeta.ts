import {
  Bell,
  ClipboardCheck,
  Gavel,
  Info,
  TrendingUp,
  Users,
  type LucideIcon,
} from "lucide-react";
import type { NotificationType } from "@/types/notification";

export interface NotificationTypeMeta {
  icon: LucideIcon;
  iconClassName: string;
  label: string;
}

/**
 * Single source of truth for how each NotificationType is presented.
 * Keys must match the NotificationType union exactly — previously the
 * dropdown had its own copy with lowercase/mismatched keys, so every
 * notification silently fell back to the default Bell icon.
 */
export const NOTIFICATION_TYPE_META: Record<
  NotificationType,
  NotificationTypeMeta
> = {
  SYSTEM: {
    icon: Info,
    iconClassName: "bg-slate-100 text-slate-600",
    label: "System",
  },
  REGISTRATION_UPDATE: {
    icon: ClipboardCheck,
    iconClassName: "bg-violet-50 text-violet-600",
    label: "Registration",
  },
  TEAM_UPDATE: {
    icon: Users,
    iconClassName: "bg-sky-50 text-sky-600",
    label: "Team",
  },
  AUCTION_UPDATE: {
    icon: Gavel,
    iconClassName: "bg-amber-50 text-amber-600",
    label: "Auction",
  },
  BID_UPDATE: {
    icon: TrendingUp,
    iconClassName: "bg-emerald-50 text-emerald-600",
    label: "Bid",
  },
};

export const DEFAULT_NOTIFICATION_TYPE_META: NotificationTypeMeta = {
  icon: Bell,
  iconClassName: "bg-slate-100 text-slate-600",
  label: "Notification",
};

export function getNotificationTypeMeta(
  type: NotificationType
): NotificationTypeMeta {
  return NOTIFICATION_TYPE_META[type] ?? DEFAULT_NOTIFICATION_TYPE_META;
}