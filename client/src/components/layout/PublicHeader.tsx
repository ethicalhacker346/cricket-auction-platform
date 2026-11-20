import { useEffect, useId, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { ArrowUpRight, Menu, X } from "lucide-react";
import { Logo } from "@/components/auth/Logo";
import { useAuthStore } from "@/store/authStore";

const LINKS = [
  { to: "/#platform", label: "The platform" },
  { to: "/#how-it-works", label: "How it works" },
  { to: "/help", label: "Help center" },
];

export function PublicHeader({ tone = "dark" }: { tone?: "light" | "dark" }) {
  const authenticated = useAuthStore((s) => s.isAuthenticated);
  const location = useLocation();
  // Associate disclosure state with its location; history navigation cannot
  // leave an old mobile disclosure open over a new page.
  const routeKey = location.pathname + location.hash;
  const [openAt, setOpenAt] = useState<string | null>(null);
  const open = openAt === routeKey;
  const id = useId();
  const headerRef = useRef<HTMLElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpenAt(null);
        toggleRef.current?.focus();
      }
    };
    const onPointer = (event: PointerEvent) => {
      if (!headerRef.current?.contains(event.target as Node)) setOpenAt(null);
    };
    const media = window.matchMedia("(min-width: 900px)");
    const onResize = () => {
      if (media.matches) setOpenAt(null);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointer);
    media.addEventListener("change", onResize);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointer);
      media.removeEventListener("change", onResize);
    };
  }, [open]);

  const close = () => setOpenAt(null);
  return (
    <header
      ref={headerRef}
      className={`gb-public-header gb-public-header--${tone}`}
    >
      <a className="gb-skip-link" href="#main-content">
        Skip to content
      </a>
      <div className="gb-container gb-public-header__bar">
        <Link to="/" aria-label="GullyBid home" onClick={close}>
          <Logo tone={tone} />
        </Link>
        <nav className="gb-public-header__desktop" aria-label="Main navigation">
          {LINKS.map((item) => (
            <Link key={item.to} to={item.to}>
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="gb-public-header__actions">
          {!authenticated && (
            <Link className="gb-header-signin" to="/login">
              Sign in
            </Link>
          )}
          <Link
            className="gb-button gb-button--small gb-button--gold"
            to={authenticated ? "/dashboard" : "/register"}
          >
            {authenticated ? "Dashboard" : "Get started"}
            <ArrowUpRight size={16} aria-hidden="true" />
          </Link>
          <button
            ref={toggleRef}
            type="button"
            className="gb-menu-toggle"
            aria-label={open ? "Close navigation" : "Open navigation"}
            aria-expanded={open}
            aria-controls={id}
            onClick={() => setOpenAt(open ? null : routeKey)}
          >
            {open ? (
              <X size={21} aria-hidden="true" />
            ) : (
              <Menu size={21} aria-hidden="true" />
            )}
          </button>
        </div>
      </div>
      {open && (
        <nav
          id={id}
          className="gb-public-header__mobile"
          aria-label="Mobile navigation"
        >
          {LINKS.map((item) => (
            <Link key={item.to} to={item.to} onClick={close}>
              {item.label}
              <ArrowUpRight size={16} aria-hidden="true" />
            </Link>
          ))}
          {!authenticated && (
            <Link to="/login" onClick={close}>
              Sign in
              <ArrowUpRight size={16} aria-hidden="true" />
            </Link>
          )}
        </nav>
      )}
    </header>
  );
}
