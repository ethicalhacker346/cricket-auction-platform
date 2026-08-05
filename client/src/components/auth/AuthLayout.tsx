import { type ReactNode } from "react";
import { motion } from "framer-motion";
import { Gavel, ShieldCheck, Radio, TrendingUp } from "lucide-react";
import { Logo } from "@/components/auth/Logo";

interface AuthLayoutProps {
  title: string;
  subtitle: string;
  children: ReactNode;
  footer?: ReactNode;
}

const HIGHLIGHTS = [
  { icon: Radio, text: "Live, real-time bidding rooms" },
  { icon: ShieldCheck, text: "Verified players & secure escrow" },
  { icon: Gavel, text: "Built for organizers who move fast" },
];

export function AuthLayout({ title, subtitle, children, footer }: AuthLayoutProps) {
  return (
    <div className="relative flex min-h-screen w-full overflow-hidden bg-slate-950">
      {/* Ambient background blobs (mobile + fallback) */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden lg:hidden">
        <div className="absolute -left-20 -top-20 h-72 w-72 rounded-full bg-emerald-500/20 blur-3xl" />
        <div className="absolute -bottom-24 -right-10 h-72 w-72 rounded-full bg-teal-500/20 blur-3xl" />
      </div>

      {/* Left branding panel */}
      <div className="relative hidden w-[46%] flex-col justify-between overflow-hidden p-12 lg:flex">
        <img
          src="/images/auth-hero.jpg"
          alt=""
          className="absolute inset-0 h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-br from-slate-950/95 via-slate-950/80 to-emerald-950/70" />
        <div className="absolute -left-24 top-1/3 h-72 w-72 rounded-full bg-emerald-500/20 blur-3xl" />

        <motion.div
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="relative z-10"
        >
          <Logo />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.15 }}
          className="relative z-10 space-y-8"
        >
          <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3.5 py-1.5 text-xs font-medium text-emerald-300 backdrop-blur">
            <TrendingUp className="h-3.5 w-3.5" />
            India's fastest-growing cricket auction platform
          </div>
          <h1 className="max-w-md text-4xl font-bold leading-tight tracking-tight text-white">
            Where every player finds their team, one bid at a time.
          </h1>
          <p className="max-w-sm text-sm leading-relaxed text-slate-300">
            Join thousands of players, franchise owners, and organizers running
            transparent, adrenaline-filled cricket auctions on GullyBid.
          </p>

          <ul className="space-y-3">
            {HIGHLIGHTS.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-center gap-3 text-sm text-slate-200">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/10 text-emerald-300 backdrop-blur">
                  <Icon className="h-4 w-4" />
                </span>
                {text}
              </li>
            ))}
          </ul>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.35 }}
          className="relative z-10 flex items-center gap-4 rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur"
        >
          <div className="flex -space-x-2">
            {["A", "R", "S", "K"].map((letter) => (
              <div
                key={letter}
                className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-slate-950 bg-gradient-to-br from-emerald-400 to-teal-600 text-xs font-bold text-white"
              >
                {letter}
              </div>
            ))}
          </div>
          <p className="text-xs leading-snug text-slate-300">
            <span className="font-semibold text-white">12,000+</span> players &
            franchises already building squads on GullyBid.
          </p>
        </motion.div>
      </div>

      {/* Right form panel */}
      <div className="relative flex w-full flex-1 items-center justify-center bg-gradient-to-br from-slate-50 via-white to-emerald-50/40 px-6 py-12 sm:px-10">
        <div className="pointer-events-none absolute inset-0 [background-image:radial-gradient(circle_at_1px_1px,rgba(15,23,42,0.06)_1px,transparent_0)] [background-size:22px_22px]" />

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: "easeOut" }}
          className="relative z-10 w-full max-w-md"
        >
          <div className="mb-8 flex flex-col items-start gap-6 lg:hidden">
            <Logo />
          </div>

          <div className="rounded-3xl border border-slate-200/70 bg-white/80 p-7 shadow-xl shadow-slate-900/5 backdrop-blur-xl sm:p-9">
            <div className="mb-7">
              <h2 className="text-2xl font-bold tracking-tight text-slate-900">{title}</h2>
              <p className="mt-1.5 text-sm text-slate-500">{subtitle}</p>
            </div>
            {children}
          </div>

          {footer && <div className="mt-6 text-center">{footer}</div>}
        </motion.div>
      </div>
    </div>
  );
}