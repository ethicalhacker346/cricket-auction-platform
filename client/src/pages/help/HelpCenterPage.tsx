import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Link } from "react-router-dom";
import {
  Search,
  Zap,
  Shield,
  Users,
  Trophy,
  ArrowRight,
  Clock,
  BookOpen,
  MessageSquare,
  Radio,
  AlertTriangle,
  CheckCircle2,
} from "lucide-react";

const ROLE_CARDS = [
  {
    role: "Organizer",
    icon: Shield,
    color: "text-violet-400",
    bg: "bg-violet-500/10",
    border: "border-violet-500/20",
    links: [
      { label: "Schedule your first auction", to: "/help/guidelines" },
      { label: "Approve team registrations", to: "/help/guidelines" },
      { label: "Manage bid increment tiers", to: "/help/guidelines" },
      { label: "Handle unsold players", to: "/help/auctions" },
    ],
  },
  {
    role: "Franchise Owner",
    icon: Trophy,
    color: "text-amber-400",
    bg: "bg-amber-500/10",
    border: "border-amber-500/20",
    links: [
      { label: "Place your first bid", to: "/help/bidding" },
      { label: "Understand wallet reservations", to: "/help/bidding" },
      { label: "Squad size limits", to: "/help/squads" },
      { label: "Bid timer mechanics", to: "/help/bidding" },
    ],
  },
  {
    role: "Player",
    icon: Users,
    color: "text-sky-400",
    bg: "bg-sky-500/10",
    border: "border-sky-500/20",
    links: [
      { label: "Register for a tournament", to: "/help/auctions" },
      { label: "Set your base price", to: "/help/auctions" },
      { label: "Track your auction status", to: "/help/auctions" },
      { label: "What if I go unsold?", to: "/help/auctions" },
    ],
  },
];

const QUICK_TOPICS = [
  { icon: Zap, label: "Auction won't start", to: "/faq", tag: "Common" },
  { icon: Clock, label: "Timer not extending", to: "/help/bidding", tag: "Bidding" },
  { icon: AlertTriangle, label: "Wallet shows wrong balance", to: "/help/bidding", tag: "Purse" },
  { icon: Users, label: "Team approval pending", to: "/faq", tag: "Registration" },
  { icon: BookOpen, label: "Unsold round explained", to: "/help/auctions", tag: "Rounds" },
  { icon: MessageSquare, label: "Change franchise logo", to: "/faq", tag: "Account" },
];

const UPDATES = [
  { date: "Aug 2026", title: "Auto-generated unsold rounds", desc: "System now creates unsold rounds automatically when normal rounds complete." },
  { date: "Jul 2026", title: "Bid reset extensions", desc: "New bids in final seconds now extend the lot timer by the configured reset duration." },
  { date: "Jun 2026", title: "Permanent unsold marking", desc: "Organizers can now permanently remove players from the auction pool." },
];

export default function HelpCenterPage() {
  const [query, setQuery] = useState("");

  const filteredTopics = useMemo(() => {
    if (!query.trim()) return QUICK_TOPICS;
    return QUICK_TOPICS.filter((t) =>
      t.label.toLowerCase().includes(query.toLowerCase())
    );
  }, [query]);

  return (
    <div className="space-y-16">
      {/* Hero */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
      >
        <div className="flex items-center gap-2 text-indigo-600">
          <Radio className="h-5 w-5" />
          <span className="text-xs font-bold uppercase tracking-widest">Command Center</span>
        </div>
        <h1 className="mt-3 text-4xl font-extrabold tracking-tight text-slate-900 lg:text-5xl">
          Help Center
        </h1>
        <p className="mt-4 max-w-2xl text-lg leading-relaxed text-slate-500">
          Instant answers. Deep documentation. Direct support. Everything you need to run or compete in a world-class cricket auction.
        </p>

        {/* Search */}
        <div className="relative mt-8 max-w-2xl">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search topics, errors, or workflows..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full rounded-none border border-slate-200 bg-white py-4 pl-12 pr-4 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </div>
      </motion.div>

      {/* Role Cards */}
      <section className="grid gap-6 lg:grid-cols-3">
        {ROLE_CARDS.map((card, i) => (
          <motion.div
            key={card.role}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: i * 0.1 }}
            className={`rounded-none bg-white p-8 ring-1 ring-slate-200 ${card.border}`}
          >
            <div className={`inline-flex h-10 w-10 items-center justify-center ${card.bg}`}>
              <card.icon className={`h-5 w-5 ${card.color}`} />
            </div>
            <h3 className="mt-4 text-lg font-bold text-slate-900">{card.role}</h3>
            <ul className="mt-4 space-y-2.5">
              {card.links.map((link) => (
                <li key={link.label}>
                  <Link
                    to={link.to}
                    className="group flex items-center justify-between text-sm text-slate-600 transition-colors hover:text-indigo-600"
                  >
                    <span>{link.label}</span>
                    <ArrowRight className="h-3.5 w-3.5 opacity-0 transition-all group-hover:opacity-100 group-hover:translate-x-1" />
                  </Link>
                </li>
              ))}
            </ul>
          </motion.div>
        ))}
      </section>

      {/* Quick Topics */}
      <section>
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-slate-900">Quick Rescue</h2>
          <Link to="/faq" className="text-sm font-medium text-indigo-600 hover:text-indigo-700">
            Browse all FAQs
          </Link>
        </div>

        <AnimatePresence mode="popLayout">
          <motion.div
            layout
            className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3"
          >
            {filteredTopics.map((topic) => (
              <motion.div
                layout
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                key={topic.label}
              >
                <Link
                  to={topic.to}
                  className="flex items-center gap-4 rounded-none bg-white p-5 ring-1 ring-slate-200 transition-all hover:shadow-md hover:ring-indigo-200"
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center bg-slate-100">
                    <topic.icon className="h-5 w-5 text-slate-600" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-slate-900">{topic.label}</p>
                    <p className="mt-0.5 text-[11px] font-medium uppercase tracking-wider text-slate-400">
                      {topic.tag}
                    </p>
                  </div>
                  <ArrowRight className="h-4 w-4 shrink-0 text-slate-300" />
                </Link>
              </motion.div>
            ))}
          </motion.div>
        </AnimatePresence>

        {filteredTopics.length === 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="mt-8 rounded-none bg-slate-50 p-8 text-center ring-1 ring-slate-200"
          >
            <p className="text-sm font-medium text-slate-600">No topics match "{query}"</p>
            <Link
              to="/contact"
              className="mt-2 inline-block text-sm font-semibold text-indigo-600 hover:text-indigo-700"
            >
              Contact support instead →
            </Link>
          </motion.div>
        )}
      </section>

      {/* Platform Updates */}
      <section className="rounded-none bg-slate-950 p-8 ring-1 ring-white/5">
        <div className="flex items-center gap-2">
          <Zap className="h-4 w-4 text-amber-400" />
          <h2 className="text-sm font-semibold text-white">Platform Updates</h2>
        </div>
        <div className="mt-6 space-y-4">
          {UPDATES.map((update, i) => (
            <div key={i} className="flex gap-4 border-l-2 border-slate-800 pl-4">
              <span className="shrink-0 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                {update.date}
              </span>
              <div>
                <p className="text-sm font-semibold text-slate-200">{update.title}</p>
                <p className="mt-0.5 text-xs leading-relaxed text-slate-500">{update.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Emergency CTA */}
      <section className="flex flex-col items-center justify-between gap-6 rounded-none bg-indigo-600 p-8 sm:flex-row">
        <div>
          <h3 className="text-lg font-bold text-white">Live auction emergency?</h3>
          <p className="mt-1 text-sm text-indigo-100">
            If your auction is stuck, timer frozen, or bids not registering — reach us directly.
          </p>
        </div>
        <Link
          to="/contact"
          className="shrink-0 rounded-none bg-white px-6 py-3 text-sm font-bold text-indigo-600 shadow-lg transition-all hover:bg-indigo-50"
        >
          Contact Support
        </Link>
      </section>
    </div>
  );
}