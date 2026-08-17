import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search,
  ChevronDown,
  HelpCircle,
  User,
  Gavel,
  Wallet,
  Shield,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Clock,
  MessageSquare,
} from "lucide-react";

type Category = "All" | "Account" | "Auctions" | "Bidding" | "Teams" | "Players" | "Technical";

interface FAQItem {
  q: string;
  a: React.ReactNode;
  category: Category;
  popular?: boolean;
}

const FAQS: FAQItem[] = [
  {
    q: "Why can't I place a bid?",
    category: "Bidding",
    popular: true,
    a: (
      <div className="space-y-3 text-sm text-slate-400">
        <p>Bid placement is blocked by several hard invariants. Check each:</p>
        <ul className="space-y-2">
          <li className="flex gap-2">
            <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-400" />
            <span><strong className="text-slate-600">Auction status:</strong> Must be LIVE. SCHEDULED, PAUSED, or COMPLETED auctions reject all bids.</span>
          </li>
          <li className="flex gap-2">
            <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-400" />
            <span><strong className="text-slate-600">Team approval:</strong> Your franchise must be APPROVED by the organizer. PENDING or REJECTED teams cannot bid.</span>
          </li>
          <li className="flex gap-2">
            <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-400" />
            <span><strong className="text-slate-600">Squad capacity:</strong> If <code className="rounded-sm bg-slate-800 px-1 py-0.5 font-mono text-slate-300">roster.length ≥ squadSize</code>, bidding is permanently locked for your team.</span>
          </li>
          <li className="flex gap-2">
            <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-400" />
            <span><strong className="text-slate-600">Active lot:</strong> A lot must be in BIDDING state. If no lot is open, the bid button is inactive.</span>
          </li>
          <li className="flex gap-2">
            <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-400" />
            <span><strong className="text-slate-600">Self-outbid:</strong> You cannot bid if you already hold the highest bid on the current lot.</span>
          </li>
        </ul>
      </div>
    ),
  },
  {
    q: "What happens to my reserved money if I'm outbid?",
    category: "Bidding",
    popular: true,
    a: (
      <div className="space-y-3 text-sm text-slate-400">
        <p>
          The moment another team places a higher valid bid, your reservation is <strong className="text-emerald-400">instantly released</strong>. The full amount returns to your available budget with zero penalty and zero delay.
        </p>
        <div className="rounded-sm bg-slate-900 p-4 font-mono text-xs text-slate-300">
          <p>// Wallet state transition</p>
          <p className="mt-1 text-slate-500">reserved: 800000 → 0</p>
          <p className="text-emerald-400">remaining: 3200000 → 4000000</p>
        </div>
      </div>
    ),
  },
  {
    q: "How do unsold rounds work?",
    category: "Auctions",
    popular: true,
    a: (
      <div className="space-y-3 text-sm text-slate-400">
        <p>
          When all <strong className="text-slate-600">normal rounds</strong> complete, the system automatically evaluates unsold inventory. If any players remain with <code className="rounded-sm bg-slate-800 px-1 py-0.5 font-mono text-slate-300">lotOutcome: UNSOLD</code>, an unsold round is auto-generated.
        </p>
        <p>
          These players reset to <code className="rounded-sm bg-slate-800 px-1 py-0.5 font-mono text-slate-300">NOT_LISTED</code> and can be re-opened for bidding. If they go unsold again, the organizer may mark them <code className="rounded-sm bg-slate-800 px-1 py-0.5 font-mono text-slate-300">PERMANENT_UNSOLD</code> to close the auction.
        </p>
      </div>
    ),
  },
  {
    q: "Can I edit auction rules after scheduling?",
    category: "Auctions",
    a: (
      <div className="text-sm text-slate-400">
        <p>
          Yes, but <strong className="text-rose-400">only while the auction is in DRAFT or SCHEDULED status</strong>. Once LIVE, the following fields are locked:
        </p>
        <ul className="mt-2 space-y-1 text-xs">
          <li>• Purse per team</li>
          <li>• Squad size</li>
          <li>• Lot timer duration</li>
          <li>• Bid increment tiers</li>
        </ul>
      </div>
    ),
  },
  {
    q: "Why was my player registration rejected?",
    category: "Players",
    a: (
      <div className="text-sm text-slate-400">
        <p>Organizers reject registrations for specific reasons. Common causes:</p>
        <ul className="mt-2 space-y-1.5">
          <li className="flex gap-2"><AlertTriangle className="h-3.5 w-3.5 text-amber-400" /> Player registration window has closed</li>
          <li className="flex gap-2"><AlertTriangle className="h-3.5 w-3.5 text-amber-400" /> Player pool capacity reached</li>
          <li className="flex gap-2"><AlertTriangle className="h-3.5 w-3.5 text-amber-400" /> Incomplete player profile (missing role, image, etc.)</li>
        </ul>
        <p className="mt-3">The rejection reason is sent to your notification center.</p>
      </div>
    ),
  },
  {
    q: "How does the bid timer extension work?",
    category: "Bidding",
    a: (
      <div className="text-sm text-slate-400">
        <p>
          Every auction configures a <code className="rounded-sm bg-slate-800 px-1 py-0.5 font-mono text-slate-400">bidResetSeconds</code> value (default 12s). If a bid arrives when the remaining timer is less than this value, the timer extends to the reset duration.
        </p>
        <div className="mt-3 flex items-center gap-3 rounded-sm bg-slate-900 p-3">
          <Clock className="h-4 w-4 text-rose-400" />
          <span className="font-mono text-xs text-slate-300">
            Timer: 3s remaining → Bid placed → Timer resets to 12s
          </span>
        </div>
      </div>
    ),
  },
  {
    q: "Can I change my franchise logo after registration?",
    category: "Account",
    a: (
      <div className="text-sm text-slate-400">
        <p>
          Yes. Navigate to your franchise profile. You have two upload paths:
        </p>
        <ol className="mt-2 list-decimal space-y-1 pl-4 text-xs">
          <li><strong className="text-slate-600">Library path:</strong> Paste a Cloudinary URL. The system extracts the publicId for cleanup.</li>
          <li><strong className="text-slate-600">Custom upload:</strong> Upload a file buffer directly. The old logo is destroyed after successful save.</li>
        </ol>
      </div>
    ),
  },
  {
    q: "What is the minimum team requirement to start an auction?",
    category: "Auctions",
    a: (
      <div className="text-sm text-slate-400">
        <p>
          The platform enforces a <strong className="text-slate-600">minimum of 2 approved teams</strong> before an auction can transition from SCHEDULED to LIVE. This is a hard invariant in <code className="font-mono text-slate-300">AuctionService.start()</code>.
        </p>
      </div>
    ),
  },
  {
    q: "Why does my wallet show less than my initial purse?",
    category: "Teams",
    a: (
      <div className="text-sm text-slate-400">
        <p>Your wallet has three buckets:</p>
        <div className="mt-3 space-y-2">
          <div className="flex justify-between rounded-sm bg-indigo-500/10 px-3 py-2 text-xs">
            <span className="text-indigo-500">Spent</span>
            <span className="font-mono text-indigo-200">Committed to roster</span>
          </div>
          <div className="flex justify-between rounded-sm bg-amber-500/10 px-3 py-2 text-xs">
            <span className="text-amber-500">Reserved</span>
            <span className="font-mono text-amber-200">Active highest bid</span>
          </div>
          <div className="flex justify-between rounded-sm bg-emerald-500/10 px-3 py-2 text-xs">
            <span className="text-emerald-500">Remaining</span>
            <span className="font-mono text-emerald-200">Available to bid</span>
          </div>
        </div>
        <p className="mt-3 text-xs">Only Remaining + Reserved equals your unspent budget.</p>
      </div>
    ),
  },
  {
    q: "The auction page is not loading live updates.",
    category: "Technical",
    a: (
      <div className="text-sm text-slate-400">
        <p>Live auction data streams via Socket.IO. If updates stop:</p>
        <ul className="mt-2 space-y-1.5 text-xs">
          <li className="flex gap-2"><CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" /> Refresh the page — the socket reconnects automatically</li>
          <li className="flex gap-2"><CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" /> Check your network tab for WebSocket (ws://) connections</li>
          <li className="flex gap-2"><CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" /> Disable browser extensions that block WebSockets</li>
          <li className="flex gap-2"><CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" /> Ensure you are in the correct auction room URL</li>
        </ul>
      </div>
    ),
  },
];

const CATEGORIES: { id: Category; icon: React.ElementType; count: number }[] = [
  { id: "All", icon: HelpCircle, count: FAQS.length },
  { id: "Account", icon: User, count: FAQS.filter((f) => f.category === "Account").length },
  { id: "Auctions", icon: Gavel, count: FAQS.filter((f) => f.category === "Auctions").length },
  { id: "Bidding", icon: Wallet, count: FAQS.filter((f) => f.category === "Bidding").length },
  { id: "Teams", icon: Shield, count: FAQS.filter((f) => f.category === "Teams").length },
  { id: "Players", icon: User, count: FAQS.filter((f) => f.category === "Players").length },
  { id: "Technical", icon: AlertTriangle, count: FAQS.filter((f) => f.category === "Technical").length },
];

export default function FAQPage() {
  const [activeCategory, setActiveCategory] = useState<Category>("All");
  const [search, setSearch] = useState("");
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const filtered = useMemo(() => {
    let list = FAQS;
    if (activeCategory !== "All") list = list.filter((f) => f.category === activeCategory);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((f) => f.q.toLowerCase().includes(q) || f.category.toLowerCase().includes(q));
    }
    return list;
  }, [activeCategory, search]);

  return (
    <div className="space-y-12">
      {/* Hero */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex items-center gap-2 text-indigo-600">
          <MessageSquare className="h-5 w-5" />
          <span className="text-xs font-bold uppercase tracking-widest">Knowledge Base</span>
        </div>
        <h1 className="mt-3 text-4xl font-extrabold tracking-tight text-slate-900 lg:text-5xl">
          Frequently Asked Questions
        </h1>
        <p className="mt-4 max-w-2xl text-lg leading-relaxed text-slate-500">
          Domain-specific answers built from the actual platform logic. No generic fluff.
        </p>

        <div className="relative mt-8 max-w-2xl">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search questions..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-none border border-slate-200 bg-white py-4 pl-12 pr-4 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </div>
      </motion.div>

      {/* Category Filter */}
      <div className="flex flex-wrap gap-2">
        {CATEGORIES.map((cat) => (
          <button
            key={cat.id}
            onClick={() => setActiveCategory(cat.id)}
            className={`flex items-center gap-2 rounded-none px-4 py-2.5 text-[13px] font-semibold transition-all ${
              activeCategory === cat.id
                ? "bg-slate-900 text-white shadow-md"
                : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50"
            }`}
          >
            <cat.icon className="h-3.5 w-3.5" />
            {cat.id}
            <span
              className={`ml-1 rounded-sm px-1.5 py-0.5 text-[10px] font-bold ${
                activeCategory === cat.id ? "bg-slate-700 text-slate-300" : "bg-slate-100 text-slate-500"
              }`}
            >
              {cat.count}
            </span>
          </button>
        ))}
      </div>

      {/* FAQ List */}
      <div className="space-y-3">
        <AnimatePresence mode="popLayout">
          {filtered.map((faq, i) => (
            <motion.div
              layout
              key={faq.q}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.98 }}
              transition={{ delay: i * 0.03 }}
              className="rounded-none bg-white ring-1 ring-slate-200"
            >
              <button
                onClick={() => setOpenIndex(openIndex === i ? null : i)}
                className="flex w-full items-center justify-between p-6 text-left transition-colors hover:bg-slate-50"
              >
                <div className="flex items-center gap-4">
                  {faq.popular && (
                    <span className="shrink-0 rounded-sm bg-amber-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-700">
                      Popular
                    </span>
                  )}
                  <span className="text-sm font-semibold text-slate-900">{faq.q}</span>
                </div>
                <ChevronDown
                  className={`h-4 w-4 shrink-0 text-slate-400 transition-transform ${
                    openIndex === i ? "rotate-180" : ""
                  }`}
                />
              </button>
              <AnimatePresence>
                {openIndex === i && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.25 }}
                    className="overflow-hidden"
                  >
                    <div className="border-t border-slate-100 px-6 pb-6 pt-4">{faq.a}</div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          ))}
        </AnimatePresence>

        {filtered.length === 0 && (
          <div className="rounded-none bg-slate-50 p-12 text-center ring-1 ring-slate-200">
            <HelpCircle className="mx-auto h-8 w-8 text-slate-300" />
            <p className="mt-3 text-sm font-medium text-slate-600">No questions found for "{search}"</p>
            <p className="mt-1 text-xs text-slate-400">Try a different keyword or contact support directly.</p>
          </div>
        )}
      </div>
    </div>
  );
}