import { create } from 'zustand';
import type { UserNotification } from '@/types';

interface NotificationState {
  unreadCount: number;
  notifications: UserNotification[];
  setNotifications: (notifications: UserNotification[]) => void;
  markAsRead: (id: string) => void;
  incrementUnread: () => void;
  setUnreadCount: (count: number) => void;
}

export const useNotificationStore = create<NotificationState>()((set) => ({
  unreadCount: 0,
  notifications: [],

  setNotifications: (notifications) =>
    set({
      notifications,
      unreadCount: notifications.filter((n) => !n.is_read).length,
    }),

  markAsRead: (id) =>
    set((state) => {
      const updated = state.notifications.map((n) =>
        n.id === id ? { ...n, is_read: true, read_at: new Date().toISOString() } : n
      );
      return {
        notifications: updated,
        unreadCount: updated.filter((n) => !n.is_read).length,
      };
    }),

  incrementUnread: () =>
    set((state) => ({ unreadCount: state.unreadCount + 1 })),

  setUnreadCount: (count) =>
    set({ unreadCount: count }),
}));
