import { motion } from "framer-motion";
import { ArrowUpRight } from "lucide-react";
import { Link } from "react-router-dom";

/* ═════════════════════════════════════════════════════════════════
   DATA — Flattened, no platform column, zero API surface
   ═════════════════════════════════════════════════════════════════ */
const footerData = {
  brand: {
    name: "GullyBid",
    tagline: "Powering smarter cricket auctions for modern tournaments.",
    trust: ["Tournament Management", "Live Auction Experience", "Squad Intelligence"],
  },
  auction: {
    title: "Auction",
    links: [
      { label: "How Auctions Work", to: "/help/auctions" },
      { label: "Auction Guidelines", to: "/help/guidelines" },
      { label: "Bidding Rules", to: "/help/bidding" },
      { label: "Squad Rules", to: "/help/squads" },
    ],
  },
  support: {
    title: "Support",
    links: [
      { label: "Help Center", to: "/help" },
      { label: "FAQ", to: "/faq" },
      { label: "Contact Support", to: "/contact" },
      { label: "The Creator Page", to: "/creator" }
    ],
  },
  legal: [
    { label: "Privacy", to: "/privacy" },
    { label: "Terms", to: "/terms" },
   // { label: "Guidelines", to: "/guidelines" },
  ],
};

/* ═════════════════════════════════════════════════════════════════
   MOTION
   ═════════════════════════════════════════════════════════════════ */
const footerReveal = {
  hidden: { opacity: 0, y: 28 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.7, ease: [0.22, 1, 0.36, 1] },
  },
};

const staggerNav = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.04, delayChildren: 0.15 },
  },
};

const navItem = {
  hidden: { opacity: 0, x: -6 },
  visible: { opacity: 1, x: 0, transition: { duration: 0.35 } },
};

/* ═════════════════════════════════════════════════════════════════
   ATMOSPHERE — Sharp, architectural, no rounded containers
   ═════════════════════════════════════════════════════════════════ */
function PitchPattern() {
  return (
    <svg
      className="absolute inset-0 h-full w-full text-white opacity-[0.03]"
      xmlns="http://www.w3.org/2000/svg"
      preserveAspectRatio="xMidYMid slice"
    >
      <defs>
        <pattern
          id="pitch-grid"
          x="0"
          y="0"
          width="120"
          height="80"
          patternUnits="userSpaceOnUse"
        >
          <rect
            x="30"
            y="15"
            width="60"
            height="50"
            fill="none"
            stroke="currentColor"
            strokeWidth="0.5"
          />
          <line
            x1="30"
            y1="32"
            x2="90"
            y2="32"
            stroke="currentColor"
            strokeWidth="0.5"
          />
          <line
            x1="30"
            y1="48"
            x2="90"
            y2="48"
            stroke="currentColor"
            strokeWidth="0.5"
          />
          <line
            x1="18"
            y1="40"
            x2="26"
            y2="40"
            stroke="currentColor"
            strokeWidth="0.5"
          />
          <line
            x1="94"
            y1="40"
            x2="102"
            y2="40"
            stroke="currentColor"
            strokeWidth="0.5"
          />
          <line
            x1="22"
            y1="35"
            x2="26"
            y2="35"
            stroke="currentColor"
            strokeWidth="0.5"
          />
          <line
            x1="94"
            y1="45"
            x2="98"
            y2="45"
            stroke="currentColor"
            strokeWidth="0.5"
          />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#pitch-grid)" />
    </svg>
  );
}

function FooterLink({
  to,
  children,
}: {
  to: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      to={to}
      className="group flex items-center gap-2 text-[13px] font-medium text-slate-400 transition-colors duration-200 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/50 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 rounded-sm"
    >
      <span className="h-[5px] w-[5px] rounded-full bg-indigo-400 opacity-0 transition-all duration-200 group-hover:opacity-100" />
      <span>{children}</span>
      <ArrowUpRight className="h-3 w-3 opacity-0 transition-all duration-200 group-hover:opacity-100 group-hover:translate-x-[2px] group-hover:-translate-y-[1px]" />
    </Link>
  );
}

/* ═════════════════════════════════════════════════════════════════
   MAIN — Sharp corners, full-width on md, zero bottom margin
   ═════════════════════════════════════════════════════════════════ */
export function DashboardFooter() {
  return (
    <motion.footer
      variants={footerReveal}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: "-80px" }}
      className="relative mt-20 overflow-hidden bg-slate-950 ring-1 ring-white/[0.04]"
      aria-label="Dashboard footer"
    >
      {/* Atmospheric layers */}
      <PitchPattern />

      <div
        className="pointer-events-none absolute -top-32 -left-32 h-[28rem] w-[28rem] rounded-full bg-indigo-600/[0.07] blur-[120px]"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute -bottom-24 -right-24 h-64 w-64 rounded-full bg-violet-600/[0.05] blur-[100px]"
        aria-hidden="true"
      />

      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-slate-900/40 to-transparent"
        aria-hidden="true"
      />

      {/* 
        WIDTH STRATEGY
        ─────────────────
        Mobile : w-full + px-6        (comfortable gutters)
        Medium : w-full + px-10       (full bleed, no max-width constraint)
        Large  : max-w-7xl + px-12    (contained, centered)
      */}
      <div className="relative mx-auto w-full px-6 py-16 md:px-10 lg:max-w-7xl lg:px-12 lg:py-20">
        {/* 
          GRID STRATEGY
          ─────────────────
          Mobile : stacked
          Medium : 3 equal columns (Brand | Auction | Support) — uses full width
          Large  : Brand 5/12, Auction 3/12, Support 3/12 with intentional dead column
        */}
        <div className="grid grid-cols-1 gap-14 md:grid-cols-3 md:gap-10 lg:grid-cols-12 lg:gap-12">
          {/* BRAND — increased weight now that Platform is gone */}
          <div className="md:col-span-1 lg:col-span-5">
            <div className="flex items-center gap-2.5">
              {/* Logo mark — sharp, no radius, brutalist */}
              <div className="flex h-8 w-8 items-center justify-center bg-gradient-to-br from-indigo-500 to-violet-600 shadow-lg shadow-indigo-500/20">
                <span className="text-sm font-bold text-white">GB</span>
              </div>
              <span className="text-lg font-bold tracking-tight text-white">
                {footerData.brand.name}
              </span>
            </div>

            <p className="mt-5 max-w-sm text-[14px] leading-[1.7] text-slate-400">
              {footerData.brand.tagline}
            </p>

            <div className="mt-8 flex flex-wrap gap-x-5 gap-y-2">
              {footerData.brand.trust.map((item) => (
                <div key={item} className="flex items-center gap-1.5">
                  <span className="h-1 w-1 rounded-full bg-emerald-400/80" />
                  <span className="text-[11px] font-medium uppercase tracking-wider text-slate-500">
                    {item}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* AUCTION */}
          <motion.nav
            variants={staggerNav}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            className="md:col-span-1 lg:col-span-3 lg:col-start-7"
            aria-label="Auction resources"
          >
            <h3 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
              {footerData.auction.title}
            </h3>
            <ul role="list" className="mt-5 space-y-3.5">
              {footerData.auction.links.map((link) => (
                <motion.li key={link.label} variants={navItem}>
                  <FooterLink to={link.to}>{link.label}</FooterLink>
                </motion.li>
              ))}
            </ul>
          </motion.nav>

          {/* SUPPORT */}
          <motion.nav
            variants={staggerNav}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            className="md:col-span-1 lg:col-span-3"
            aria-label="Support links"
          >
            <h3 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
              {footerData.support.title}
            </h3>
            <ul role="list" className="mt-5 space-y-3.5">
              {footerData.support.links.map((link) => (
                <motion.li key={link.label} variants={navItem}>
                  <FooterLink to={link.to}>{link.label}</FooterLink>
                </motion.li>
              ))}
            </ul>
          </motion.nav>
        </div>

        {/* Divider */}
        <div className="my-12 h-px bg-gradient-to-r from-transparent via-slate-800/60 to-transparent" />

        {/* Bottom bar */}
        <div className="flex flex-col items-center justify-between gap-5 sm:flex-row">
          <p className="text-[12px] text-slate-500">
            © {new Date().getFullYear()} {footerData.brand.name}. All rights reserved.
          </p>

          <nav aria-label="Legal">
            <ul className="flex flex-wrap items-center justify-center gap-6">
              {footerData.legal.map((link, idx) => (
                <li key={link.label} className="flex items-center gap-6">
                  <Link
                    to={link.to}
            
                    className="text-[12px] text-slate-500 transition-colors duration-200 hover:text-slate-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/50 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 rounded-sm"
                  >
                    {link.label}
                  </Link>
                  {idx < footerData.legal.length - 1 && (
                    <span
                      className="hidden h-3 w-px bg-slate-800 sm:block"
                      aria-hidden="true"
                    />
                  )}
                </li>
              ))}
            </ul>
          </nav>
        </div>
      </div>
    </motion.footer>
  );
}