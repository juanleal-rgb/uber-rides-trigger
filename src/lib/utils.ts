import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatPhone(phone: string): string {
  const cleaned = phone.replace(/\D/g, "");
  if (cleaned.length === 10) {
    return "(" + cleaned.slice(0, 3) + ") " + cleaned.slice(3, 6) + "-" + cleaned.slice(6);
  }
  if (cleaned.length === 11 && cleaned.startsWith("1")) {
    return "+1 (" + cleaned.slice(1, 4) + ") " + cleaned.slice(4, 7) + "-" + cleaned.slice(7);
  }
  return phone;
}

export function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return mins + ":" + secs.toString().padStart(2, "0");
}

export function formatRelativeTime(date: Date): string {
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diffInSeconds < 60) return "just now";
  if (diffInSeconds < 3600) return Math.floor(diffInSeconds / 60) + "m ago";
  if (diffInSeconds < 86400) return Math.floor(diffInSeconds / 3600) + "h ago";
  return Math.floor(diffInSeconds / 86400) + "d ago";
}
