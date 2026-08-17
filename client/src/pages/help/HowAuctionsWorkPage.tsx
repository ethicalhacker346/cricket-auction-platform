import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Trophy,
  Users,
  Gavel,
  Clock,
  CheckCircle2,
  ArrowRight,
  Play,
  Pause,
  RotateCcw,
  ChevronRight,
} from "lucide-react";

/* ── Domain constants from services ── */
const TOURNAMENT_STATES = [
  { id: "DRAFT", label: "Draft", desc: "Tournament created, settings configured" },
  { id: "PLAYER_REGISTRATION_OPEN", label: "Player Reg", desc: "Players apply to enter the pool" },
  { id: "TEAM_REGISTRATION_OPEN", label: "Team Reg", desc: "Franchises register their teams" },
  { id: "TEAMS_APPROVED", label: "Teams Approved", desc: "Organizer locks the participant list" },
  { id: "AUCTION_SCHEDULED", label: "Auction Scheduled", desc: "Rules set, rounds configured" },
  { id: "AUCTION_RUNNING", label: "Auction Live", desc: "Real-time bidding in progress" },
  { id: "AUCTION_COMPLETED", label: "Auction Done", desc: "All lots settled, squads finalized" },
  { id: "TOURNAMENT_COMPLETED", label: "Tournament Done", desc: "Season concluded" },
];

const AUCTION_STATES = [
  { id: "DRAFT", label: "Draft", color: "bg-slate-500" },
  { id: "SCHEDULED", label: "Scheduled", color: "bg-amber-500" },
  { id: "LIVE", label: "Live", color: "bg-emerald-500" },
  { id: "PAUSED", label: "Paused", color: "bg-rose-500" },
  { id: "COMPLETED", label: "Completed", color: "bg-indigo-500" },
];

/* ── Interactive State Machine ── */
function TournamentFlow() {
  const [activeIdx, setActiveIdx] = useState(4);

  return (
    <div className="rounded-none bg-slate-950 p-8 ring-1 ring-white/5">
      <h3 className="text-sm font-semibold text-white">Tournament Lifecycle</h3>
      <p className="mt-1 text-xs text-slate-400">Click to explore each phase</p>

      <div className="mt-8 flex flex-wrap gap-2">
        {TOURNAMENT_STATES.map((s, i) => (
          <button
            key={s.id}
            onClick={() => setActiveIdx(i)}
            className={`relative flex items-center gap-2 rounded-sm px-3 py-2 text-[11px] font-semibold uppercase tracking-wider transition-all ${
              i === activeIdx
                ? "bg-indigo-600 text-white shadow-lg shadow-indigo-900/30"
                : i < activeIdx
                ? "bg-slate-800 text-slate-400"
                : "bg-slate-900 text-slate-600 ring-1 ring-slate-800"
            }`}
          >
            {i < activeIdx && <CheckCircle2 className="h-3 w-3 text-emerald-400" />}
            {s.label}
            {i < TOURNAMENT_STATES.length - 1 && (
              <ChevronRight className="ml-1 h-3 w-3 opacity-50" />
            )}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={activeIdx}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -12 }}
          className="mt-6 border-l-2 border-indigo-500/30 pl-5"
        >
          <h4 className="text-lg font-bold text-white">
            {TOURNAMENT_STATES[activeIdx].label}
          </h4>
          <p className="mt-1 text-sm leading-relaxed text-slate-400">
            {TOURNAMENT_STATES[activeIdx].desc}
          </p>
          {activeIdx === 5 && (
            <div className="mt-4 flex gap-3">
              <span className="inline-flex items-center gap-1.5 rounded-sm bg-emerald-500/10 px-2.5 py-1 text-[11px] font-medium text-emerald-400">
                <Clock className="h-3 w-3" /> Live timer active
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-sm bg-rose-500/10 px-2.5 py-1 text-[11px] font-medium text-rose-400">
                <Gavel className="h-3 w-3" /> Bids locking
              </span>
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

/* ── Live Auction Simulator ── */
function AuctionSimulator() {
  const [status, setStatus] = useState<"idle" | "bidding" | "sold" | "unsold">("idle");
  const [timeLeft, setTimeLeft] = useState(15);
  const [highBid, setHighBid] = useState(100000);
  const [highTeam, setHighTeam] = useState<string | null>(null);
  const [log, setLog] = useState<string[]>([]);

  useEffect(() => {
    if (status !== "bidding") return;
    const interval = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) {
          clearInterval(interval);
          setStatus("unsold");
          setLog((l) => [...l, "⏱️ Timer expired. Player unsold."]);
          return 0;
        }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [status]);

  const placeBid = (team: string, amount: number) => {
    if (status !== "bidding") return;
    setHighBid(amount);
    setHighTeam(team);
    setTimeLeft((t) => Math.max(t, 5)); // bidResetSeconds extension
    setLog((l) => [...l, `${team} bids ₹${amount.toLocaleString("en-IN")}`]);
  };

  const settle = (sold: boolean) => {
    if (status !== "bidding") return;
    setStatus(sold ? "sold" : "unsold");
    setLog((l) => [
      ...l,
      sold
        ? `🔨 SOLD to ${highTeam} for ₹${highBid.toLocaleString("en-IN")}`
        : "🔨 Marked unsold by organizer",
    ]);
  };

  const reset = () => {
    setStatus("idle");
    setTimeLeft(15);
    setHighBid(100000);
    setHighTeam(null);
    setLog([]);
  };

  return (
    <div className="rounded-none bg-slate-950 p-8 ring-1 ring-white/5">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-white">Auction Room Simulator</h3>
          <p className="mt-1 text-xs text-slate-400">Experience a live lot from organizer & bidder perspectives</p>
        </div>
        <button
          onClick={reset}
          className="flex items-center gap-1.5 rounded-sm bg-slate-800 px-3 py-1.5 text-[11px] font-medium text-slate-300 transition-colors hover:bg-slate-700"
        >
          <RotateCcw className="h-3 w-3" /> Reset
        </button>
      </div>

      <div className="mt-8 grid gap-6 md:grid-cols-2">
        {/* Stage */}
        <div className="space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-4">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Current Lot</p>
              <p className="mt-0.5 text-sm font-bold text-white">Rohit Sharma • Batsman</p>
              <p className="text-xs text-slate-400">Base price: ₹1,00,000</p>
            </div>
            <div className="text-right">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Status</p>
              <span
                className={`mt-1 inline-block rounded-sm px-2 py-0.5 text-[11px] font-bold uppercase ${
                  status === "bidding"
                    ? "bg-emerald-500/10 text-emerald-400"
                    : status === "sold"
                    ? "bg-indigo-500/10 text-indigo-400"
                    : "bg-slate-800 text-slate-400"
                }`}
              >
                {status === "idle" ? "Pending" : status}
              </span>
            </div>
          </div>

          <div className="flex items-end justify-between">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Highest Bid</p>
              <p className="mt-1 text-2xl font-bold text-white">₹{highBid.toLocaleString("en-IN")}</p>
              <p className="text-xs text-slate-400">{highTeam ?? "No bids yet"}</p>
            </div>
            <div className="text-right">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Timer</p>
              <p
                className={`mt-1 font-mono text-2xl font-bold ${
                  timeLeft <= 5 ? "text-rose-400" : "text-white"
                }`}
              >
                00:{timeLeft.toString().padStart(2, "0")}
              </p>
            </div>
          </div>

          {status === "idle" && (
            <button
              onClick={() => {
                setStatus("bidding");
                setLog((l) => [...l, "🟢 Lot opened by organizer"]);
              }}
              className="flex w-full items-center justify-center gap-2 rounded-sm bg-emerald-600 py-3 text-sm font-semibold text-white transition-colors hover:bg-emerald-500"
            >
              <Play className="h-4 w-4" /> Open Lot
            </button>
          )}

          {status === "bidding" && (
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => settle(true)}
                className="rounded-sm bg-indigo-600 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-indigo-500"
              >
                Hammer (Sold)
              </button>
              <button
                onClick={() => settle(false)}
                className="rounded-sm bg-slate-800 py-2.5 text-sm font-semibold text-slate-300 transition-colors hover:bg-slate-700"
              >
                Pass (Unsold)
              </button>
            </div>
          )}

          {(status === "sold" || status === "unsold") && (
            <div
              className={`rounded-sm py-3 text-center text-sm font-semibold ${
                status === "sold" ? "bg-indigo-500/10 text-indigo-400" : "bg-slate-800 text-slate-400"
              }`}
            >
              {status === "sold"
                ? `Player sold to ${highTeam} — squad updated`
                : "Player moved to unsold pool"}
            </div>
          )}
        </div>

        {/* Bidder Panel */}
        <div className="space-y-3 border-l border-slate-800 md:pl-6">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Team Owner Actions</p>

          <div className="space-y-2">
            {[
              { name: "Mumbai Strikers", color: "text-sky-400" },
              { name: "Delhi Dynamos", color: "text-amber-400" },
              { name: "Chennai Kings", color: "text-rose-400" },
            ].map((team) => (
              <button
                key={team.name}
                disabled={status !== "bidding"}
                onClick={() => placeBid(team.name, highBid + 50000)}
                className="flex w-full items-center justify-between rounded-sm bg-slate-900 px-4 py-3 text-left transition-all hover:bg-slate-800 disabled:opacity-30"
              >
                <span className={`text-sm font-semibold ${team.color}`}>{team.name}</span>
                <span className="text-xs text-slate-500">+₹50,000</span>
              </button>
            ))}
          </div>

          <div className="mt-4 rounded-sm bg-slate-900 p-3">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Event Log</p>
            <div className="mt-2 space-y-1">
              {log.length === 0 && <p className="text-xs text-slate-600 italic">Waiting for organizer...</p>}
              {log.map((entry, i) => (
                <p key={i} className="font-mono text-[11px] text-slate-400">
                  {entry}
                </p>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Page ── */
export default function HowAuctionsWorkPage() {
  return (
    <div className="space-y-16">
      {/* Hero */}
      <section>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <div className="flex items-center gap-2 text-indigo-600">
            <Gavel className="h-5 w-5" />
            <span className="text-xs font-bold uppercase tracking-widest">The Ecosystem</span>
          </div>
          <h1 className="mt-3 text-4xl font-extrabold tracking-tight text-slate-900 lg:text-5xl">
            How Auctions Work
          </h1>
          <p className="mt-4 max-w-2xl text-lg leading-relaxed text-slate-500">
            From tournament creation to the final hammer drop. Understand the full lifecycle
            of a GullyBid cricket auction — built for organizers, franchise owners, and players.
          </p>
        </motion.div>
      </section>

      {/* State Machine */}
      <section>
        <TournamentFlow />
      </section>

      {/* The Three Acts */}
      <section className="grid gap-8 lg:grid-cols-3">
        {[
          {
            icon: Trophy,
            title: "1. The Setup",
            body: "Organizers create a tournament, open player registration, and approve teams. Once teams are locked, the auction is configured with purse sizes, squad limits, and bid increment tiers.",
          },
          {
            icon: Users,
            title: "2. The Room",
            body: "Rounds group players into lots. The organizer opens each lot, starting a live timer. Team owners place bids within the time window. Every new bid extends the timer by the bid-reset duration.",
          },
          {
            icon: CheckCircle2,
            title: "3. The Settlement",
            body: "When the organizer hammers the lot, the highest bid commits from the team's reserved purse. The player joins the roster. Unsold players enter a dedicated unsold round for a second chance.",
          },
        ].map((card, i) => (
          <motion.div
            key={card.title}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: i * 0.1 }}
            className="rounded-none bg-white p-8 ring-1 ring-slate-200"
          >
            <card.icon className="h-6 w-6 text-indigo-600" />
            <h3 className="mt-4 text-lg font-bold text-slate-900">{card.title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-slate-500">{card.body}</p>
          </motion.div>
        ))}
      </section>

      {/* Simulator */}
      <section>
        <AuctionSimulator />
      </section>

      {/* Round Types */}
      <section className="rounded-none bg-white p-8 ring-1 ring-slate-200">
        <h2 className="text-xl font-bold text-slate-900">Round Architecture</h2>
        <p className="mt-2 text-sm text-slate-500">
          Auctions consist of ordered rounds. Normal rounds cover the initial player pool.
          When normal rounds complete, unsold players automatically generate an unsold round.
        </p>

        <div className="mt-8 grid gap-6 md:grid-cols-2">
          <div className="border-l-2 border-indigo-500 bg-slate-50 p-6">
            <h3 className="text-sm font-bold text-slate-900">Normal Round</h3>
            <p className="mt-2 text-xs leading-relaxed text-slate-500">
              The primary auction phase. Players are assigned by the organizer. Each lot resolves
              to SOLD or UNSOLD. Once all normal rounds complete, the system evaluates unsold inventory.
            </p>
          </div>
          <div className="border-l-2 border-amber-500 bg-slate-50 p-6">
            <h3 className="text-sm font-bold text-slate-900">Unsold Round</h3>
            <p className="mt-2 text-xs leading-relaxed text-slate-500">
              Auto-generated when normal rounds finish with remaining inventory. Players reset to
              NOT_LISTED state. Teams get a final chance to fill squad gaps. Unsold players here
              can be marked PERMANENT_UNSOLD by the organizer.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}