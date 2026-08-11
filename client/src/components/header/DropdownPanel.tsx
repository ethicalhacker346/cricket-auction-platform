import { type ReactNode } from "react";
import { cn } from "@/utils/cn";

interface DropdownPanelProps {
  open: boolean;
  label: string;
  align?: "left" | "right";
  width?: string;
  /**
   * Makes content-heavy dropdowns viewport-safe on mobile.
   *
   * Mobile:
   * - fixed to the viewport
   * - 0.5rem horizontal gutters
   *
   * sm+:
   * - returns to trigger-relative absolute positioning
   * - supplied width is preserved
   */
  mobileViewport?: boolean;
  children: ReactNode;
}

/**
 * Shared dropdown surface.
 *
 * Always mounted so open/close transitions can animate in both directions.
 * Closed panels remain inert through pointer-events-none + aria-hidden.
 */
export function DropdownPanel({
  open,
  label,
  align = "right",
  width = "w-72",
  mobileViewport = false,
  children,
}: DropdownPanelProps) {
  return (
    <div
      role="menu"
      aria-label={label}
      aria-hidden={!open}
      className={cn(
        "z-50 overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-xl shadow-slate-900/10 ring-1 ring-black/5",
        "transition-all duration-150 ease-out motion-reduce:transition-none",

        mobileViewport
          ? [
              // ─────────────────────────────────────────────
              // MOBILE
              // ─────────────────────────────────────────────
              // The panel is attached to the viewport, not the
              // notification trigger/container.
              "fixed left-2 right-2 top-[4.5rem] mt-0",
              "w-auto max-w-none origin-top-right",

              // ─────────────────────────────────────────────
              // SM+
              // ─────────────────────────────────────────────
              // Return to normal trigger-relative dropdown
              // positioning.
              "sm:absolute sm:top-auto sm:mt-2",
              "sm:max-w-[calc(100vw-2rem)]",

              align === "right"
                ? "sm:right-0 sm:left-auto sm:origin-top-right"
                : "sm:left-0 sm:right-auto sm:origin-top-left",

              // IMPORTANT:
              // width is intentionally applied AFTER the mobile
              // width rules so a consumer can provide:
              // sm:w-[380px]
              width,
            ]
          : [
              "absolute mt-2 max-w-[calc(100vw-2rem)]",
              align === "right"
                ? "right-0 origin-top-right"
                : "left-0 origin-top-left",
              width,
            ],

        open
          ? "pointer-events-auto translate-y-0 scale-100 opacity-100"
          : "pointer-events-none -translate-y-1 scale-95 opacity-0"
      )}
    >
      {children}
    </div>
  );
}