"use client";

import { NavRail } from "./nav-rail";
import { Toaster } from "@/components/ui/toaster";

interface AppShellProps {
  children: React.ReactNode;
  // Optional right panel (for lead detail, handover panel, etc.)
  rightPanel?: React.ReactNode;
}

export function AppShell({ children, rightPanel }: AppShellProps) {
  return (
    <div className="flex h-screen bg-bg-base">
      {/* Navigation Rail */}
      <NavRail />

      {/* Main content area */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Content */}
        <div className="flex flex-1 overflow-hidden">
          {/* Main panel */}
          <main className="flex-1 overflow-auto p-6">{children}</main>

          {/* Right panel (optional) */}
          {rightPanel && (
            <aside className="w-panel-right border-l border-border-subtle bg-bg-surface">
              {rightPanel}
            </aside>
          )}
        </div>
      </div>

      {/* Toast notifications */}
      <Toaster />
    </div>
  );
}
