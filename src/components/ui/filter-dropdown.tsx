"use client";

import { useState, useRef, useEffect } from "react";
import { ChevronDown, Check, Filter, X, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface FilterOption {
  value: string;
  label: string;
}

interface FilterDropdownProps {
  value: string;
  onChange: (value: string) => void;
  options: string[] | FilterOption[];
  className?: string;
  label: string;
  allLabel?: string;
  align?: "left" | "right";
  icon?: LucideIcon;
}

// Helper to normalize options to FilterOption format
function normalizeOptions(options: string[] | FilterOption[]): FilterOption[] {
  return options.map((opt) =>
    typeof opt === "string" ? { value: opt, label: opt } : opt,
  );
}

export function FilterDropdown({
  value,
  onChange,
  options,
  className,
  label,
  allLabel,
  align = "left",
  icon: Icon = Filter,
}: FilterDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Normalize options to support both string[] and FilterOption[]
  const normalizedOptions = normalizeOptions(options);

  // Find the selected option's label
  const selectedOption = normalizedOptions.find((opt) => opt.value === value);
  const displayValue = selectedOption?.label || value;

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Close on escape
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsOpen(false);
    };
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, []);

  // Close when sidebar expands
  useEffect(() => {
    const handleSidebarExpanded = () => setIsOpen(false);
    window.addEventListener("sidebar-expanded", handleSidebarExpanded);
    return () =>
      window.removeEventListener("sidebar-expanded", handleSidebarExpanded);
  }, []);

  const isActive = !!value;

  return (
    <div ref={dropdownRef} className={cn("relative", className)}>
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "group flex w-full min-w-[140px] items-center justify-between gap-2 rounded-lg border px-3 py-2 text-[13px] font-medium transition-all duration-200",
          "bg-glass-bg hover:bg-interactive-hover",
          isOpen
            ? "border-accent-primary/40 text-fg-primary shadow-glow-sm"
            : isActive
              ? "border-border-medium text-fg-primary"
              : "border-border-subtle text-fg-secondary hover:border-border-medium hover:text-fg-primary",
        )}
      >
        <div className="flex items-center gap-2 truncate">
          <Icon
            className={cn(
              "h-3.5 w-3.5",
              isActive ? "text-fg-primary" : "text-fg-muted",
            )}
          />
          <span className="truncate">{isActive ? displayValue : label}</span>
        </div>
        <div className="flex items-center gap-1">
          {/* Clear X - inside button, to the left of chevron */}
          {isActive && (
            <span
              role="button"
              onClick={(e) => {
                e.stopPropagation();
                onChange("");
              }}
              className="flex h-5 w-5 items-center justify-center rounded text-fg-muted transition-colors hover:bg-interactive-active hover:text-fg-primary"
              title="Limpiar filtro"
            >
              <X className="h-3.5 w-3.5" />
            </span>
          )}
          <ChevronDown
            className={cn(
              "h-3 w-3 text-fg-disabled transition-transform duration-200",
              isOpen && "rotate-180 text-fg-primary",
            )}
          />
        </div>
      </button>

      {/* Dropdown Panel */}
      {isOpen && (
        <div
          className={cn(
            "absolute top-full z-50 mt-2 flex max-h-[300px] min-w-[180px] flex-col",
            "linear-dropdown",
            "animate-in fade-in zoom-in-95 duration-100",
            align === "left"
              ? "left-0 origin-top-left"
              : "right-0 origin-top-right",
          )}
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-border-subtle px-3 py-2">
            <span className="linear-section-header">{label || "Filtrar"}</span>
            {isActive && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onChange("");
                  setIsOpen(false);
                }}
                className="flex items-center gap-1 text-[10px] text-fg-muted transition-colors hover:text-fg-primary"
              >
                <X className="h-3 w-3" /> Limpiar
              </button>
            )}
          </div>

          {/* Options List */}
          <div className="overflow-y-auto py-1">
            {/* "All" Option - only show when a filter is active */}
            {isActive && (
              <button
                type="button"
                onClick={() => {
                  onChange("");
                  setIsOpen(false);
                }}
                className="linear-dropdown-item flex w-full items-center justify-between text-left"
              >
                <span>{allLabel || "Sin filtro"}</span>
              </button>
            )}

            {/* Dynamic Options */}
            {normalizedOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => {
                  onChange(option.value);
                  setIsOpen(false);
                }}
                className={cn(
                  "linear-dropdown-item flex w-full items-center justify-between text-left",
                  value === option.value &&
                    "bg-interactive-active text-fg-primary",
                )}
              >
                <span className="truncate">{option.label}</span>
                {value === option.value && (
                  <Check className="h-3 w-3 text-accent-primary" />
                )}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
