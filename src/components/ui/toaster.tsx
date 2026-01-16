"use client";

import { useEffect, useCallback } from "react";
import { useUIStore } from "@/stores/ui-store";
import { cn } from "@/lib/utils";
import { X, CheckCircle, AlertCircle, AlertTriangle, Info } from "lucide-react";

const TOAST_DURATION = 5000; // 5 seconds auto-dismiss

const iconMap = {
  info: Info,
  success: CheckCircle,
  warning: AlertTriangle,
  error: AlertCircle,
};

const colorMap = {
  info: {
    bg: "bg-accent-info/10",
    border: "border-accent-info/50",
    icon: "text-accent-info",
  },
  success: {
    bg: "bg-accent-success/10",
    border: "border-accent-success/50",
    icon: "text-accent-success",
  },
  warning: {
    bg: "bg-accent-warning/10",
    border: "border-accent-warning/50",
    icon: "text-accent-warning",
  },
  error: {
    bg: "bg-accent-danger/10",
    border: "border-accent-danger/50",
    icon: "text-accent-danger",
  },
};

interface ToastProps {
  id: string;
  type: "info" | "success" | "warning" | "error";
  title: string;
  message?: string;
  onDismiss: (id: string) => void;
}

function Toast({ id, type, title, message, onDismiss }: ToastProps) {
  const Icon = iconMap[type];
  const colors = colorMap[type];

  // Auto-dismiss after duration
  useEffect(() => {
    const timer = setTimeout(() => {
      onDismiss(id);
    }, TOAST_DURATION);

    return () => clearTimeout(timer);
  }, [id, onDismiss]);

  return (
    <div
      className={cn(
        "flex items-center gap-2 rounded-md px-3 py-2",
        "animate-in slide-in-from-right-full duration-300",
        "bg-transparent"
      )}
      role="alert"
    >
      <Icon className={cn("h-4 w-4 shrink-0", colors.icon)} />
      <p className="text-[13px] text-fg-primary">{title}</p>
      {message && <p className="text-[12px] text-fg-muted">— {message}</p>}
      <button
        onClick={() => onDismiss(id)}
        className="ml-1 shrink-0 text-fg-disabled transition-colors hover:text-fg-muted"
        aria-label="Dismiss"
      >
        <X className="h-3 w-3" />
      </button>
    </div>
  );
}

export function Toaster() {
  const { notifications, removeNotification } = useUIStore();

  const handleDismiss = useCallback(
    (id: string) => {
      removeNotification(id);
    },
    [removeNotification]
  );

  // Only show the 5 most recent notifications
  const visibleNotifications = notifications.slice(-5);

  if (visibleNotifications.length === 0) {
    return null;
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 flex max-w-sm flex-col gap-2">
      {visibleNotifications.map((notification) => (
        <Toast
          key={notification.id}
          id={notification.id}
          type={notification.type}
          title={notification.title}
          message={notification.message}
          onDismiss={handleDismiss}
        />
      ))}
    </div>
  );
}

// Helper hook for easy toast creation
export function useToast() {
  const { addNotification } = useUIStore();

  return {
    toast: (options: {
      type: "info" | "success" | "warning" | "error";
      title: string;
      message?: string;
    }) => {
      addNotification(options);
    },
    success: (title: string, message?: string) => {
      addNotification({ type: "success", title, message });
    },
    error: (title: string, message?: string) => {
      addNotification({ type: "error", title, message });
    },
    warning: (title: string, message?: string) => {
      addNotification({ type: "warning", title, message });
    },
    info: (title: string, message?: string) => {
      addNotification({ type: "info", title, message });
    },
  };
}
