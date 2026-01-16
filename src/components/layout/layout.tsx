"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import { cn } from "@/lib/utils";
import gsap from "gsap";
import {
  Phone,
  List,
  ChevronRight,
  LogOut,
  type LucideIcon,
  Sun,
  Moon,
  Users,
  Menu,
  X,
} from "lucide-react";
import { useTheme } from "@/components/theme-provider";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/toaster";

// Sidebar dimensions
const SIDEBAR_COLLAPSED = 72;
const SIDEBAR_EXPANDED = 180;

// Navigation items - Only Trigger and Llamadas
const navItems: {
  href: string;
  icon: LucideIcon;
  label: string;
}[] = [
  { href: "/trigger", icon: Phone, label: "Onboarding" },
  { href: "/llamadas", icon: List, label: "Historial" },
];

const adminNavItems: {
  href: string;
  icon: LucideIcon;
  label: string;
}[] = [{ href: "/usuarios", icon: Users, label: "Usuarios" }];

export function Layout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { data: session } = useSession();
  const { theme, setTheme } = useTheme();
  const [isHovered, setIsHovered] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

  // Get user initials from session
  const userName = session?.user?.name || "Usuario";
  const userInitials = userName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .substring(0, 2)
    .toUpperCase();

  // Check if user is admin
  const isAdmin = session?.user?.role === "admin";
  const allNavItems = isAdmin ? [...navItems, ...adminNavItems] : navItems;

  const handleLogout = async () => {
    await signOut({ redirect: false });
    router.push("/login");
  };

  // Refs for GSAP animations
  const sidebarRef = useRef<HTMLElement>(null);
  const logoTextRef = useRef<HTMLDivElement>(null);
  const navLabelsRef = useRef<(HTMLSpanElement | null)[]>([]);
  const chevronRefs = useRef<(SVGSVGElement | null)[]>([]);
  const userInfoRef = useRef<HTMLDivElement>(null);
  const footerTextRef = useRef<HTMLDivElement>(null);
  const footerLogoRef = useRef<HTMLDivElement>(null);

  const isCollapsed = !isHovered;

  // GSAP animation for sidebar expansion/collapse
  const animateSidebar = useCallback((expanded: boolean) => {
    const tl = gsap.timeline({ defaults: { ease: "power3.out" } });

    // Sidebar width
    tl.to(
      sidebarRef.current,
      {
        width: expanded ? SIDEBAR_EXPANDED : SIDEBAR_COLLAPSED,
        duration: 0.4,
      },
      0,
    );

    // Logo text fade
    if (logoTextRef.current) {
      tl.to(
        logoTextRef.current,
        {
          opacity: expanded ? 1 : 0,
          x: expanded ? 0 : -20,
          duration: 0.3,
          pointerEvents: expanded ? "auto" : "none",
        },
        expanded ? 0.1 : 0,
      );
    }

    // Nav labels fade with stagger
    navLabelsRef.current.forEach((label, index) => {
      if (label) {
        tl.to(
          label,
          {
            opacity: expanded ? 1 : 0,
            x: expanded ? 0 : -10,
            duration: 0.25,
          },
          expanded ? 0.05 + index * 0.03 : index * 0.02,
        );
      }
    });

    // Chevron icons
    chevronRefs.current.forEach((chevron, index) => {
      if (chevron) {
        tl.to(
          chevron,
          {
            opacity: expanded ? 1 : 0,
            x: expanded ? 0 : -5,
            duration: 0.2,
          },
          expanded ? 0.15 + index * 0.02 : index * 0.02,
        );
      }
    });

    // User info
    if (userInfoRef.current) {
      tl.to(
        userInfoRef.current,
        {
          opacity: expanded ? 1 : 0,
          x: expanded ? 0 : -10,
          duration: 0.25,
        },
        expanded ? 0.1 : 0,
      );
    }

    // Footer text
    if (footerTextRef.current) {
      tl.to(
        footerTextRef.current,
        {
          opacity: expanded ? 1 : 0,
          y: expanded ? 0 : 5,
          duration: 0.2,
        },
        expanded ? 0.15 : 0,
      );
    }

    // Footer logo size
    if (footerLogoRef.current) {
      tl.to(
        footerLogoRef.current,
        {
          scale: expanded ? 1 : 0.7,
          duration: 0.3,
        },
        0.1,
      );
    }
  }, []);

  // Run animation when hover state changes
  useEffect(() => {
    animateSidebar(isHovered);
    // Dispatch event to close dropdowns when sidebar expands
    if (isHovered) {
      window.dispatchEvent(new CustomEvent("sidebar-expanded"));
    }
  }, [isHovered, animateSidebar]);

  // Initial setup
  useEffect(() => {
    // Set initial collapsed state without animation
    gsap.set(sidebarRef.current, { width: SIDEBAR_COLLAPSED });
    gsap.set(logoTextRef.current, { opacity: 0, x: -20 });
    navLabelsRef.current.forEach((label) => {
      if (label) gsap.set(label, { opacity: 0, x: -10 });
    });
    chevronRefs.current.forEach((chevron) => {
      if (chevron) gsap.set(chevron, { opacity: 0, x: -5 });
    });
    if (userInfoRef.current)
      gsap.set(userInfoRef.current, { opacity: 0, x: -10 });
    if (footerTextRef.current)
      gsap.set(footerTextRef.current, { opacity: 0, y: 5 });
    if (footerLogoRef.current) gsap.set(footerLogoRef.current, { scale: 0.7 });
  }, []);

  // Store label refs
  const setNavLabelRef = (index: number) => (el: HTMLSpanElement | null) => {
    navLabelsRef.current[index] = el;
  };

  // Store chevron refs
  const setChevronRef = (index: number) => (el: SVGSVGElement | null) => {
    chevronRefs.current[index] = el;
  };

  // Close mobile menu when navigating
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  return (
    <div className="flex h-screen w-full min-w-0 max-w-[100vw] overflow-hidden bg-bg-base">
      {/* Mobile Header */}
      <header className="fixed left-0 right-0 top-0 z-50 flex h-14 items-center justify-between border-b border-border-subtle bg-bg-surface/95 px-4 backdrop-blur-xl md:hidden">
        <Image
          src={
            theme === "light"
              ? "/uber/Uber_logo_2018.svg"
              : "/uber/Uber_logo_2018_white.svg"
          }
          alt="Uber"
          width={32}
          height={32}
          className="object-contain"
        />
        <div className="flex items-center gap-2">
          <button
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-fg-muted transition-colors hover:bg-interactive-hover hover:text-fg-primary"
          >
            {theme === "dark" ? (
              <Sun className="h-5 w-5" />
            ) : (
              <Moon className="h-5 w-5" />
            )}
          </button>
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-fg-muted transition-colors hover:bg-interactive-hover hover:text-fg-primary"
          >
            {mobileMenuOpen ? (
              <X className="h-5 w-5" />
            ) : (
              <Menu className="h-5 w-5" />
            )}
          </button>
        </div>
      </header>

      {/* Mobile Menu Overlay */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-40 bg-overlay-backdrop backdrop-blur-sm md:hidden">
          <div className="absolute right-0 top-14 w-64 rounded-bl-xl border-b border-l border-border-subtle bg-bg-surface p-4 shadow-xl">
            <div className="mb-4 flex items-center gap-3 border-b border-border-subtle pb-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-interactive-hover text-fg-secondary">
                <span className="text-sm font-medium">{userInitials}</span>
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium text-fg-primary">
                  {userName}
                </div>
                <div className="text-xs text-fg-muted">
                  {session?.user?.role || "Usuario"}
                </div>
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-red-400 transition-colors hover:bg-red-500/10"
            >
              <LogOut className="h-5 w-5" />
              <span className="text-sm font-medium">Cerrar sesión</span>
            </button>
          </div>
        </div>
      )}

      {/* Desktop Sidebar */}
      <aside
        ref={sidebarRef}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        className={cn(
          "fixed left-0 top-0 z-40 h-screen",
          "bg-bg-surface/95 backdrop-blur-xl",
          "border-r border-border-subtle",
          "hidden flex-col overflow-hidden md:flex",
        )}
        style={{ width: SIDEBAR_COLLAPSED }}
      >
        {/* Logo */}
        <div className="flex h-16 items-center overflow-hidden border-b border-border-subtle px-4">
          {/* Small logo (collapsed) */}
          {isCollapsed && (
            <div className="flex shrink-0 items-center justify-center">
              <Image
                src={
                  theme === "light"
                    ? "/uber/Uber_logo_2018.svg"
                    : "/uber/Uber_logo_2018_white.svg"
                }
                alt="Uber"
                width={32}
                height={32}
                className="object-contain"
              />
            </div>
          )}
          {/* Expanded logo */}
          {!isCollapsed && (
            <div
              ref={logoTextRef}
              className="whitespace-nowrap"
              style={{ opacity: 0 }}
            >
              <Image
                src={
                  theme === "light"
                    ? "/uber/Uber_logo_2018.svg"
                    : "/uber/Uber_logo_2018_white.svg"
                }
                alt="Uber"
                width={120}
                height={32}
                className="object-contain"
              />
            </div>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 space-y-1 overflow-y-auto overflow-x-hidden px-3 py-4">
          {allNavItems.map((item, index) => {
            const Icon = item.icon;
            const isActive =
              pathname === item.href || pathname.startsWith(`${item.href}/`);

            const navLink = (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "group flex items-center gap-3 overflow-hidden rounded-lg",
                  "px-3 py-2.5 transition-all duration-200",
                  isActive
                    ? theme === "light"
                      ? "bg-black text-white hover:bg-black/90"
                      : "bg-white text-black hover:bg-white/90"
                    : "text-fg-secondary hover:bg-interactive-hover hover:text-fg-primary",
                )}
              >
                <Icon
                  className={cn(
                    "h-5 w-5 shrink-0 transition-colors",
                    isActive
                      ? theme === "light"
                        ? "text-white"
                        : "text-black"
                      : "text-fg-muted group-hover:text-accent-primary",
                  )}
                />

                <span
                  ref={setNavLabelRef(index)}
                  className={cn(
                    "whitespace-nowrap text-[14px] font-medium",
                    isActive
                      ? theme === "light"
                        ? "text-white"
                        : "text-black"
                      : "",
                  )}
                  style={{ opacity: isCollapsed ? 0 : 1 }}
                >
                  {item.label}
                </span>

                {isActive && !isCollapsed && (
                  <ChevronRight
                    ref={setChevronRef(index)}
                    className={cn(
                      "ml-auto h-4 w-4 shrink-0",
                      theme === "light" ? "text-white/50" : "text-black/50",
                    )}
                  />
                )}
              </Link>
            );

            if (isCollapsed) {
              return (
                <Tooltip key={item.href}>
                  <TooltipTrigger asChild>{navLink}</TooltipTrigger>
                  <TooltipContent
                    side="right"
                    sideOffset={12}
                    className="border-border-subtle bg-bg-elevated text-fg-primary"
                  >
                    {item.label}
                  </TooltipContent>
                </Tooltip>
              );
            }

            return navLink;
          })}
        </nav>

        {/* Bottom section */}
        <div className="flex flex-col border-t border-border-subtle">
          {/* Theme Toggle */}
          <div className="border-t border-border-subtle px-3 py-2">
            {isCollapsed ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={() =>
                      setTheme(theme === "dark" ? "light" : "dark")
                    }
                    className="flex w-full items-center justify-center rounded-lg p-2.5 text-fg-muted transition-all hover:bg-interactive-hover hover:text-fg-primary"
                  >
                    {theme === "dark" ? (
                      <Sun className="h-5 w-5" />
                    ) : (
                      <Moon className="h-5 w-5" />
                    )}
                  </button>
                </TooltipTrigger>
                <TooltipContent
                  side="right"
                  sideOffset={12}
                  className="border-border-subtle bg-bg-elevated text-fg-primary"
                >
                  {theme === "dark" ? "Modo claro" : "Modo oscuro"}
                </TooltipContent>
              </Tooltip>
            ) : (
              <button
                onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
                className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-fg-secondary transition-all hover:bg-interactive-hover hover:text-fg-primary"
              >
                {theme === "dark" ? (
                  <Sun className="h-5 w-5 text-fg-muted" />
                ) : (
                  <Moon className="h-5 w-5 text-fg-muted" />
                )}
                <span className="text-[14px]">
                  {theme === "dark" ? "Modo claro" : "Modo oscuro"}
                </span>
              </button>
            )}
          </div>

          {/* User Section - Expands on hover to show logout */}
          <div
            className="group border-t border-border-subtle px-3 py-3"
            ref={userMenuRef}
          >
            {isCollapsed ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="flex w-full cursor-pointer justify-center">
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-interactive-hover text-fg-secondary transition-all hover:bg-interactive-active">
                      <span className="text-[12px] font-medium">
                        {userInitials}
                      </span>
                    </div>
                  </div>
                </TooltipTrigger>
                <TooltipContent
                  side="right"
                  sideOffset={12}
                  className="border-border-subtle bg-bg-elevated text-fg-primary"
                >
                  <div className="font-medium">{userName}</div>
                  <div className="text-[11px] text-fg-muted">
                    {session?.user?.role || "Usuario"}
                  </div>
                </TooltipContent>
              </Tooltip>
            ) : (
              <div
                className="group/user flex w-full cursor-pointer items-center gap-3 overflow-hidden rounded-lg px-2 py-2 transition-all hover:bg-interactive-hover"
                onClick={handleLogout}
              >
                <div className="shrink-0">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-interactive-hover text-fg-secondary transition-all group-hover/user:bg-red-500/20 group-hover/user:text-red-400">
                    <span className="text-[12px] font-medium group-hover/user:hidden">
                      {userInitials}
                    </span>
                    <LogOut className="hidden h-4 w-4 group-hover/user:block" />
                  </div>
                </div>
                <div
                  ref={userInfoRef}
                  className="min-w-0 flex-1 whitespace-nowrap text-left"
                  style={{ opacity: 0 }}
                >
                  {/* Default: Name and role */}
                  <div className="group-hover/user:hidden">
                    <div className="truncate text-[14px] font-medium text-fg-primary">
                      {userName}
                    </div>
                    <div className="text-[11px] text-fg-muted">
                      {session?.user?.role || "Usuario"}
                    </div>
                  </div>
                  {/* Hover: Logout text */}
                  <div className="hidden group-hover/user:block">
                    <div className="text-[14px] font-medium text-red-400">
                      Cerrar sesion
                    </div>
                    <div className="text-[11px] text-red-400/50">
                      Click para salir
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Powered by Footer */}
          <div className="border-t border-border-subtle px-4 py-3">
            <div className="flex h-14 flex-col items-center justify-center">
              {isCollapsed ? (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="flex items-center justify-center">
                      <Image
                        src={
                          theme === "light"
                            ? "/happyrobot/Footer-logo-black.svg"
                            : "/happyrobot/Footer-logo-white.svg"
                        }
                        alt="HappyRobot AI"
                        width={32}
                        height={32}
                        className="cursor-pointer object-contain opacity-40 transition-opacity hover:opacity-60"
                      />
                    </div>
                  </TooltipTrigger>
                  <TooltipContent
                    side="right"
                    sideOffset={12}
                    className="border-border-subtle bg-bg-elevated text-fg-primary"
                  >
                    Powered by HappyRobot AI
                  </TooltipContent>
                </Tooltip>
              ) : (
                <>
                  <div
                    ref={footerTextRef}
                    className="mb-1 whitespace-nowrap text-[10px] uppercase tracking-[0.15em] text-fg-disabled"
                    style={{ opacity: 0 }}
                  >
                    Powered by
                  </div>
                  <div ref={footerLogoRef}>
                    <Image
                      src={
                        theme === "light"
                          ? "/happyrobot/Footer-expand-happyrobot-blacl.png"
                          : "/happyrobot/Footer-expand-happyrobot_white.png"
                      }
                      alt="HappyRobot AI"
                      width={110}
                      height={24}
                      className="object-contain opacity-40 transition-opacity hover:opacity-60"
                    />
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main
        className={cn(
          "flex w-full min-w-0 flex-col overflow-hidden",
          "h-[calc(100vh-3.5rem-4rem)] pt-14 md:h-screen md:pt-0", // Account for mobile header and bottom nav
          "pb-16 md:pb-0", // Account for mobile bottom nav
        )}
        style={{
          marginLeft: 0,
          maxWidth: "100vw",
        }}
      >
        <div
          className="hidden h-full w-full md:block"
          style={{
            marginLeft: SIDEBAR_COLLAPSED,
            maxWidth: `calc(100vw - ${SIDEBAR_COLLAPSED}px)`,
          }}
        >
          {children}
        </div>
        <div className="h-full w-full md:hidden">{children}</div>
      </main>

      {/* Mobile Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 flex h-16 items-center justify-around border-t border-border-subtle bg-bg-surface/95 backdrop-blur-xl md:hidden">
        {allNavItems.map((item) => {
          const Icon = item.icon;
          const isActive =
            pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-col items-center gap-1 px-4 py-2 transition-colors",
                isActive
                  ? "text-accent-primary"
                  : "text-fg-muted hover:text-fg-secondary",
              )}
            >
              <Icon className="h-5 w-5" />
              <span className="text-[10px] font-medium">
                {item.label}
              </span>
            </Link>
          );
        })}
      </nav>

      {/* Toast notifications */}
      <Toaster />
    </div>
  );
}
