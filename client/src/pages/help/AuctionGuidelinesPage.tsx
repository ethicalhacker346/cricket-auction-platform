import { useState } from "react";
import { motion } from "framer-motion";
import {
  Shield,
  Lock,
  Play,
  Pause,
  Square,
  Settings,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  ArrowRight,
} from "lucide-react";

const REQUIREMENTS = [
  { label: "Tournament status", value: "TEAMS_APPROVED", valid: true },
  { label: "Minimum teams", value: "2 approved franchises", valid: true },
  { label: "No existing auction", value: "One auction per tournament", valid: true },
];

const AUCTION_STATUS_FLOW = [
  { from: "DRAFT", to: "SCHEDULED", action: "Schedule", icon: Settings },
  { from: "SCHEDULED", to: "LIVE", action: "Start", icon: Play },
  { from: "LIVE", to: "PAUSED", action: "Pause", icon: Pause },
  { from: "PAUSED", to: "LIVE", action: "Resume", icon: Play },
  { from: "LIVE", to: "COMPLETED", action: "Complete", icon: Square },
];

const BID_TIER_EXAMPLE = [
  { upTo: 500000, increment: 25000, example: "₹1,00,000 → ₹1,25,000" },
  { upTo: 1000000, increment: 50000, example: "₹6,00,000 → ₹6,50,000" },
  { upTo: null, increment: 100000, example: "₹15,00,000 → ₹16,00,000" },
];

function StatusFlow() {
  const [activeStep, setActiveStep] = useState(1);

  return (
    <div className="rounded-none bg-slate-950 p-8 ring-1 ring-white/5">
      <h3 className="text-sm font-semibold text-white">Auction State Machine</h3>
      <p className="mt-1 text-xs text-slate-400">Valid transitions enforced by the platform</p>

      <div className="mt-8 flex flex-wrap items-center gap-3">
        {AUCTION_STATUS_FLOW.map((step, i) => (
          <div key={i} className="flex items-center gap-3">
            <button
              onClick={() => setActiveStep(i)}
              className={`flex items-center gap-2 rounded-sm px-3 py-2 text-[11px] font-bold uppercase tracking-wider transition-all ${
                i === activeStep
                  ? "bg-indigo-600 text-white shadow-lg shadow-indigo-900/30"
                  : "bg-slate-900 text-slate-500 ring-1 ring-slate-800 hover:text-slate-300"
              }`}
            >
              <step.icon className="h-3 w-3" />
              {step.action}
            </button>
            <ArrowRight className="h-3 w-3 text-slate-700" />
          </div>
        ))}
      </div>

      <motion.div
        key={activeStep}
        initial={{ opacity: 0, x: -10 }}
        animate={{ opacity: 1, x: 0 }}
        className="mt-6 border-l-2 border-indigo-500/30 pl-5"
      >
        <p className="text-sm text-slate-300">
          <span className="font-semibold text-white">{AUCTION_STATUS_FLOW[activeStep].from}</span>
          {" → "}
          <span className="font-semibold text-white">{AUCTION_STATUS_FLOW[activeStep].to}</span>
        </p>
        <p className="mt-2 text-xs leading-relaxed text-slate-400">
          {activeStep === 0 && "Configure purse, squad size, lot timer, bid reset duration, and increment tiers before scheduling."}
          {activeStep === 1 && "Once live, team owners can place bids. You control lot opening and settlement. Minimum 2 approved teams required."}
          {activeStep === 2 && "Pause freezes the auction mid-round. Use for technical issues or breaks. All state is preserved."}
          {activeStep === 3 && "Resume returns the auction to LIVE. The lot timer continues from where it paused."}
          {activeStep === 4 && "Complete ends the auction permanently. All players must be resolved (SOLD or PERMANENT_UNSOLD)."}
        </p>
      </motion.div>
    </div>
  );
}

export default function AuctionGuidelinesPage() {
  return (
    <div className="space-y-16">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div className="flex items-center gap-2 text-indigo-600">
          <Shield className="h-5 w-5" />
          <span className="text-xs font-bold uppercase tracking-widest">Organizer's Playbook</span>
        </div>
        <h1 className="mt-3 text-4xl font-extrabold tracking-tight text-slate-900 lg:text-5xl">
          Auction Guidelines
        </h1>
        <p className="mt-4 max-w-2xl text-lg leading-relaxed text-slate-500">
          Everything you need to run a fair, fast, and transparent auction.
          From pre-flight checks to hammer discipline.
        </p>
      </motion.div>

      {/* Pre-flight */}
      <section className="rounded-none bg-white p-8 ring-1 ring-slate-200">
        <h2 className="text-xl font-bold text-slate-900">Pre-flight Checklist</h2>
        <p className="mt-2 text-sm text-slate-500">Before creating an auction, verify these invariants.</p>

        <div className="mt-6 space-y-3">
          {REQUIREMENTS.map((req) => (
            <div
              key={req.label}
              className="flex items-center justify-between border-b border-slate-100 py-3 last:border-0"
            >
              <div className="flex items-center gap-3">
                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                <span className="text-sm font-medium text-slate-700">{req.label}</span>
              </div>
              <span className="rounded-sm bg-slate-100 px-2 py-1 text-[11px] font-semibold text-slate-600">
                {req.value}
              </span>
            </div>
          ))}
        </div>

        <div className="mt-6 flex items-start gap-3 rounded-sm bg-amber-50 p-4 ring-1 ring-amber-200">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
          <div>
            <p className="text-sm font-semibold text-amber-800">One auction per tournament</p>
            <p className="mt-1 text-xs leading-relaxed text-amber-700">
              The system enforces a 1:1 relationship between tournaments and auctions. Once created,
              the auction configuration is snapshotted from the tournament — subsequent tournament
              changes do not retroactively affect the auction rules.
            </p>
          </div>
        </div>
      </section>

      {/* State Machine */}
      <section>
        <StatusFlow />
      </section>

      {/* Bid Increment Tiers */}
      <section className="rounded-none bg-white p-8 ring-1 ring-slate-200">
        <h2 className="text-xl font-bold text-slate-900">Bid Increment Tiers</h2>
        <p className="mt-2 text-sm text-slate-500">
          Define non-linear increments to keep early rounds accessible and late rounds dramatic.
        </p>

        <div className="mt-6 overflow-hidden rounded-sm ring-1 ring-slate-200">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-6 py-3">Price Ceiling</th>
                <th className="px-6 py-3">Minimum Increment</th>
                <th className="px-6 py-3">Example</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {BID_TIER_EXAMPLE.map((tier, i) => (
                <tr key={i} className="bg-white">
                  <td className="px-6 py-4 font-mono text-slate-900">
                    {tier.upTo ? `≤ ₹${tier.upTo.toLocaleString("en-IN")}` : "Unlimited"}
                  </td>
                  <td className="px-6 py-4 font-mono text-slate-900">
                    ₹{tier.increment.toLocaleString("en-IN")}
                  </td>
                  <td className="px-6 py-4 text-xs text-slate-500">{tier.example}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-4 text-xs text-slate-400">
          Default: If no tiers are provided, the system uses the tournament's{" "}
          <code className="rounded-sm bg-slate-100 px-1 py-0.5 font-mono text-slate-600">minBidIncrement</code>{" "}
          as a flat rate across all price levels.
        </div>
      </section>

      {/* Round Management */}
      <section className="grid gap-8 lg:grid-cols-2">
        <div className="rounded-none bg-slate-950 p-8 ring-1 ring-white/5">
          <h3 className="text-sm font-semibold text-white">Adding Rounds</h3>
          <p className="mt-2 text-xs leading-relaxed text-slate-400">
            Rounds are ordered sequences. Each round carries a player pool. You can add rounds
            in DRAFT, SCHEDULED, LIVE, or PAUSED states. However, you cannot modify playerIds
            on a round that has already started.
          </p>
          <div className="mt-4 space-y-2">
            <div className="flex items-center gap-2 text-xs text-slate-300">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
              <span>Name, order, type, category editable anytime</span>
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-300">
              <XCircle className="h-3.5 w-3.5 text-rose-400" />
              <span>playerIds locked once round status leaves PENDING</span>
            </div>
          </div>
        </div>

        <div className="rounded-none bg-slate-950 p-8 ring-1 ring-white/5">
          <h3 className="text-sm font-semibold text-white">Deleting Rounds</h3>
          <p className="mt-2 text-xs leading-relaxed text-slate-400">
            Only PENDING rounds can be deleted. This is a hard delete — the round record is
            removed from the database, not soft-archived.
          </p>
          <div className="mt-4 rounded-sm bg-rose-500/10 p-3">
            <p className="text-xs font-semibold text-rose-400">Destructive Action</p>
            <p className="mt-1 text-[11px] text-rose-300">
              Deleting a round with assigned players does not affect the players' lotOutcome.
              They simply become unassigned and can be added to other rounds.
            </p>
          </div>
        </div>
      </section>

      {/* Completion Rules */}
      <section className="rounded-none bg-white p-8 ring-1 ring-slate-200">
        <h2 className="text-xl font-bold text-slate-900">Completion Invariants</h2>
        <p className="mt-2 text-sm text-slate-500">
          An auction cannot be marked COMPLETED until every approved player has a terminal state.
        </p>

        <div className="mt-6 space-y-4">
          <div className="flex gap-4">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center bg-emerald-100">
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-900">SOLD</p>
              <p className="text-xs text-slate-500">Player won by a team. Wallet committed, roster updated.</p>
            </div>
          </div>
          <div className="flex gap-4">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center bg-slate-100">
              <XCircle className="h-4 w-4 text-slate-600" />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-900">PERMANENT_UNSOLD</p>
              <p className="text-xs text-slate-500">
                Organizer explicitly removes player from auction pool. No further rounds can list them.
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}