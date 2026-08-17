import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import {
  Scale,
  ArrowUpRight,
  Gavel,
  Shield,
  Wallet,
  Users,
  Trophy,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Clock,
  Lock,
  Radio,
  Zap,
  FileText,
  ChevronRight,
} from "lucide-react";

const CLAUSES = [
  { id: "definitions", label: "Definitions", icon: FileText },
  { id: "eligibility", label: "Eligibility", icon: Shield },
  { id: "roles", label: "Roles", icon: Users },
  { id: "tournaments", label: "Tournaments", icon: Trophy },
  { id: "auctions", label: "Auction Mechanics", icon: Gavel },
  { id: "bidding", label: "Bidding", icon: Wallet },
  { id: "squads", label: "Squads", icon: Users },
  { id: "content", label: "Content", icon: FileText },
  { id: "prohibited", label: "Prohibited Conduct", icon: XCircle },
  { id: "liability", label: "Liability", icon: Scale },
  { id: "termination", label: "Termination", icon: Lock },
  { id: "disputes", label: "Disputes", icon: Scale },
];

const DEFINITIONS = [
  { term: "Platform", def: "The GullyBid web application, APIs, Socket.IO servers, and associated infrastructure." },
  { term: "User", def: "Any individual with a registered account, including Players, Franchise Owners, Organizers, and Admins." },
  { term: "Organizer", def: "A User who creates tournaments, configures auctions, approves registrations, and settles lots." },
  { term: "Franchise Owner", def: "A User who owns a Franchise, registers teams for tournaments, and places bids in auctions." },
  { term: "Player", def: "A User with a Player profile who registers for tournaments and enters the auction pool." },
  { term: "Tournament", def: "A cricket competition created by an Organizer, consisting of registered teams and players." },
  { term: "Auction", def: "A real-time bidding event within a Tournament, consisting of ordered Rounds and Lots." },
  { term: "Lot", def: "A single player opened for bidding during a live auction. Identified by tournamentPlayerId and roundId." },
  { term: "Bid", def: "A monetary offer placed by a Franchise Owner on an open Lot, subject to increment and timer rules." },
  { term: "Purse", def: "The virtual budget allocated to each team, defined by tournament.defaultPurse." },
  { term: "Hammer", def: "The Organizer's action of settling a Lot as SOLD or UNSOLD, finalizing the transaction." },
  { term: "Unsold Round", def: "An automatically generated round containing players with lotOutcome UNSOLD from normal rounds." },
];

export default function TermsPage() {
  const [activeClause, setActiveClause] = useState("definitions");

  useEffect(() => {
    const handleScroll = () => {
      const offsets = CLAUSES.map((c) => {
        const el = document.getElementById(c.id);
        return el ? { id: c.id, offset: el.offsetTop } : null;
      }).filter(Boolean) as { id: string; offset: number }[];

      const scrollPos = window.scrollY + 200;
      for (let i = offsets.length - 1; i >= 0; i--) {
        if (scrollPos >= offsets[i].offset) {
          setActiveClause(offsets[i].id);
          break;
        }
      }
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const scrollTo = (id: string) => {
    const el = document.getElementById(id);
    if (el) window.scrollTo({ top: el.offsetTop - 120, behavior: "smooth" });
  };

  return (
    <div className="min-h-screen bg-slate-50">
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

      <div className="mx-auto max-w-7xl px-6 py-16 lg:flex lg:gap-16">
        {/* TOC */}
        <aside className="hidden shrink-0 lg:block lg:w-64">
          <nav className="sticky top-28">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              Terms of Service
            </p>
            <p className="mt-1 text-[10px] text-slate-400">Effective: 12 Aug 2026</p>
            <ul className="mt-6 space-y-1">
              {CLAUSES.map((c) => (
                <li key={c.id}>
                  <button
                    onClick={() => scrollTo(c.id)}
                    className={`flex w-full items-center gap-2.5 rounded-sm px-3 py-2 text-left text-[13px] font-medium transition-all ${
                      activeClause === c.id
                        ? "bg-slate-900 text-white shadow-md"
                        : "text-slate-600 hover:bg-slate-200/50 hover:text-slate-900"
                    }`}
                  >
                    <c.icon className="h-3.5 w-3.5" />
                    {c.label}
                  </button>
                </li>
              ))}
            </ul>

            <div className="mt-8 rounded-sm bg-slate-950 p-4 ring-1 ring-white/5">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Binding Agreement</p>
              <p className="mt-2 text-[11px] leading-relaxed text-slate-400">
                By creating an account or participating in any auction, you agree to be bound by these terms in their entirety.
              </p>
            </div>
          </nav>
        </aside>

        {/* Content */}
        <main className="min-w-0 flex-1 space-y-20">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <div className="flex items-center gap-2 text-indigo-600">
              <Scale className="h-5 w-5" />
              <span className="text-xs font-bold uppercase tracking-widest">The Contract</span>
            </div>
            <h1 className="mt-3 text-4xl font-extrabold tracking-tight text-slate-900 lg:text-5xl">
              Terms of Service
            </h1>
            <p className="mt-4 max-w-2xl text-lg leading-relaxed text-slate-500">
              These terms govern your use of the GullyBid cricket auction platform. They are
              enforceable, specific, and written to protect the integrity of every tournament.
            </p>
          </motion.div>

          {/* Definitions */}
          <section id="definitions" className="scroll-mt-28">
            <h2 className="flex items-center gap-3 text-2xl font-bold text-slate-900">
              <span className="flex h-8 w-8 items-center justify-center bg-slate-900 text-sm font-bold text-white">
                01
              </span>
              Definitions
            </h2>
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              {DEFINITIONS.map((d) => (
                <div key={d.term} className="rounded-none bg-white p-5 ring-1 ring-slate-200">
                  <p className="text-xs font-bold uppercase tracking-wider text-indigo-600">{d.term}</p>
                  <p className="mt-2 text-xs leading-relaxed text-slate-600">{d.def}</p>
                </div>
              ))}
            </div>
          </section>

          {/* Eligibility */}
          <section id="eligibility" className="scroll-mt-28">
            <h2 className="flex items-center gap-3 text-2xl font-bold text-slate-900">
              <span className="flex h-8 w-8 items-center justify-center bg-slate-900 text-sm font-bold text-white">
                02
              </span>
              Eligibility & Accounts
            </h2>
            <div className="mt-6 space-y-4">
              <div className="rounded-none bg-white p-6 ring-1 ring-slate-200">
                <h3 className="text-sm font-bold text-slate-900">Age Requirement</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">
                  You must be at least <strong className="text-slate-900">15+ years old</strong> to create an account. By registering, you represent that you meet this threshold.
                </p>
              </div>
              <div className="rounded-none bg-white p-6 ring-1 ring-slate-200">
                <h3 className="text-sm font-bold text-slate-900">Account Security</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">
                  You are responsible for maintaining the confidentiality of your credentials. The platform enforces bcrypt password hashing, refresh token rotation, and account lockouts after repeated failed attempts — but you must still protect your login details.
                </p>
              </div>
              <div className="rounded-none bg-white p-6 ring-1 ring-slate-200">
                <h3 className="text-sm font-bold text-slate-900">One Account Per Individual</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">
                  You may not maintain multiple accounts to manipulate registrations, bids, or tournament outcomes. Duplicate accounts detected by email or behavioral fingerprinting will be permanently suspended.
                </p>
              </div>
            </div>
          </section>

          {/* Roles */}
          <section id="roles" className="scroll-mt-28">
            <h2 className="flex items-center gap-3 text-2xl font-bold text-slate-900">
              <span className="flex h-8 w-8 items-center justify-center bg-slate-900 text-sm font-bold text-white">
                03
              </span>
              User Roles & Responsibilities
            </h2>
            <div className="mt-6 grid gap-6 md:grid-cols-3">
              <div className="rounded-none bg-violet-50 p-6 ring-1 ring-violet-200">
                <div className="flex h-10 w-10 items-center justify-center bg-violet-100">
                  <Shield className="h-5 w-5 text-violet-600" />
                </div>
                <h3 className="mt-4 text-sm font-bold text-violet-900">Organizer</h3>
                <ul className="mt-3 space-y-2 text-xs leading-relaxed text-violet-800">
                  <li>• Create tournaments with accurate settings</li>
                  <li>• Verify or reject player/team registrations promptly</li>
                  <li>• Configure auction rules before going live</li>
                  <li>• Settle lots fairly and without undue delay</li>
                  <li>• Maintain tournament integrity</li>
                </ul>
              </div>
              <div className="rounded-none bg-amber-50 p-6 ring-1 ring-amber-200">
                <div className="flex h-10 w-10 items-center justify-center bg-amber-100">
                  <Trophy className="h-5 w-5 text-amber-600" />
                </div>
                <h3 className="mt-4 text-sm font-bold text-amber-900">Franchise Owner</h3>
                <ul className="mt-3 space-y-2 text-xs leading-relaxed text-amber-800">
                  <li>• Register only franchises you legitimately own</li>
                  <li>• Bid within your available purse limits</li>
                  <li>• Respect squad size constraints</li>
                  <li>• Do not collude with other owners</li>
                  <li>• Pay attention to lot timers</li>
                </ul>
              </div>
              <div className="rounded-none bg-sky-50 p-6 ring-1 ring-sky-200">
                <div className="flex h-10 w-10 items-center justify-center bg-sky-100">
                  <Users className="h-5 w-5 text-sky-600" />
                </div>
                <h3 className="mt-4 text-sm font-bold text-sky-900">Player</h3>
                <ul className="mt-3 space-y-2 text-xs leading-relaxed text-sky-800">
                  <li>• Maintain an accurate player profile</li>
                  <li>• Register only for tournaments you intend to play</li>
                  <li>• Accept base prices set by organizers</li>
                  <li>• Do not create duplicate player profiles</li>
                  <li>• Respond to verification requests</li>
                </ul>
              </div>
            </div>
          </section>

          {/* Tournaments */}
          <section id="tournaments" className="scroll-mt-28">
            <h2 className="flex items-center gap-3 text-2xl font-bold text-slate-900">
              <span className="flex h-8 w-8 items-center justify-center bg-slate-900 text-sm font-bold text-white">
                04
              </span>
              Tournament Creation & Management
            </h2>
            <div className="mt-6 space-y-4">
              <div className="rounded-none bg-white p-6 ring-1 ring-slate-200">
                <h3 className="text-sm font-bold text-slate-900">Lifecycle Enforcement</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">
                  Tournaments follow a strict state machine: DRAFT → PLAYER_REGISTRATION_OPEN → TEAM_REGISTRATION_OPEN → TEAMS_APPROVED → AUCTION_SCHEDULED → AUCTION_RUNNING → AUCTION_COMPLETED → TOURNAMENT_COMPLETED. Organizers cannot skip states or bypass transitions.
                </p>
              </div>
              <div className="rounded-none bg-white p-6 ring-1 ring-slate-200">
                <h3 className="text-sm font-bold text-slate-900">Registration Windows</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">
                  Organizers control when player and team registration opens via <code className="rounded-sm bg-slate-100 px-1 py-0.5 font-mono text-xs">playerRegistrationOpen</code> and <code className="rounded-sm bg-slate-100 px-1 py-0.5 font-mono text-xs">teamRegistrationOpen</code> flags. Once closed, late registrations are rejected.
                </p>
              </div>
              <div className="rounded-none bg-white p-6 ring-1 ring-slate-200">
                <h3 className="text-sm font-bold text-slate-900">Team Approval</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">
                  A minimum of <strong className="text-slate-900">2 approved teams</strong> is required to start an auction. Organizers must approve or reject teams before scheduling.
                </p>
              </div>
            </div>
          </section>

          {/* Auction Mechanics */}
          <section id="auctions" className="scroll-mt-28">
            <h2 className="flex items-center gap-3 text-2xl font-bold text-slate-900">
              <span className="flex h-8 w-8 items-center justify-center bg-slate-900 text-sm font-bold text-white">
                05
              </span>
              Auction Mechanics
            </h2>
            <div className="mt-6 space-y-4">
              <div className="rounded-none bg-slate-950 p-6 ring-1 ring-white/5">
                <h3 className="text-sm font-bold text-white">Configuration Lock</h3>
                <p className="mt-2 text-xs leading-relaxed text-slate-400">
                  Once an auction transitions from SCHEDULED to LIVE, the following fields are immutable: pursePerTeam, squadSize, maxTeams, currency, lotTimerSeconds, bidResetSeconds, and bidIncrementTiers. Organizers must configure these correctly before starting.
                </p>
              </div>
              <div className="rounded-none bg-slate-950 p-6 ring-1 ring-white/5">
                <h3 className="text-sm font-bold text-white">Round Types</h3>
                <p className="mt-2 text-xs leading-relaxed text-slate-400">
                  <strong className="text-white">Normal Rounds</strong> cover the initial player pool. When all normal rounds complete, the system auto-generates an <strong className="text-white">Unsold Round</strong> for players with lotOutcome UNSOLD. Players in unsold rounds reset to NOT_LISTED and can be re-bid.
                </p>
              </div>
              <div className="rounded-none bg-slate-950 p-6 ring-1 ring-white/5">
                <h3 className="text-sm font-bold text-white">Completion Invariant</h3>
                <p className="mt-2 text-xs leading-relaxed text-slate-400">
                  An auction cannot be marked COMPLETED until every approved player has a terminal state: SOLD or PERMANENT_UNSOLD. The system enforces this at the database level.
                </p>
              </div>
            </div>
          </section>

          {/* Bidding */}
          <section id="bidding" className="scroll-mt-28">
            <h2 className="flex items-center gap-3 text-2xl font-bold text-slate-900">
              <span className="flex h-8 w-8 items-center justify-center bg-slate-900 text-sm font-bold text-white">
                06
              </span>
              Bidding Rules & Binding Nature
            </h2>
            <div className="mt-6 space-y-4">
              {[
                {
                  title: "Binding Commitment",
                  desc: "A bid is a binding offer. If the organizer hammers the lot in your favor, your reservation converts to a spend and the player joins your roster. This is irreversible.",
                },
                {
                  title: "Wallet Reservations",
                  desc: "When you place a bid, the amount is reserved from your available budget. It is not yet spent, but it cannot be used for other bids. If outbid, the reservation is instantly released.",
                },
                {
                  title: "Minimum Bid Enforcement",
                  desc: "The platform enforces effective minimums: basePrice for first bids, currentBid + increment for subsequent bids. Bids below this threshold are rejected with error code 400.",
                },
                {
                  title: "Timer Extension",
                  desc: "Bids placed within the final bidResetSeconds of the lot timer extend the timer to the reset duration. This prevents last-second sniping.",
                },
                {
                  title: "Squad Lockout",
                  desc: "You cannot place bids if your roster has reached the tournament's squadSize limit. The check runs inside the bid transaction.",
                },
              ].map((rule) => (
                <div key={rule.title} className="flex gap-4 rounded-none bg-white p-6 ring-1 ring-slate-200">
                  <Gavel className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">{rule.title}</h3>
                    <p className="mt-1 text-xs leading-relaxed text-slate-500">{rule.desc}</p>
                  </div>
                </div>
              ))}

              <div className="rounded-sm bg-rose-50 p-6 ring-1 ring-rose-200">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-rose-600" />
                  <div>
                    <h3 className="text-sm font-bold text-rose-900">No Real Money</h3>
                    <p className="mt-1 text-xs leading-relaxed text-rose-700">
                      GullyBid operates with virtual currency only. Purses, bids, and sold prices are numerical values within the platform. No fiat currency changes hands through the platform. Organizers may arrange real-world payments outside the platform at their own discretion and risk.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Squads */}
          <section id="squads" className="scroll-mt-28">
            <h2 className="flex items-center gap-3 text-2xl font-bold text-slate-900">
              <span className="flex h-8 w-8 items-center justify-center bg-slate-900 text-sm font-bold text-white">
                07
              </span>
              Squad Composition
            </h2>
            <div className="mt-6 rounded-none bg-white p-8 ring-1 ring-slate-200">
              <p className="text-sm leading-relaxed text-slate-600">
                Squads are constrained by the tournament's <code className="rounded-sm bg-slate-100 px-1 py-0.5 font-mono text-xs">squadSize</code> field. Once a team's roster length equals this limit, all bidding is permanently locked for that team. There is no post-auction trading unless the organizer explicitly enables it.
              </p>
              <div className="mt-6 grid gap-4 sm:grid-cols-3">
                <div className="rounded-sm bg-slate-50 p-4 text-center">
                  <p className="text-2xl font-bold text-slate-900">11–25</p>
                  <p className="mt-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500">Typical squad size</p>
                </div>
                <div className="rounded-sm bg-slate-50 p-4 text-center">
                  <p className="text-2xl font-bold text-slate-900">₹50L–₹100Cr</p>
                  <p className="mt-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500">Typical purse range</p>
                </div>
                <div className="rounded-sm bg-slate-50 p-4 text-center">
                  <p className="text-2xl font-bold text-slate-900">Permanent</p>
                  <p className="mt-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500">Roster lock post-auction</p>
                </div>
              </div>
            </div>
          </section>

          {/* Content */}
          <section id="content" className="scroll-mt-28">
            <h2 className="flex items-center gap-3 text-2xl font-bold text-slate-900">
              <span className="flex h-8 w-8 items-center justify-center bg-slate-900 text-sm font-bold text-white">
                08
              </span>
              Content & Intellectual Property
            </h2>
            <div className="mt-6 space-y-4">
              <div className="rounded-none bg-white p-6 ring-1 ring-slate-200">
                <h3 className="text-sm font-bold text-slate-900">Your Content</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">
                  You retain ownership of franchise logos, player profile images, and tournament descriptions uploaded to the platform. By uploading, you grant GullyBid a license to store, display, and distribute this content solely for the purpose of operating the platform.
                </p>
              </div>
              <div className="rounded-none bg-white p-6 ring-1 ring-slate-200">
                <h3 className="text-sm font-bold text-slate-900">Platform Content</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">
                  The GullyBid name, logo, UI design, and auction algorithms are the exclusive property of GullyBid Technologies Pvt. Ltd. You may not scrape, reverse-engineer, or replicate the platform's real-time bidding mechanics.
                </p>
              </div>
            </div>
          </section>

          {/* Prohibited */}
          <section id="prohibited" className="scroll-mt-28">
            <h2 className="flex items-center gap-3 text-2xl font-bold text-slate-900">
              <span className="flex h-8 w-8 items-center justify-center bg-slate-900 text-sm font-bold text-white">
                09
              </span>
              Prohibited Conduct
            </h2>
            <div className="mt-6 space-y-3">
              {[
                "Using bots, scripts, or automated tools to place bids or monitor auctions.",
                "Colluding with other franchise owners to manipulate player prices or pool outcomes.",
                "Creating multiple accounts to bypass registration limits or approval gates.",
                "Uploading content that infringes third-party intellectual property rights.",
                "Attempting to access auctions, tournaments, or data you do not have permission to view.",
                "Interfering with Socket.IO connections or attempting to inject false bid events.",
                "Harassing organizers, players, or other franchise owners through the platform.",
                "Falsifying player profiles, franchise details, or tournament metadata.",
              ].map((item, i) => (
                <div key={i} className="flex items-start gap-3 rounded-none bg-white p-4 ring-1 ring-slate-200">
                  <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-400" />
                  <p className="text-sm text-slate-600">{item}</p>
                </div>
              ))}
            </div>
            <div className="mt-4 rounded-sm bg-slate-950 p-4">
              <p className="text-xs font-bold text-white">Enforcement</p>
              <p className="mt-1 text-xs text-slate-400">
                Violations result in immediate account suspension, forfeiture of active auction positions, and permanent ban from future tournaments. We reserve the right to report criminal activity to appropriate authorities.
              </p>
            </div>
          </section>

          {/* Liability */}
          <section id="liability" className="scroll-mt-28">
            <h2 className="flex items-center gap-3 text-2xl font-bold text-slate-900">
              <span className="flex h-8 w-8 items-center justify-center bg-slate-900 text-sm font-bold text-white">
                10
              </span>
              Limitation of Liability
            </h2>
            <div className="mt-6 space-y-4">
              <div className="rounded-none bg-white p-6 ring-1 ring-slate-200">
                <p className="text-sm leading-relaxed text-slate-600">
                  GullyBid provides the platform <strong className="text-slate-900">as-is</strong> and <strong className="text-slate-900">as-available</strong>. We do not guarantee uninterrupted access to live auctions, nor do we guarantee that bid placement will always succeed under network partition conditions.
                </p>
              </div>
              <div className="rounded-none bg-white p-6 ring-1 ring-slate-200">
                <p className="text-sm leading-relaxed text-slate-600">
                  To the maximum extent permitted by law, GullyBid's liability for any claim arising from your use of the platform is limited to the amount you have paid us in the 12 months preceding the claim. Since the platform currently operates without user fees, this liability may be zero.
                </p>
              </div>
              <div className="rounded-none bg-amber-50 p-6 ring-1 ring-amber-200">
                <p className="text-xs font-semibold text-amber-900">Organizer Responsibility</p>
                <p className="mt-2 text-xs leading-relaxed text-amber-700">
                  Tournament organizers are independently responsible for real-world prize distributions, player contracts, and venue arrangements. GullyBid is a software platform, not a tournament promoter or financial intermediary.
                </p>
              </div>
            </div>
          </section>

          {/* Termination */}
          <section id="termination" className="scroll-mt-28">
            <h2 className="flex items-center gap-3 text-2xl font-bold text-slate-900">
              <span className="flex h-8 w-8 items-center justify-center bg-slate-900 text-sm font-bold text-white">
                11
              </span>
              Termination & Suspension
            </h2>
            <div className="mt-6 grid gap-6 md:grid-cols-2">
              <div className="rounded-none bg-white p-6 ring-1 ring-slate-200">
                <h3 className="text-sm font-bold text-slate-900">By You</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">
                  You may delete your account at any time. We will purge your User record, anonymize your bid history, and delete your profile images from Cloudinary within 30 days.
                </p>
              </div>
              <div className="rounded-none bg-white p-6 ring-1 ring-slate-200">
                <h3 className="text-sm font-bold text-slate-900">By Us</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">
                  We may suspend or terminate your account for prohibited conduct, payment disputes (if applicable), or legal requirements. Active auction reservations are voided upon suspension.
                </p>
              </div>
            </div>
          </section>

          {/* Disputes */}
          <section id="disputes" className="scroll-mt-28">
            <h2 className="flex items-center gap-3 text-2xl font-bold text-slate-900">
              <span className="flex h-8 w-8 items-center justify-center bg-slate-900 text-sm font-bold text-white">
                12
              </span>
              Dispute Resolution
            </h2>
            <div className="mt-6 rounded-none bg-white p-8 ring-1 ring-slate-200">
              <div className="grid gap-8 md:grid-cols-3">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Step 1</p>
                  <h3 className="mt-2 text-sm font-bold text-slate-900">Internal Resolution</h3>
                  <p className="mt-2 text-xs leading-relaxed text-slate-500">
                    Contact support with tournament ID, auction ID, and timestamps. We review auction logs and bid records.
                  </p>
                </div>
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Step 2</p>
                  <h3 className="mt-2 text-sm font-bold text-slate-900">Mediation</h3>
                  <p className="mt-2 text-xs leading-relaxed text-slate-500">
                    If unresolved within 30 days, parties may engage a mutually agreed mediator in Bangalore, India.
                  </p>
                </div>
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Step 3</p>
                  <h3 className="mt-2 text-sm font-bold text-slate-900">Arbitration</h3>
                  <p className="mt-2 text-xs leading-relaxed text-slate-500">
                    Final disputes are resolved by binding arbitration under the Arbitration and Conciliation Act, 1996, seated in Bangalore.
                  </p>
                </div>
              </div>
              <div className="mt-8 border-t border-slate-100 pt-6">
                <p className="text-xs text-slate-500">
                  <strong className="text-slate-700">Governing Law:</strong> These terms are governed by the laws of India. The courts of Bangalore, Karnataka have exclusive jurisdiction over any disputes not subject to arbitration.
                </p>
              </div>
            </div>
          </section>

          {/* Footer CTA */}
          <div className="flex items-center justify-between border-t border-slate-200 pt-8">
            <p className="text-xs text-slate-400">
              Effective 12 August 2026. Previous versions available on request.
            </p>
            <Link
              to="/privacy"
              className="flex items-center gap-2 text-sm font-semibold text-indigo-600 hover:text-indigo-700"
            >
              Read Privacy Policy <ArrowUpRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </main>
      </div>
    </div>
  );
}