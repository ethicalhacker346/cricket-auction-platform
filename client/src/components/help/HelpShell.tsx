import { Link, useLocation, Outlet } from "react-router-dom";
import { MotionConfig } from "framer-motion";
import { PublicHeader } from "@/components/layout/PublicHeader";
import {
  Gavel,
  ClipboardList,
  Wallet,
  Users,
  HelpCircle,
  MessageCircle,
  Mail,
} from "lucide-react";

const helpNav = [
  {
    section: "Auction",
    items: [
      { to: "/help/auctions", label: "How Auctions Work", icon: Gavel },
      {
        to: "/help/guidelines",
        label: "Auction Guidelines",
        icon: ClipboardList,
      },
      { to: "/help/bidding", label: "Bidding Rules", icon: Wallet },
      { to: "/help/squads", label: "Squad Rules", icon: Users },
    ],
  },
  {
    section: "Support",
    items: [
      { to: "/help", label: "Help Center", icon: HelpCircle },
      { to: "/faq", label: "FAQ", icon: MessageCircle },
      { to: "/contact", label: "Contact", icon: Mail },
    ],
  },
];

export default function HelpShell() {
  const { pathname } = useLocation();

  return (
    <MotionConfig reducedMotion="user">
      <div className="gb-public-content min-h-screen bg-slate-50 text-slate-800">
        <PublicHeader tone="light" />

        <div className="mx-auto max-w-7xl px-6 py-10 lg:flex lg:gap-12 lg:py-16">
          {/* Sidebar */}
          <aside className="hidden shrink-0 lg:block lg:w-64">
            <nav className="sticky top-28 space-y-8" aria-label="Help topics">
              {helpNav.map((section) => (
                <div key={section.section}>
                  <h3 className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                    {section.section}
                  </h3>
                  <ul className="mt-3 space-y-1">
                    {section.items.map((item) => {
                      const active = pathname === item.to;
                      return (
                        <li key={item.to}>
                          <Link
                            to={item.to}
                            aria-current={active ? "page" : undefined}
                            className={`flex items-center gap-2.5 rounded-sm px-3 py-2 text-[13px] font-medium transition-all ${
                              active
                                ? "bg-slate-900 text-white shadow-md shadow-slate-900/10"
                                : "text-slate-600 hover:bg-slate-200/50 hover:text-slate-900"
                            }`}
                          >
                            <item.icon className="h-4 w-4" />
                            {item.label}
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
            </nav>
          </aside>

          {/* Mobile nav */}
          <nav
            className="gb-help-mobile-nav mb-8 flex gap-2 overflow-x-auto pb-2 lg:hidden"
            aria-label="Help topics"
          >
            {helpNav
              .flatMap((s) => s.items)
              .map((item) => {
                const active = pathname === item.to;
                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    aria-current={active ? "page" : undefined}
                    className={`shrink-0 rounded-sm px-3.5 py-2 text-[13px] font-medium whitespace-nowrap transition-all ${
                      active
                        ? "bg-slate-900 text-white"
                        : "bg-white text-slate-600 ring-1 ring-slate-200"
                    }`}
                  >
                    {item.label}
                  </Link>
                );
              })}
          </nav>

          {/* Content */}
          <main id="main-content" tabIndex={-1} className="min-w-0 flex-1">
            <Outlet />
          </main>
        </div>
      </div>
    </MotionConfig>
  );
}
