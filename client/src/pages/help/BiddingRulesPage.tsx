import { useState } from "react";
import { motion } from "framer-motion";
import {
  Wallet,
  Timer,
  TrendingUp,
  AlertCircle,
  ArrowRight,
  RefreshCcw,
  Lock,
  Unlock,
} from "lucide-react";

function PurseVisualizer() {
  const [purse, setPurse] = useState({
    initial: 5000000,
    spent: 1200000,
    reserved: 800000,
  });

  const remaining = purse.initial - purse.spent - purse.reserved;
  const spentPct = (purse.spent / purse.initial) * 100;
  const reservedPct = (purse.reserved / purse.initial) * 100;
  const remainingPct = (remaining / purse.initial) * 100;

  return (
    <div className="rounded-none bg-slate-950 p-8 ring-1 ring-white/5">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-white">Team Wallet Anatomy</h3>
          <p className="mt-1 text-xs text-slate-400">Drag to simulate spend and reserve states</p>
        </div>
        <button
          onClick={() => setPurse({ initial: 5000000, spent: 1200000, reserved: 800000 })}
          className="flex items-center gap-1.5 rounded-sm bg-slate-800 px-3 py-1.5 text-[11px] font-medium text-slate-300 hover:bg-slate-700"
        >
          <RefreshCcw className="h-3 w-3" /> Reset
        </button>
      </div>

      <div className="mt-8">
        {/* Bar */}
        <div className="flex h-8 w-full">
          <div
            className="flex items-center justify-center bg-indigo-600 text-[10px] font-bold text-white transition-all"
            style={{ width: `${spentPct}%` }}
          >
            {spentPct > 8 && "SPENT"}
          </div>
          <div
            className="flex items-center justify-center bg-amber-500 text-[10px] font-bold text-white transition-all"
            style={{ width: `${reservedPct}%` }}
          >
            {reservedPct > 8 && "RESERVED"}
          </div>
          <div
            className="flex items-center justify-center bg-emerald-500 text-[10px] font-bold text-white transition-all"
            style={{ width: `${remainingPct}%` }}
          >
            {remainingPct > 8 && "FREE"}
          </div>
        </div>

        {/* Legend */}
        <div className="mt-4 grid grid-cols-3 gap-4">
          <div className="text-center">
            <p className="text-lg font-bold text-indigo-400">₹{purse.spent.toLocaleString("en-IN")}</p>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Spent</p>
            <p className="mt-1 text-[10px] text-slate-600">Committed to roster</p>
          </div>
          <div className="text-center">
            <p className="text-lg font-bold text-amber-400">₹{purse.reserved.toLocaleString("en-IN")}</p>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Reserved</p>
            <p className="mt-1 text-[10px] text-slate-600">Active bid hold</p>
          </div>
          <div className="text-center">
            <p className="text-lg font-bold text-emerald-400">₹{remaining.toLocaleString("en-IN")}</p>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Available</p>
            <p className="mt-1 text-[10px] text-slate-600">Can be bid</p>
          </div>
        </div>

        {/* Sliders */}
        <div className="mt-8 space-y-4">
          <div>
            <label className="flex justify-between text-[11px] font-semibold text-slate-400">
              <span>Spent Budget</span>
              <span>{Math.round(spentPct)}%</span>
            </label>
            <input
              type="range"
              min={0}
              max={purse.initial}
              value={purse.spent}
              onChange={(e) => setPurse((p) => ({ ...p, spent: Number(e.target.value) }))}
              className="mt-2 w-full accent-indigo-500"
            />
          </div>
          <div>
            <label className="flex justify-between text-[11px] font-semibold text-slate-400">
              <span>Reserved Budget</span>
              <span>{Math.round(reservedPct)}%</span>
            </label>
            <input
              type="range"
              min={0}
              max={purse.initial - purse.spent}
              value={purse.reserved}
              onChange={(e) => setPurse((p) => ({ ...p, reserved: Number(e.target.value) }))}
              className="mt-2 w-full accent-amber-500"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function BidCalculator() {
  const [basePrice, setBasePrice] = useState(100000);
  const [currentBid, setCurrentBid] = useState(0);
  const [increment, setIncrement] = useState(25000);

  const minBid = currentBid === 0 ? basePrice : currentBid + increment;

  return (
    <div className="rounded-none bg-white p-8 ring-1 ring-slate-200">
      <h3 className="text-sm font-semibold text-slate-900">Bid Calculator</h3>
      <p className="mt-1 text-xs text-slate-500">Compute minimum valid bids based on live state</p>

      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <div>
          <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Base Price</label>
          <input
            type="number"
            value={basePrice}
            onChange={(e) => setBasePrice(Number(e.target.value))}
            className="mt-2 block w-full rounded-sm border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-mono focus:border-indigo-500 focus:outline-none"
          />
        </div>
        <div>
          <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Current Bid</label>
          <input
            type="number"
            value={currentBid}
            onChange={(e) => setCurrentBid(Number(e.target.value))}
            className="mt-2 block w-full rounded-sm border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-mono focus:border-indigo-500 focus:outline-none"
          />
        </div>
        <div>
          <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Increment</label>
          <input
            type="number"
            value={increment}
            onChange={(e) => setIncrement(Number(e.target.value))}
            className="mt-2 block w-full rounded-sm border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-mono focus:border-indigo-500 focus:outline-none"
          />
        </div>
      </div>

      <div className="mt-6 flex items-center justify-between border-t border-slate-100 pt-6">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Minimum Valid Bid</p>
          <p className="mt-1 text-2xl font-bold text-slate-900">₹{minBid.toLocaleString("en-IN")}</p>
        </div>
        <div className="text-right">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Formula</p>
          <p className="mt-1 font-mono text-xs text-slate-600">
            {currentBid === 0 ? "basePrice" : "currentBid + increment"}
          </p>
        </div>
      </div>
    </div>
  );
}

export default function BiddingRulesPage() {
  return (
    <div className="space-y-16">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex items-center gap-2 text-indigo-600">
          <Wallet className="h-5 w-5" />
          <span className="text-xs font-bold uppercase tracking-widest">Master the Bid</span>
        </div>
        <h1 className="mt-3 text-4xl font-extrabold tracking-tight text-slate-900 lg:text-5xl">
          Bidding Rules
        </h1>
        <p className="mt-4 max-w-2xl text-lg leading-relaxed text-slate-500">
          Your purse is your weapon. Understand reservations, increments, and the timer
          to outmaneuver rival franchises.
        </p>
      </motion.div>

      {/* Wallet Anatomy */}
      <section>
        <PurseVisualizer />
      </section>

      {/* The Flow */}
      <section className="grid gap-8 lg:grid-cols-2">
        <div className="space-y-6">
          <h2 className="text-xl font-bold text-slate-900">The Bid Lifecycle</h2>

          {[
            {
              icon: Lock,
              title: "Reservation",
              body: "When you place a bid, the amount is reserved from your available budget. It leaves your free purse immediately but is not yet spent.",
            },
            {
              icon: TrendingUp,
              title: "Outbid Release",
              body: "If another team tops your bid, your reservation is instantly released. The money returns to your available pool — no penalty, no delay.",
            },
            {
              icon: Unlock,
              title: "Commitment",
              body: "When the organizer hammers the lot in your favor, the reservation converts to a spend. Your roster updates and the money is permanently gone.",
            },
            {
              icon: AlertCircle,
              title: "Unsold Release",
              body: "If the lot is passed (unsold), all active reservations for that lot are released back to their respective teams.",
            },
          ].map((step, i) => (
            <motion.div
              key={step.title}
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className="flex gap-4"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center bg-slate-100">
                <step.icon className="h-5 w-5 text-slate-700" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">{step.title}</h3>
                <p className="mt-1 text-xs leading-relaxed text-slate-500">{step.body}</p>
              </div>
            </motion.div>
          ))}
        </div>

        <div className="space-y-6">
          <h2 className="text-xl font-bold text-slate-900">Timer Mechanics</h2>
          <div className="rounded-none bg-slate-950 p-6 ring-1 ring-white/5">
            <div className="flex items-center gap-3">
              <Timer className="h-5 w-5 text-rose-400" />
              <h3 className="text-sm font-semibold text-white">Lot Timer + Bid Reset</h3>
            </div>
            <p className="mt-3 text-xs leading-relaxed text-slate-400">
              Each lot has a total duration (e.g., 30 seconds). When a bid arrives in the final
              seconds, the timer extends by the bid-reset duration (e.g., 12 seconds). This
              prevents sniping and ensures fair competition.
            </p>
            <div className="mt-4 space-y-2">
              <div className="flex justify-between text-xs">
                <span className="text-slate-500">Lot Timer</span>
                <span className="font-mono text-white">30s</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-slate-500">Bid Reset Extension</span>
                <span className="font-mono text-emerald-400">+12s</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-slate-500">Max Extension</span>
                <span className="font-mono text-slate-400">Until organizer intervenes</span>
              </div>
            </div>
          </div>

          <div className="rounded-none bg-amber-50 p-6 ring-1 ring-amber-200">
            <h3 className="text-sm font-semibold text-amber-900">Squad Full Lockout</h3>
            <p className="mt-2 text-xs leading-relaxed text-amber-700">
              You cannot place bids if your roster has reached the tournament's squad size limit.
              The system checks <code className="font-mono text-amber-800">team.roster.length ≥ tournament.squadSize</code>{" "}
              before accepting any bid.
            </p>
          </div>
        </div>
      </section>

      {/* Calculator */}
      <section>
        <BidCalculator />
      </section>

      {/* Restrictions */}
      <section className="rounded-none bg-white p-8 ring-1 ring-slate-200">
        <h2 className="text-xl font-bold text-slate-900">Hard Restrictions</h2>
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {[
            "You cannot bid on your own highest bid (no self-outbidding).",
            "You cannot bid below the effective minimum (base price or current + increment).",
            "You cannot bid if your available purse (remaining − reserved) is insufficient.",
            "You cannot bid if your team registration is PENDING or REJECTED.",
            "You cannot bid if the auction is not in LIVE status.",
            "You cannot bid if no lot is currently open (BIDDING state).",
          ].map((rule, i) => (
            <div key={i} className="flex items-start gap-3">
              <ArrowRight className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" />
              <p className="text-sm text-slate-600">{rule}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}