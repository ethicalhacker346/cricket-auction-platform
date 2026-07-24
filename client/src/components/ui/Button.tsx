import * as React from "react";
import { Button as ButtonPrimitive } from "@base-ui/react/button";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

// ═══════════════════════════════════════════════════════════════════
//  Spinner – self-contained, respects reduced-motion
// ═══════════════════════════════════════════════════════════════════
const Spinner = React.memo(function Spinner({
  className,
}: {
  className?: string;
}) {
  return (
    <svg
      className={cn("animate-spin motion-reduce:animate-none", className)}
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      aria-hidden="true"
      role="presentation"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
  );
});

// ═══════════════════════════════════════════════════════════════════
//  CVA – enhanced with shadow depth, focus-ring tint per variant,
//  and data-[loading] guards to disable active-scale while busy
// ═══════════════════════════════════════════════════════════════════
const buttonVariants = cva(
  [
    "group/button relative inline-flex shrink-0 items-center justify-center",
    "rounded-lg border border-transparent bg-clip-padding",
    "text-sm font-medium whitespace-nowrap",
    "transition-all duration-200 ease-out",
    "outline-none select-none",
    "focus-visible:ring-2 focus-visible:ring-offset-2",
    "active:scale-[0.98] active:duration-100 motion-reduce:active:scale-100",
    "disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50",
    "data-[loading=true]:scale-100 data-[loading=true]:cursor-wait data-[loading=true]:opacity-80",
    "aria-invalid:border-destructive aria-invalid:ring-2 aria-invalid:ring-destructive/20",
    "dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40",
    "[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  ].join(" "),
  {
    variants: {
      variant: {
        default: [
          "bg-primary text-primary-foreground",
          "hover:bg-primary/90 hover:shadow-lg hover:shadow-primary/25",
          "focus-visible:ring-primary/50",
        ].join(" "),
        outline: [
          "border-border bg-background text-foreground",
          "hover:bg-muted hover:text-foreground hover:shadow-md hover:shadow-black/5",
          "aria-expanded:bg-muted aria-expanded:text-foreground",
          "dark:border-input dark:bg-input/30 dark:hover:bg-input/50",
          "focus-visible:ring-primary/50",
        ].join(" "),
        secondary: [
          "bg-secondary text-secondary-foreground",
          "hover:bg-[color-mix(in_oklch,var(--secondary),var(--foreground)_8%)]",
          "hover:shadow-md hover:shadow-secondary/20",
          "aria-expanded:bg-secondary aria-expanded:text-secondary-foreground",
          "focus-visible:ring-secondary/50",
        ].join(" "),
        ghost: [
          "text-foreground",
          "hover:bg-muted hover:text-foreground",
          "aria-expanded:bg-muted aria-expanded:text-foreground",
          "dark:hover:bg-muted/50",
          "focus-visible:ring-primary/50",
        ].join(" "),
        destructive: [
          "bg-destructive/10 text-destructive",
          "hover:bg-destructive/20 hover:shadow-md hover:shadow-destructive/10",
          "focus-visible:border-destructive/40 focus-visible:ring-destructive/30",
          "dark:bg-destructive/20 dark:hover:bg-destructive/30 dark:focus-visible:ring-destructive/40",
        ].join(" "),
        link: [
          "text-primary underline-offset-4",
          "hover:underline",
          "focus-visible:ring-primary/50",
        ].join(" "),
      },
      size: {
        default:
          "h-8 gap-1.5 px-2.5 has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2",
        xs: "h-6 gap-1 rounded-[min(var(--radius-md),10px)] px-2 text-xs in-data-[slot=button-group]:rounded-lg has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3",
        sm: "h-7 gap-1 rounded-[min(var(--radius-md),12px)] px-2.5 text-[0.8rem] in-data-[slot=button-group]:rounded-lg has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3.5",
        lg: "h-9 gap-1.5 px-2.5 has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2",
        icon: "size-8",
        "icon-xs":
          "size-6 rounded-[min(var(--radius-md),10px)] in-data-[slot=button-group]:rounded-lg [&_svg:not([class*='size-'])]:size-3",
        "icon-sm":
          "size-7 rounded-[min(var(--radius-md),12px)] in-data-[slot=button-group]:rounded-lg",
        "icon-lg": "size-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

// ═══════════════════════════════════════════════════════════════════
//  Types
// ═══════════════════════════════════════════════════════════════════
export interface ButtonProps
  extends ButtonPrimitive.Props,
    VariantProps<typeof buttonVariants> {
  /** Puts the button into a loading state. Disables interactions and announces busy state to screen readers. */
  isLoading?: boolean;
  /** Text displayed while loading (e.g. "Signing in…"). If omitted, only the spinner is shown while preserving button width. */
  loadingText?: string;
  /** Icon rendered before the label. Automatically hidden during loading unless `loader` is used. */
  leftIcon?: React.ReactNode;
  /** Icon rendered after the label. Automatically hidden during loading. */
  rightIcon?: React.ReactNode;
  /** Custom loader element. Defaults to an adaptive SVG spinner. */
  loader?: React.ReactNode;
  /** Additional classes for the default spinner. */
  loaderClassName?: string;
}

// ═══════════════════════════════════════════════════════════════════
//  Component – zero-layout-shift loading, smooth cross-fade,
//  accessible busy state, polymorphic via Base UI render prop
// ═══════════════════════════════════════════════════════════════════
const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant = "default",
      size = "default",
      isLoading = false,
      loadingText,
      leftIcon,
      rightIcon,
      loader,
      loaderClassName,
      children,
      disabled,
      type = "button",
      ...props
    },
    ref
  ) => {
    const isDisabled = disabled || isLoading;
    const spinner = loader ?? (
      <Spinner className={cn("size-4", loaderClassName)} />
    );

    return (
      <ButtonPrimitive
        ref={ref}
        type={type}
        data-slot="button"
        data-loading={isLoading ? "true" : undefined}
        className={cn(buttonVariants({ variant, size, className }))}
        disabled={isDisabled}
        aria-busy={isLoading}
        aria-disabled={isDisabled}
        {...props}
      >
        {/*
          Grid trick: both layers occupy the same cell.
          – Largest layer dictates width → zero layout shift.
          – Opacity cross-fade → buttery state transitions.
        */}
        <span className="grid grid-cols-1 place-items-center">
          {/* ── Loading layer ── */}
          <span
            className={cn(
              "col-start-1 row-start-1 flex items-center justify-center gap-1.5",
              "transition-opacity duration-200 ease-out",
              isLoading ? "opacity-100" : "opacity-0"
            )}
          >
            {spinner}
            {loadingText ? (
              <span className="truncate">{loadingText}</span>
            ) : null}
          </span>

          {/* ── Content layer ── */}
          <span
            className={cn(
              "col-start-1 row-start-1 flex items-center justify-center gap-1.5",
              "transition-opacity duration-200 ease-out",
              isLoading ? "opacity-0" : "opacity-100"
            )}
          >
            {leftIcon ? (
              <span className="inline-flex items-center">{leftIcon}</span>
            ) : null}
            {children}
            {rightIcon ? (
              <span className="inline-flex items-center">{rightIcon}</span>
            ) : null}
          </span>
        </span>
      </ButtonPrimitive>
    );
  }
);

Button.displayName = "Button";

export { Button, buttonVariants };
