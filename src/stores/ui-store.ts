import { create } from "zustand";

interface UIState {
  // Theme
  theme: "dark" | "light";
  toggleTheme: () => void;

  // User status (for director availability)
  userStatus: "available" | "busy" | "away";
  setUserStatus: (status: "available" | "busy" | "away") => void;

  // Active call (when a call is transferred to the director)
  activeCallId: string | null;
  setActiveCall: (callId: string | null) => void;

  // Modals
  activeModal: string | null;
  modalData: Record<string, unknown> | null;
  openModal: (modalId: string, data?: Record<string, unknown>) => void;
  closeModal: () => void;

  // Notifications
  notifications: Notification[];
  addNotification: (notification: Omit<Notification, "id" | "timestamp">) => void;
  removeNotification: (id: string) => void;
  clearNotifications: () => void;
}

interface Notification {
  id: string;
  type: "info" | "success" | "warning" | "error";
  title: string;
  message?: string;
  timestamp: Date;
}

export const useUIStore = create<UIState>((set) => ({
  // Theme
  theme: "dark",
  toggleTheme: () =>
    set((state) => ({
      theme: state.theme === "dark" ? "light" : "dark",
    })),

  // User status
  userStatus: "available",
  setUserStatus: (status) => set({ userStatus: status }),

  // Active call
  activeCallId: null,
  setActiveCall: (callId) => set({ activeCallId: callId }),

  // Modals
  activeModal: null,
  modalData: null,
  openModal: (modalId, data) => set({ activeModal: modalId, modalData: data ?? null }),
  closeModal: () => set({ activeModal: null, modalData: null }),

  // Notifications
  notifications: [],
  addNotification: (notification) =>
    set((state) => ({
      notifications: [
        ...state.notifications,
        {
          ...notification,
          id: crypto.randomUUID(),
          timestamp: new Date(),
        },
      ],
    })),
  removeNotification: (id) =>
    set((state) => ({
      notifications: state.notifications.filter((n) => n.id !== id),
    })),
  clearNotifications: () => set({ notifications: [] }),
}));
