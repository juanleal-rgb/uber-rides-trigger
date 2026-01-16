import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      // ============================================================
      // COLORS - UNIR Operations Design System
      // ============================================================
      colors: {
        // Dark Mode Backgrounds (Navy-Charcoal)
        bg: {
          base: "var(--bg-base)",
          surface: "var(--bg-surface)",
          elevated: "var(--bg-elevated)",
          "elevated-alt": "var(--bg-elevated-alt)",
          hover: "var(--bg-hover)",
          active: "var(--bg-active)",
        },
        // Foregrounds
        fg: {
          primary: "var(--fg-primary)",
          secondary: "var(--fg-secondary)",
          muted: "var(--fg-muted)",
          disabled: "var(--fg-disabled)",
        },
        // Borders
        border: {
          subtle: "var(--border-subtle)",
          medium: "var(--border-medium)",
          strong: "var(--border-strong)",
        },
        // Accent colors (UNIR Blue)
        accent: {
          primary: "var(--accent-primary)",
          "primary-light": "var(--accent-primary-light)",
          secondary: "var(--accent-secondary)",
          tertiary: "var(--accent-tertiary)",
          success: "var(--color-success)",
          danger: "var(--color-danger)",
          warning: "var(--color-warning)",
          info: "var(--color-info)",
        },
        // Glass
        glass: {
          bg: "var(--glass-bg)",
          "bg-elevated": "var(--glass-bg-elevated)",
          border: "var(--glass-border)",
        },
        // Interactive states
        interactive: {
          hover: "var(--interactive-hover)",
          active: "var(--interactive-active)",
        },
        // Status colors (aliased)
        status: {
          danger: "var(--status-danger)",
          success: "var(--color-success)",
          warning: "var(--color-warning)",
          info: "var(--color-info)",
        },
        // Overlay
        overlay: {
          backdrop: "var(--overlay-backdrop)",
        },
      },
      // ============================================================
      // TYPOGRAPHY
      // ============================================================
      fontFamily: {
        sans: ["var(--font-inter)", "Inter", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "JetBrains Mono", "Menlo", "monospace"],
      },
      fontSize: {
        // Headings
        "heading-lg": ["16px", { lineHeight: "1.4", fontWeight: "600" }],
        "heading-md": ["14px", { lineHeight: "1.4", fontWeight: "600" }],
        "heading-sm": ["13px", { lineHeight: "1.4", fontWeight: "600" }],
        // Body
        "body-md": ["13px", { lineHeight: "1.5", fontWeight: "400" }],
        "body-sm": ["12px", { lineHeight: "1.5", fontWeight: "400" }],
        // Caption
        caption: ["11px", { lineHeight: "1.4", fontWeight: "500" }],
        // Data (monospace)
        "data-lg": ["16px", { lineHeight: "1.2", fontWeight: "500" }],
        "data-md": ["13px", { lineHeight: "1.2", fontWeight: "400" }],
        "data-sm": ["11px", { lineHeight: "1.2", fontWeight: "400" }],
      },
      // ============================================================
      // SPACING (4px base)
      // ============================================================
      spacing: {
        "space-1": "4px",
        "space-2": "8px",
        "space-3": "12px",
        "space-4": "16px",
        "space-6": "24px",
        "space-8": "32px",
      },
      // ============================================================
      // BORDER RADIUS (Tight, engineered)
      // ============================================================
      borderRadius: {
        sm: "3px",
        md: "4px",
        lg: "6px",
      },
      // ============================================================
      // LAYOUT
      // ============================================================
      width: {
        "nav-rail": "56px",
        "panel-right": "320px",
      },
      // ============================================================
      // ANIMATIONS
      // ============================================================
      keyframes: {
        "pulse-live": {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.5" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
        "glow-pulse": {
          "0%, 100%": { boxShadow: "0 0 20px rgba(139, 92, 246, 0.2)" },
          "50%": { boxShadow: "0 0 30px rgba(139, 92, 246, 0.4)" },
        },
        "gradient-shift": {
          "0%": { backgroundPosition: "0% 50%" },
          "50%": { backgroundPosition: "100% 50%" },
          "100%": { backgroundPosition: "0% 50%" },
        },
        float: {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-4px)" },
        },
        "fade-in": {
          "0%": { opacity: "0", transform: "translateY(10px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        "pulse-live": "pulse-live 2s ease-in-out infinite",
        shimmer: "shimmer 1.5s infinite",
        "glow-pulse": "glow-pulse 2s ease-in-out infinite",
        "gradient-shift": "gradient-shift 8s ease infinite",
        float: "float 3s ease-in-out infinite",
        "fade-in": "fade-in 0.3s ease-out",
      },
      // Box shadows for glow effects
      boxShadow: {
        "glow-sm": "var(--glow-sm)",
        "glow-md": "var(--glow-primary)",
        "glow-lg": "var(--glow-hover)",
        "glow-accent": "var(--glow-accent)",
      },
    },
  },
  plugins: [],
};

export default config;
