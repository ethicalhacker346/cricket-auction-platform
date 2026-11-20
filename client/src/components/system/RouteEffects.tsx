import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";

export function pageTitle(pathname: string) {
  const titles: Record<string, string> = {
    "/": "Cricket auctions, reimagined",
    "/login": "Sign in",
    "/register": "Create an account",
    "/forgot-password": "Recover your account",
    "/reset-password": "Reset your password",
    "/dashboard": "Dashboard",
    "/notifications": "Notifications",
    "/privacy": "Privacy policy",
    "/terms": "Terms of service",
    "/creator": "Meet the creator",
    "/help": "Help center",
    "/help/auctions": "How auctions work",
    "/help/guidelines": "Auction guidelines",
    "/help/bidding": "Bidding rules",
    "/help/squads": "Squad rules",
    "/faq": "Frequently asked questions",
    "/contact": "Get in touch",
  };
  if (titles[pathname]) return `${titles[pathname]} · GullyBid`;
  if (pathname.startsWith("/admin/")) return "Admin workspace · GullyBid";
  if (/\/auction\//.test(pathname)) return "Auction room · GullyBid";
  if (
    /^\/(tournaments|players|franchises)\//.test(pathname) ||
    pathname.startsWith("/create-")
  )
    return "Tournament workspace · GullyBid";
  return "Page not found · GullyBid";
}

/** Runs after the Suspense route commits, not before its page exists. */
export function RouteEffects() {
  const { pathname, hash } = useLocation();
  const previousPath = useRef(pathname);
  useEffect(() => {
    document.title = pageTitle(pathname);
    const changedPage = previousPath.current !== pathname;
    previousPath.current = pathname;
    if (hash) {
      let id: string;
      try {
        id = decodeURIComponent(hash.slice(1));
      } catch {
        return;
      }
      const target = document.getElementById(id);
      target?.scrollIntoView({ behavior: "auto", block: "start" });
      // Move keyboard focus too, but do not insert sections into the tab order.
      if (target) {
        if (!target.hasAttribute("tabindex"))
          target.setAttribute("tabindex", "-1");
        target.focus({ preventScroll: true });
      }
    } else if (changedPage) {
      window.scrollTo({ top: 0, left: 0, behavior: "auto" });
      const main = document.querySelector("main");
      if (main) {
        if (!main.hasAttribute("tabindex")) main.setAttribute("tabindex", "-1");
        main.focus({ preventScroll: true });
      }
    }
  }, [pathname, hash]);
  return null;
}
