import { type ReactNode } from "react";
import { cn } from "@/utils/cn";

interface DropdownPanelProps {
  open: boolean;
  label: string;
  align?: "left" | "right";
  width?: string;
  children: ReactNode;
}

/**
 * Always mounted (not conditionally rendered) so the open/close
 * transition can animate both ways without extra JS or a Tailwind
 * animation plugin. `pointer-events-none` + `aria-hidden` keep it
 * inert while closed.
 */
export function DropdownPanel({
  open,
  label,
  align = "right",
  width = "w-72",
  children,
}: DropdownPanelProps) {
  return (
    <div
      role="menu"
      aria-label={label}
      aria-hidden={!open}
      className={cn(
        "absolute z-50 mt-2 max-w-[calc(100vw-2rem)] overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-xl shadow-slate-900/10 ring-1 ring-black/5",
        "transition-all duration-150 ease-out motion-reduce:transition-none",
        align === "right" ? "right-0 origin-top-right" : "left-0 origin-top-left",
        width,
        open
          ? "pointer-events-auto translate-y-0 scale-100 opacity-100"
          : "pointer-events-none -translate-y-1 scale-95 opacity-0"
      )}
    >
      {children}
    </div>
  );
}