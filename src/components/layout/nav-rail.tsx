"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import Image from "next/image";
import { cn } from "@/lib/utils";

// Navigation items - Trigger and Llamadas only
const navItems = [
  { href: "/trigger", label: "Onboarding", icon: "phone" },
  { href: "/llamadas", label: "Historial", icon: "list" },
];

const adminNavItems = [{ href: "/usuarios", label: "Usuarios", icon: "users" }];

const bottomItems = [
  { href: "#", label: "Cerrar Sesion", icon: "logout", action: "logout" },
];

// Simple SVG icons
function Icon({ name, className }: { name: string; className?: string }) {
  const icons: Record<string, JSX.Element> = {
    phone: (
      <svg
        className={className}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
      >
        <path
          d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    ),
    list: (
      <svg
        className={className}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
      >
        <line
          x1="8"
          y1="6"
          x2="21"
          y2="6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <line
          x1="8"
          y1="12"
          x2="21"
          y2="12"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <line
          x1="8"
          y1="18"
          x2="21"
          y2="18"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <line
          x1="3"
          y1="6"
          x2="3.01"
          y2="6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <line
          x1="3"
          y1="12"
          x2="3.01"
          y2="12"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <line
          x1="3"
          y1="18"
          x2="3.01"
          y2="18"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    ),
    logout: (
      <svg
        className={className}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
      >
        <path
          d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <polyline
          points="16,17 21,12 16,7"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <line
          x1="21"
          y1="12"
          x2="9"
          y2="12"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    ),
    users: (
      <svg
        className={className}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
      >
        <path
          d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle
          cx="9"
          cy="7"
          r="4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M23 21v-2a4 4 0 0 0-3-3.87"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M16 3.13a4 4 0 0 1 0 7.75"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    ),
  };

  return icons[name] || null;
}

export function NavRail() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const isAdmin = session?.user?.role === "admin";

  const handleLogout = () => {
    signOut({ callbackUrl: "/login" });
  };

  // Combine nav items based on role
  const allNavItems = isAdmin ? [...navItems, ...adminNavItems] : navItems;

  return (
    <nav className="flex h-screen w-nav-rail flex-col border-r border-border-subtle bg-bg-surface">
      {/* Logo */}
      <div className="flex h-14 items-center justify-center border-b border-border-subtle">
        <Image
          src="/happyrobot/Footer-logo-white.svg"
          alt="HappyRobot"
          width={28}
          height={22}
          className="opacity-70 transition-opacity hover:opacity-100"
        />
      </div>

      {/* Main navigation */}
      <div className="flex flex-1 flex-col gap-1 p-2">
        {allNavItems.map((item) => {
          const isActive =
            pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "group relative flex h-10 w-10 items-center justify-center rounded-md transition-all duration-300",
                isActive
                  ? "bg-bg-active text-fg-primary"
                  : "hover-gradient-subtle text-fg-secondary hover:text-fg-primary",
              )}
              title={item.label}
            >
              {/* Active indicator */}
              {isActive && (
                <span className="absolute left-0 h-5 w-0.5 rounded-r bg-accent-primary" />
              )}
              <Icon name={item.icon} className="relative z-10 h-5 w-5" />

              {/* Tooltip */}
              <span className="absolute left-full ml-2 hidden rounded bg-bg-elevated px-2 py-1 text-caption text-fg-primary shadow-lg group-hover:block">
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>

      {/* Bottom navigation */}
      <div className="flex flex-col gap-1 border-t border-border-subtle p-2">
        {bottomItems.map((item) => (
          <button
            key={item.label}
            onClick={item.action === "logout" ? handleLogout : undefined}
            className="group relative flex h-10 w-10 items-center justify-center rounded-md text-fg-secondary transition-all duration-300 hover-gradient-subtle hover:text-fg-primary"
            title={item.label}
          >
            <Icon name={item.icon} className="relative z-10 h-5 w-5" />

            {/* Tooltip */}
            <span className="absolute left-full ml-2 hidden rounded bg-bg-elevated px-2 py-1 text-caption text-fg-primary shadow-lg group-hover:block">
              {item.label}
            </span>
          </button>
        ))}

        {/* User avatar */}
        <div className="group relative flex h-10 w-10 items-center justify-center">
          <div className="relative">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-bg-hover text-fg-secondary">
              <span className="text-caption font-medium">U</span>
            </div>
            <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-bg-surface bg-accent-success" />
          </div>

          {/* Tooltip */}
          <span className="absolute left-full ml-2 hidden rounded bg-bg-elevated px-2 py-1 text-caption text-fg-primary shadow-lg group-hover:block">
            Usuario Uber
          </span>
        </div>
      </div>
    </nav>
  );
}
