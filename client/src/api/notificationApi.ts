import { axiosClient } from "@/api/axiosClient";
import type { ApiEnvelope } from "@/types/auth";
import type { AppNotification } from "@/types/notification";

export const notificationApi = {
  list: async (): Promise<AppNotification[]> => {
    const { data } = await axiosClient.get<ApiEnvelope<AppNotification[]>>(
      "/notifications"
    );
    return data.data;
  },

  markAsRead: async (id: string): Promise<void> => {
    await axiosClient.patch<ApiEnvelope<null>>(`/notifications/${id}/read`);
  },

  markAllAsRead: async (): Promise<void> => {
    await axiosClient.patch<ApiEnvelope<null>>("/notifications/read-all");
  },
};