export type NotificationType =
  | "SYSTEM"
  | "REGISTRATION_UPDATE"
  | "TEAM_UPDATE"
  | "AUCTION_UPDATE"
  | "BID_UPDATE";

export interface AppNotification {
    id: string;

    type: NotificationType;

    priority: "LOW" | "NORMAL" | "HIGH";

    title: string;

    message: string;

    data: Record<string, unknown>;

    read: boolean;

    readAt?: string;

    createdAt: string;

    updatedAt: string;

    href?: string;
}