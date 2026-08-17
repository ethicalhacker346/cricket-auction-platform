import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import {
  ArrowUpRight,
  MapPin,
  Wrench,
  Flame,
  Trophy,
  Calendar,
  Mail,
  Radio,
  ChevronRight,
  MessageCircle,
  Crown,
  Target,
  Zap,
} from "lucide-react";

const EDUCATION = [
  {
    degree: "B.Tech",
    field: "Mechanical Engineering",
    school: "NSRIT Engineering College",
    year: "2018 – 2022",
    icon: Wrench,
    color: "text-slate-200",
    desc: "Systems thinking, kinematics, and material stress — the foundation for understanding how distributed auction components interact under load.",
  },
  {
    degree: "M.Tech",
    field: "Thermal Engineering",
    school: "NSRIT Engineering College",
    year: "2022 – 2024",
    icon: Flame,
    color: "text-amber-400",
    desc: "Heat transfer, energy dynamics, and fluid behavior — directly analogous to bid momentum, wallet pressure, and tournament flow states.",
  },
];

const PHILOSOPHY = [
  {
    title: "Systems Thinking",
    body: "A cricket auction is a multi-body dynamics problem. Teams, wallets, timers, and lots interact like pistons in an engine. Mechanical engineering taught me to model these forces before writing a single line of code.",
  },
  {
    title: "Thermal Dynamics",
    body: "Auction rooms heat up. Bid velocity accelerates. Pressure builds around purse limits. Thermal engineering gave me the intuition to design cooling mechanisms — bid reset timers, reservation releases, and round-based cooldowns.",
  },
  {
    title: "Field Perspective",
    body: "I don't just build cricket software — I play the game. I know what it feels like to wait for your name in the auction pool. That empathy is baked into every registration flow and every lot settlement.",
  },
];

const ROHIT_STATS = [
  { label: "International Hundreds", value: "48", suffix: "+" },
  { label: "IPL Titles", value: "5", suffix: "" },
  { label: "ODI Double Hundreds", value: "3", suffix: "" },
  { label: "T20I Sixes", value: "200", suffix: "+" },
];

/* Inline SVGs for brand accuracy */
function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
  );
}

function InstagramIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" />
    </svg>
  );
}

export default function CreatorPage() {
  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
          <Link
            to="/dashboard"
            className="flex items-center gap-2 text-sm font-medium text-slate-600 transition-colors hover:text-slate-900"
          >
            <ArrowUpRight className="h-4 w-4 rotate-[-135deg]" />
            Back to Dashboard
          </Link>
          <div className="flex items-center gap-2.5">
            <div className="flex h-7 w-7 items-center justify-center bg-slate-900">
              <span className="text-xs font-bold text-white">GB</span>
            </div>
            <span className="text-sm font-semibold text-slate-900">GullyBid</span>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-6 py-16 lg:py-24">
        {/* ═══════════════════════════════════════════════════════════
           HERO — Split architectural composition
           ═══════════════════════════════════════════════════════════ */}
        <div className="grid gap-12 lg:grid-cols-12 lg:gap-8">
          {/* Image Column */}
          <motion.div
            initial={{ opacity: 0, x: -40 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
            className="relative lg:col-span-5"
          >
            <div className="relative aspect-[3/4] overflow-hidden bg-slate-200">
              <img
                src="/venkata-sai-p.png"
                alt="Venkata Sai P"
                className="h-full w-full object-cover"
              />
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-slate-950/60 via-transparent to-transparent" />
              <div className="absolute bottom-6 left-6 right-6">
                <div className="flex items-center gap-2 text-white/80">
                  <MapPin className="h-3.5 w-3.5" />
                  <span className="text-[11px] font-semibold uppercase tracking-widest">
                    Visakhapatnam, India
                  </span>
                </div>
              </div>
            </div>

            <div className="absolute -right-4 top-12 hidden flex-col gap-3 lg:flex">
              <div className="flex h-10 w-10 items-center justify-center bg-slate-900 text-xs font-bold text-white">
                VS
              </div>
              <div className="h-24 w-px bg-slate-300" />
            </div>
          </motion.div>

          {/* Text Column */}
          <div className="flex flex-col justify-center lg:col-span-7 lg:pl-12">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.15 }}
            >
              <div className="flex items-center gap-2 text-amber-600">
                <Radio className="h-4 w-4" />
                <span className="text-xs font-bold uppercase tracking-widest">
                  Architect & Founder
                </span>
              </div>

              <h1 className="mt-6 text-5xl font-extrabold tracking-tight text-slate-900 lg:text-7xl">
                VENKATA
                <br />
                SAI <span className="text-amber-600">P</span>
              </h1>

              <p className="mt-6 max-w-lg text-lg leading-relaxed text-slate-500">
                Mechanical engineer by training. Thermal engineer by specialization. 
                Cricket player by passion. Platform architect by obsession.
              </p>

              <div className="mt-8 flex flex-wrap gap-4">
                {/*<div className="flex items-center gap-2 rounded-none bg-slate-900 px-4 py-2.5 text-xs font-bold text-white">
                  <Calendar className="h-3.5 w-3.5" />
                  25 OCT 2000
                </div> */}
                <div className="flex items-center gap-2 rounded-none bg-amber-100 px-4 py-2.5 text-xs font-bold text-amber-800">
                  <Trophy className="h-3.5 w-3.5" />
                  Cricketer
                </div>
                <div className="flex items-center gap-2 rounded-none bg-slate-100 px-4 py-2.5 text-xs font-bold text-slate-700">
                  <MapPin className="h-3.5 w-3.5" />
                  Mutcherla, Visakhapatnam
                </div>
              </div>

              <div className="mt-10 border-l-2 border-amber-500 pl-6">
                <p className="text-sm font-medium italic text-slate-600">
                  "I built GullyBid because I was tired of cricket auctions being managed 
                  in WhatsApp groups and Excel sheets. A mechanical engineer sees chaos 
                  and builds the machine to tame it."
                </p>
              </div>
            </motion.div>
          </div>
        </div>

        {/* ═══════════════════════════════════════════════════════════
           EDUCATION — Brutalist timeline
           ═══════════════════════════════════════════════════════════ */}
        <section className="mt-32">
          <div className="flex items-center gap-3">
            <div className="h-px flex-1 bg-slate-200" />
            <span className="text-[11px] font-bold uppercase tracking-[0.25em] text-slate-400">
              Academic Foundation
            </span>
            <div className="h-px flex-1 bg-slate-200" />
          </div>

          <div className="mt-12 grid gap-8 lg:grid-cols-2">
            {EDUCATION.map((edu, i) => (
              <motion.div
                key={edu.degree}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.15 }}
                className="group relative overflow-hidden rounded-none bg-white ring-1 ring-slate-200"
              >
                <div className="absolute left-0 top-0 h-full w-1 bg-slate-900 transition-all group-hover:w-1.5 group-hover:bg-amber-500" />
                <div className="p-8">
                  <div className="flex items-start justify-between">
                    <div className="flex h-12 w-12 items-center justify-center bg-slate-100">
                      <edu.icon className="h-6 w-6 text-slate-700" />
                    </div>
                    <span className="font-mono text-xs font-bold text-slate-400">
                      {edu.year}
                    </span>
                  </div>

                  <h3 className="mt-6 text-2xl font-bold text-slate-900">
                    {edu.degree}
                  </h3>
                  <p className={`text-sm font-semibold ${edu.color}`}>
                    {edu.field}
                  </p>
                  <p className="mt-1 text-xs font-medium uppercase tracking-wider text-slate-400">
                    {edu.school}
                  </p>

                  <p className="mt-4 text-sm leading-relaxed text-slate-500">
                    {edu.desc}
                  </p>
                </div>
              </motion.div>
            ))}
          </div>
        </section>

        {/* ═══════════════════════════════════════════════════════════
           PHILOSOPHY — Three pillars
           ═══════════════════════════════════════════════════════════ */}
        <section className="mt-32 rounded-none bg-slate-950 p-8 ring-1 ring-white/5 lg:p-16">
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
          >
            <div className="flex items-center gap-2 text-amber-400">
              <Wrench className="h-4 w-4" />
              <span className="text-xs font-bold uppercase tracking-widest">
                Engineering Philosophy
              </span>
            </div>
            <h2 className="mt-4 text-3xl font-bold text-white lg:text-4xl">
              From Thermodynamics to Tournament Dynamics
            </h2>

            <div className="mt-12 grid gap-8 md:grid-cols-3">
              {PHILOSOPHY.map((item, i) => (
                <div key={item.title} className="border-l border-slate-800 pl-6">
                  <span className="font-mono text-4xl font-bold text-slate-800">
                    0{i + 1}
                  </span>
                  <h3 className="mt-4 text-sm font-bold text-white">
                    {item.title}
                  </h3>
                  <p className="mt-3 text-xs leading-relaxed text-slate-400">
                    {item.body}
                  </p>
                </div>
              ))}
            </div>
          </motion.div>
        </section>

        {/* ═══════════════════════════════════════════════════════════
           CRICKET — The human connection
           ═══════════════════════════════════════════════════════════ */}
        <section className="mt-32 grid gap-12 lg:grid-cols-2">
          <div>
            <div className="flex items-center gap-2 text-indigo-600">
              <Trophy className="h-5 w-5" />
              <span className="text-xs font-bold uppercase tracking-widest">
                The Player
              </span>
            </div>
            <h2 className="mt-4 text-3xl font-bold text-slate-900">
              Cricket Is Not a Feature.
              <br />
              It Is the Foundation.
            </h2>
            <p className="mt-6 text-sm leading-relaxed text-slate-500">
              I grew up playing cricket in the gullies of Visakhapatnam. I know the 
              anxiety of waiting for your name to be called. I know the politics of 
              team selection. I know the euphoria of a last-over finish.
            </p>
            <p className="mt-4 text-sm leading-relaxed text-slate-500">
              GullyBid was not built in a boardroom. It was built between net sessions, 
              after engineering lectures, and during late-night coding sprints fueled by 
              the same competitive fire that drives a Super Over.
            </p>

            <div className="mt-8 grid grid-cols-2 gap-4">
              <div className="rounded-none bg-white p-5 ring-1 ring-slate-200">
                <p className="text-3xl font-bold text-slate-900">25</p>
                <p className="mt-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Years Young
                </p>
              </div>
              <div className="rounded-none bg-white p-5 ring-1 ring-slate-200">
                <p className="text-3xl font-bold text-slate-900">2</p>
                <p className="mt-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Engineering Degrees
                </p>
              </div>
            </div>
          </div>

          <div className="relative">
            <div className="aspect-square overflow-hidden bg-slate-200">
              <img
                src="/venkata-sai-p.png"
                alt="Venkata Sai with Royal Enfield"
                className="h-full w-full object-cover object-top"
              />
            </div>
            <div className="absolute -bottom-6 -left-6 max-w-xs rounded-none bg-white p-5 shadow-xl ring-1 ring-slate-200">
              <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Machine & Mind
              </p>
              <p className="mt-2 text-sm font-medium text-slate-700">
                The Royal Enfield taught me that raw power means nothing without 
                precision control. The same applies to auction architecture.
              </p>
            </div>
          </div>
        </section>

        {/* ═══════════════════════════════════════════════════════════
           ROHIT SHARMA — The Idol (IMAGE-CENTRIC)
           ═══════════════════════════════════════════════════════════ */}
        <section className="mt-32">
          <div className="flex items-center gap-3">
            <div className="h-px flex-1 bg-slate-200" />
            <span className="text-[11px] font-bold uppercase tracking-[0.25em] text-slate-400">
              The Idol
            </span>
            <div className="h-px flex-1 bg-slate-200" />
          </div>

          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7 }}
            className="relative mt-12 overflow-hidden rounded-none bg-slate-950 ring-1 ring-white/5"
          >
            {/* Giant watermark */}
            <div className="pointer-events-none absolute -right-4 -top-12 font-mono text-[14rem] font-bold leading-none text-white/[0.015] select-none lg:text-[20rem]">
              45
            </div>

            {/* ═══ IMAGE HERO ═══ */}
            <div className="relative h-[24rem] sm:h-[28rem] lg:h-[36rem]">
              {/* 
                IMPORTANT: Save your Rohit Sharma image in the public folder as:
                /public/rohit-sharma.jpg
                (Update the src below if you use a different filename)
              */}
              <img
                src="/image.png"
                alt="Rohit Sharma - ICC Champions Trophy 2025"
                className="h-full w-full object-cover object-[center_15%]"
              />

              {/* Multi-layer gradient for text legibility */}
              <div className="absolute inset-0 bg-gradient-to-r from-slate-950 via-slate-950/40 to-transparent" />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-transparent to-slate-950/20" />
              <div className="absolute inset-0 bg-slate-950/10" />

              {/* Content overlay */}
              <div className="absolute inset-0 flex flex-col justify-end p-8 lg:p-16">
                <div className="grid gap-8 lg:grid-cols-2 lg:items-end">
                  {/* Left: Identity */}
                  <div>
                    <div className="flex items-center gap-2 text-amber-500">
                      <Crown className="h-4 w-4" />
                      <span className="text-xs font-bold uppercase tracking-widest">
                        The Hitman
                      </span>
                    </div>

                    <h2 className="mt-4 text-5xl font-extrabold tracking-tight text-white lg:text-7xl">
                      ROHIT
                      <br />
                      SHARMA
                    </h2>

                    <p className="mt-4 max-w-sm text-sm leading-relaxed text-slate-300">
                      Not just a batsman. A{" "}
                      <strong className="text-white">systems operator</strong>. He
                      doesn't chase the ball — he waits for it. He doesn't panic
                      when the asking rate climbs — he accelerates precisely when
                      the pressure valve demands it.
                    </p>
                  </div>

                  {/* Right: Quote */}
                  <div className="hidden lg:block">
                    <div className="border-l-2 border-amber-500/40 pl-6">
                      <p className="text-lg italic leading-relaxed text-slate-200">
                        "I like to be calm when the situation is heated. That is
                        when the biggest shots are played."
                      </p>
                      <p className="mt-3 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                        — Rohit Sharma
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Floating badge */}
              <div className="absolute right-6 top-6 hidden sm:block">
                <div className="rounded-none bg-slate-950/80 px-4 py-2 backdrop-blur-sm ring-1 ring-white/10">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-amber-400">
                    India Captain
                  </p>
                  <p className="mt-0.5 text-[10px] font-mono text-slate-400">
                    ICC Champions Trophy 2025
                  </p>
                </div>
              </div>
            </div>

            {/* ═══ CONTENT GRID ═══ */}
            <div className="grid gap-8 p-8 lg:grid-cols-12 lg:p-16">
              {/* Left: Philosophy bridge */}
              <div className="lg:col-span-7">
                <div className="flex items-center gap-2 text-indigo-400">
                  <Target className="h-4 w-4" />
                  <span className="text-xs font-bold uppercase tracking-widest">
                    Why He Inspires the Platform
                  </span>
                </div>

                <div className="mt-6 space-y-4">
                  <div className="flex gap-4">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center bg-slate-900 ring-1 ring-white/5">
                      <Zap className="h-4 w-4 text-amber-500" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-white">
                        Timing Over Chaos
                      </h4>
                      <p className="mt-1 text-xs leading-relaxed text-slate-400">
                        Rohit doesn't swing at every ball. GullyBid doesn't flood
                        users with notifications — it surfaces the right signal at
                        the right moment, like a perfectly timed pull shot.
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-4">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center bg-slate-900 ring-1 ring-white/5">
                      <Zap className="h-4 w-4 text-amber-500" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-white">
                        Calm Under Pressure
                      </h4>
                      <p className="mt-1 text-xs leading-relaxed text-slate-400">
                        When the auction timer hits 3 seconds and a bid arrives,
                        the system extends calmly — no panic, no crashes. Just
                        like Rohit in the 45th over with 12 runs needed.
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-4">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center bg-slate-900 ring-1 ring-white/5">
                      <Zap className="h-4 w-4 text-amber-500" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-white">
                        Elegance in Power
                      </h4>
                      <p className="mt-1 text-xs leading-relaxed text-slate-400">
                        A 264-run innings looks effortless because the mechanics
                        are perfect. GullyBid's UI looks simple because the
                        architecture beneath is ruthlessly engineered.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Right: Stats */}
              <div className="lg:col-span-5">
                <div className="grid grid-cols-2 gap-3">
                  {ROHIT_STATS.map((stat, i) => (
                    <motion.div
                      key={stat.label}
                      initial={{ opacity: 0, y: 20 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      viewport={{ once: true }}
                      transition={{ delay: 0.3 + i * 0.1 }}
                      className="relative overflow-hidden bg-slate-900 p-5 ring-1 ring-white/5"
                    >
                      <div className="absolute -right-2 -top-2 font-mono text-5xl font-bold text-white/[0.03]">
                        {stat.value}
                      </div>
                      <p className="relative text-2xl font-bold text-white lg:text-3xl">
                        {stat.value}
                        <span className="text-lg text-amber-500">
                          {stat.suffix}
                        </span>
                      </p>
                      <p className="relative mt-2 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                        {stat.label}
                      </p>
                    </motion.div>
                  ))}
                </div>

                <div className="mt-4 rounded-none bg-slate-900/50 p-5 ring-1 ring-white/5">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    Playing Style
                  </p>
                  <p className="mt-2 text-xs leading-relaxed text-slate-400">
                    Right-hand bat • Occasional right-arm off break • Top-order
                    • The man who sees the field before the bowler delivers.
                  </p>
                </div>
              </div>
            </div>

            {/* Bottom strip */}
            <div className="border-t border-white/5 bg-slate-900/50 px-8 py-4 lg:px-16">
              <p className="text-center text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">
                Jersey No. 45 • Mumbai Indians • India Captain • ICC Champions
                Trophy 2025 • The Hitman
              </p>
            </div>
          </motion.div>
        </section>

        {/* ═══════════════════════════════════════════════════════════
           ORIGIN — Location card
           ═══════════════════════════════════════════════════════════ */}
        <section className="mt-32">
          <div className="grid gap-8 lg:grid-cols-3">
            <div className="lg:col-span-1">
              <div className="flex items-center gap-2 text-amber-600">
                <MapPin className="h-4 w-4" />
                <span className="text-xs font-bold uppercase tracking-widest">
                  Origin
                </span>
              </div>
              <h2 className="mt-4 text-2xl font-bold text-slate-900">
                Mutcherla,
                <br />
                Visakhapatnam,
                <br />
                Andhra Pradesh
              </h2>
              <p className="mt-4 text-sm leading-relaxed text-slate-500">
                A coastal town where engineering precision meets cricket passion.
                Built in India, for the world's cricket community.
              </p>
            </div>

            <div className="lg:col-span-2">
              <div className="grid gap-4 sm:grid-cols-3">
                {[
                  { label: "Country", value: "India" },
                  { label: "State", value: "Andhra Pradesh" },
                  { label: "City", value: "Visakhapatnam" },
                  { label: "Village", value: "Mutcherla" },
                  { label: "College", value: "NSRIT" },
                  { label: "Passion", value: "Cricket" },
                ].map((item) => (
                  <div
                    key={item.label}
                    className="flex flex-col justify-between rounded-none bg-white p-5 ring-1 ring-slate-200"
                  >
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      {item.label}
                    </span>
                    <span className="mt-3 text-lg font-bold text-slate-900">
                      {item.value}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ═══════════════════════════════════════════════════════════
           CTA — Connect + Social Links
           ═══════════════════════════════════════════════════════════ */}
        <section className="mt-32 rounded-none bg-slate-900 p-8 lg:p-16">
          <div className="mx-auto max-w-3xl text-center">
            <div className="flex items-center justify-center gap-2 text-amber-400">
              <MessageCircle className="h-4 w-4" />
              <span className="text-xs font-bold uppercase tracking-widest">
                Open Channel
              </span>
            </div>

            <h2 className="mt-4 text-2xl font-bold text-white lg:text-4xl">
              Let's Talk Cricket & Code
            </h2>
            <p className="mt-4 text-sm leading-relaxed text-slate-400">
              Whether you're an organizer streamlining tournaments, a franchise
              owner optimizing bids, or a developer fascinated by auction
              algorithms — my inbox and DMs are open.
            </p>

            {/* Primary Actions */}
            <div className="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row">
              <a
                href="mailto:pvsram346@gmail.com"
                className="flex items-center gap-2 rounded-none bg-white px-8 py-3 text-sm font-bold text-slate-900 shadow-lg transition-all hover:bg-slate-100 hover:shadow-xl"
              >
                <Mail className="h-4 w-4" />
                Email Me
              </a>
              <Link
                to="/dashboard"
                className="flex items-center gap-2 rounded-none bg-slate-800 px-8 py-3 text-sm font-bold text-slate-300 transition-colors hover:bg-slate-700"
              >
                Explore the Platform
                <ChevronRight className="h-4 w-4" />
              </Link>
            </div>

            {/* Social Links */}
            <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
              <a
                href="https://wa.me/917075002630"
                target="_blank"
                rel="noopener noreferrer"
                className="group flex w-full items-center justify-center gap-3 rounded-none bg-emerald-500/10 px-6 py-3 ring-1 ring-emerald-500/20 transition-all hover:bg-emerald-500 hover:shadow-lg hover:shadow-emerald-500/20 sm:w-auto"
              >
                <WhatsAppIcon className="h-5 w-5 text-emerald-400 transition-colors group-hover:text-white" />
                <div className="text-left">
                  <p className="text-xs font-bold text-emerald-400 transition-colors group-hover:text-white">
                    WhatsApp
                  </p>
                  <p className="text-[10px] text-emerald-600/70 transition-colors group-hover:text-emerald-100">
                    Fastest response
                  </p>
                </div>
              </a>

              <a
                href="https://www.instagram.com/___.alpha.__25/"
                target="_blank"
                rel="noopener noreferrer"
                className="group flex w-full items-center justify-center gap-3 rounded-none bg-rose-500/10 px-6 py-3 ring-1 ring-rose-500/20 transition-all hover:bg-rose-500 hover:shadow-lg hover:shadow-rose-500/20 sm:w-auto"
              >
                <InstagramIcon className="h-5 w-5 text-rose-400 transition-colors group-hover:text-white" />
                <div className="text-left">
                  <p className="text-xs font-bold text-rose-400 transition-colors group-hover:text-white">
                    Instagram
                  </p>
                  <p className="text-[10px] text-rose-600/70 transition-colors group-hover:text-rose-100">
                    Behind the scenes
                  </p>
                </div>
              </a>
            </div>

            <p className="mt-8 text-[11px] text-slate-600">
              Based in Visakhapatnam, India (IST +5:30) • Usually responds
              within 24 hours
            </p>
          </div>
        </section>

        {/* Footer attribution */}
        <div className="mt-16 border-t border-slate-200 pt-8 text-center">
          <p className="text-xs text-slate-400">
            © {new Date().getFullYear()} GullyBid. Designed and built by Venkata
            Sai P.
          </p>
        </div>
      </main>
    </div>
  );
}