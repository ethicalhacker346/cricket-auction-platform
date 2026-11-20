import { motion } from "framer-motion";
import { Users, Wallet, Shield, Target, LayoutGrid } from "lucide-react";

const ROSTER_EXAMPLE = [
  {
    name: "Rohit Sharma",
    role: "Batsman",
    price: 1200000,
    color: "bg-sky-500",
  },
  {
    name: "Jasprit Bumrah",
    role: "Bowler",
    price: 1100000,
    color: "bg-rose-500",
  },
  {
    name: "Hardik Pandya",
    role: "All-Rounder",
    price: 900000,
    color: "bg-amber-500",
  },
  {
    name: "Rishabh Pant",
    role: "Wicket-Keeper",
    price: 850000,
    color: "bg-emerald-500",
  },
  { name: "Shubman Gill", role: "Batsman", price: 800000, color: "bg-sky-500" },
  {
    name: "Mohammed Shami",
    role: "Bowler",
    price: 700000,
    color: "bg-rose-500",
  },
  {
    name: "Ravindra Jadeja",
    role: "All-Rounder",
    price: 650000,
    color: "bg-amber-500",
  },
  { name: "KL Rahul", role: "Batsman", price: 600000, color: "bg-sky-500" },
  {
    name: "Kuldeep Yadav",
    role: "Bowler",
    price: 450000,
    color: "bg-rose-500",
  },
  {
    name: "Suryakumar Yadav",
    role: "Batsman",
    price: 400000,
    color: "bg-sky-500",
  },
  {
    name: "Axar Patel",
    role: "All-Rounder",
    price: 350000,
    color: "bg-amber-500",
  },
];

const EXAMPLE_SQUAD_SIZE = 15;
const EXAMPLE_PURSE = 10000000;

const ROLE_META: Record<string, { label: string; color: string; bg: string }> =
  {
    Batsman: { label: "BAT", color: "text-sky-700", bg: "bg-sky-50" },
    Bowler: { label: "BOWL", color: "text-rose-700", bg: "bg-rose-50" },
    "All-Rounder": { label: "AR", color: "text-amber-700", bg: "bg-amber-50" },
    "Wicket-Keeper": {
      label: "WK",
      color: "text-emerald-700",
      bg: "bg-emerald-50",
    },
  };

function SquadGrid() {
  const squadSize = EXAMPLE_SQUAD_SIZE;
  const filled = ROSTER_EXAMPLE.length;
  const remaining = Math.max(0, squadSize - filled);

  return (
    <div className="rounded-none bg-slate-950 p-8 ring-1 ring-white/5">
      <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h3 className="text-sm font-semibold text-white">
            Squad Composition
          </h3>
          <p className="mt-1 text-xs text-slate-400">
            Example squad · {filled} of {squadSize} slots filled
          </p>
        </div>
        <div className="flex w-full max-w-48 gap-1" aria-hidden="true">
          {Array.from({ length: squadSize }).map((_, i) => (
            <div
              key={i}
              className={`h-1.5 min-w-0 flex-1 ${i < filled ? "bg-indigo-500" : "bg-slate-800"}`}
            />
          ))}
        </div>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {ROSTER_EXAMPLE.map((player) => (
          <div
            key={player.name}
            className="flex flex-col justify-between bg-slate-900 p-3 ring-1 ring-white/5"
          >
            <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
              <span className={`h-2 w-2 rounded-full ${player.color}`} />
              <span
                className={`rounded-sm px-1.5 py-0.5 text-[9px] font-bold ${ROLE_META[player.role].bg} ${ROLE_META[player.role].color}`}
              >
                {ROLE_META[player.role].label}
              </span>
            </div>
            <p className="mt-2 text-[11px] font-semibold text-white truncate">
              {player.name}
            </p>
            <p className="mt-0.5 font-mono text-[10px] text-slate-500">
              ₹{(player.price / 100000).toFixed(1)}L
            </p>
          </div>
        ))}
        {Array.from({ length: remaining }).map((_, i) => (
          <div
            key={`empty-${i}`}
            className="flex h-20 items-center justify-center border border-dashed border-slate-800"
          >
            <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
              Empty
            </span>
          </div>
        ))}
      </div>

      <div className="mt-6 flex flex-col justify-between gap-4 border-t border-slate-800 pt-4 text-xs sm:flex-row">
        <div className="flex flex-wrap gap-3">
          {Object.entries(ROLE_META).map(([role, meta]) => {
            const count = ROSTER_EXAMPLE.filter((p) => p.role === role).length;
            return (
              <div key={role} className="flex items-center gap-1.5">
                <span
                  className={`h-1.5 w-1.5 rounded-full ${meta.bg.replace("bg-", "bg-").replace("50", "500")}`}
                />
                <span className="text-slate-400">
                  {meta.label}: <span className="text-slate-200">{count}</span>
                </span>
              </div>
            );
          })}
        </div>
        <span className="font-mono text-slate-500">
          Total: ₹
          {(ROSTER_EXAMPLE.reduce((a, p) => a + p.price, 0) / 100000).toFixed(
            1,
          )}
          L
        </span>
      </div>
    </div>
  );
}

function BudgetBreakdown() {
  const initial = EXAMPLE_PURSE;
  const spent = ROSTER_EXAMPLE.reduce((a, p) => a + p.price, 0);
  const remaining = initial - spent;
  const avg = spent / ROSTER_EXAMPLE.length;
  const slotsRemaining = Math.max(
    0,
    EXAMPLE_SQUAD_SIZE - ROSTER_EXAMPLE.length,
  );

  return (
    <div className="rounded-none bg-white p-8 ring-1 ring-slate-200">
      <h3 className="text-sm font-semibold text-slate-900">
        Budget Mathematics
      </h3>
      <p className="mt-1 text-xs text-slate-500">
        How purse allocation works across your squad
      </p>

      <div className="mt-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
          <span className="text-sm text-slate-600">Initial Purse</span>
          <span className="font-mono text-sm font-bold text-slate-900">
            ₹{initial.toLocaleString("en-IN")}
          </span>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
          <span className="text-sm text-slate-600">Total Spent</span>
          <span className="font-mono text-sm font-bold text-indigo-600">
            ₹{spent.toLocaleString("en-IN")}
          </span>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
          <span className="text-sm text-slate-600">Remaining</span>
          <span className="font-mono text-sm font-bold text-emerald-600">
            ₹{remaining.toLocaleString("en-IN")}
          </span>
        </div>
        <div className="h-px bg-slate-100" />
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
          <span className="text-sm text-slate-600">Average per Player</span>
          <span className="font-mono text-sm font-bold text-slate-900">
            ₹{Math.round(avg).toLocaleString("en-IN")}
          </span>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
          <span className="text-sm text-slate-600">Slots Remaining</span>
          <span className="font-mono text-sm font-bold text-slate-900">
            {slotsRemaining}
          </span>
        </div>
      </div>

      <div className="mt-6 rounded-sm bg-slate-50 p-4">
        <p className="text-xs font-semibold text-slate-700">Strategy Note</p>
        <p className="mt-1 text-[11px] leading-relaxed text-slate-500">
          With {slotsRemaining} slots left and ₹
          {remaining.toLocaleString("en-IN")} remaining, your max average spend
          per remaining slot is ₹
          {(slotsRemaining > 0
            ? Math.floor(remaining / slotsRemaining)
            : 0
          ).toLocaleString("en-IN")}
          . Adjust your bidding aggression accordingly.
        </p>
      </div>
    </div>
  );
}

export default function SquadRulesPage() {
  return (
    <div className="space-y-16">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div className="flex items-center gap-2 text-indigo-600">
          <Users className="h-5 w-5" />
          <span className="text-xs font-bold uppercase tracking-widest">
            Build Your Dream XI
          </span>
        </div>
        <h1 className="mt-3 text-4xl font-extrabold tracking-tight text-slate-900 lg:text-5xl">
          Squad Rules
        </h1>
        <p className="mt-4 max-w-2xl text-lg leading-relaxed text-slate-500">
          Squad construction is constrained by size limits, budget caps, and
          auction dynamics. Master the math before you enter the room.
        </p>
      </motion.div>

      {/* Limits */}
      <section className="grid gap-6 sm:grid-cols-3">
        {[
          {
            icon: LayoutGrid,
            label: "Squad Size",
            value: "11–25 players",
            desc: "Set by tournament organizer",
          },
          {
            icon: Wallet,
            label: "Purse",
            value: "₹50L – ₹100Cr",
            desc: "Uniform across all teams",
          },
          {
            icon: Shield,
            label: "Roster Lock",
            value: "Post-auction",
            desc: "No trades unless organizer permits",
          },
        ].map((card) => (
          <div
            key={card.label}
            className="rounded-none bg-white p-6 ring-1 ring-slate-200"
          >
            <card.icon className="h-5 w-5 text-indigo-600" />
            <p className="mt-3 text-2xl font-bold text-slate-900">
              {card.value}
            </p>
            <p className="mt-1 text-sm font-semibold text-slate-700">
              {card.label}
            </p>
            <p className="mt-2 text-xs text-slate-500">{card.desc}</p>
          </div>
        ))}
      </section>

      {/* Composition */}
      <section className="grid gap-8 lg:grid-cols-5">
        <div className="lg:col-span-3">
          <SquadGrid />
        </div>
        <div className="lg:col-span-2">
          <BudgetBreakdown />
        </div>
      </section>

      {/* Role Balance */}
      <section className="rounded-none bg-white p-8 ring-1 ring-slate-200">
        <h2 className="text-xl font-bold text-slate-900">
          Role Balance Recommendations
        </h2>
        <p className="mt-2 text-sm text-slate-500">
          While the platform enforces only squad size and budget, competitive
          balance suggests these distributions.
        </p>

        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            {
              role: "Batsmen",
              target: "4–5",
              reason: "Core of your batting lineup",
              color: "border-sky-500",
            },
            {
              role: "Bowlers",
              target: "4–5",
              reason: "Variety in pace and spin",
              color: "border-rose-500",
            },
            {
              role: "All-Rounders",
              target: "2–3",
              reason: "Flexibility in team composition",
              color: "border-amber-500",
            },
            {
              role: "Wicket-Keepers",
              target: "1–2",
              reason: "At least one specialist",
              color: "border-emerald-500",
            },
          ].map((item) => (
            <div
              key={item.role}
              className={`border-l-2 ${item.color} bg-slate-50 p-5`}
            >
              <p className="text-sm font-bold text-slate-900">{item.role}</p>
              <p className="mt-1 text-lg font-bold text-slate-700">
                {item.target}
              </p>
              <p className="mt-2 text-xs text-slate-500">{item.reason}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Constraints */}
      <section className="rounded-none bg-slate-950 p-8 ring-1 ring-white/5">
        <h3 className="text-sm font-semibold text-white">Hard Constraints</h3>
        <div className="mt-6 space-y-3">
          {[
            "You cannot exceed the tournament's squad size limit under any circumstances.",
            "You cannot place a bid that would reduce your remaining budget below zero.",
            "A player's bought price is permanent. There is no post-auction price adjustment.",
            "Roster order does not affect gameplay — it is for organizational clarity only.",
            "Force Unsold defers a player: Unsold Round-1, Unsold Round-2 and later numbered passes are generated as needed, with one offer per player per pass.",
            "Permanent Unsold excludes a player from every later pass. Only organizer undo can reverse the recorded decision; no team can bid on a retired player.",
          ].map((rule, i) => (
            <div key={i} className="flex items-start gap-3">
              <Target className="mt-0.5 h-3.5 w-3.5 shrink-0 text-indigo-400" />
              <p className="text-xs leading-relaxed text-slate-400">{rule}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
