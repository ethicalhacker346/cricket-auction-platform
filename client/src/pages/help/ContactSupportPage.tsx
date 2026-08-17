import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Mail,
  Send,
  Clock,
  Shield,
  AlertTriangle,
  CheckCircle2,
  MapPin,
  Phone,
  MessageSquare,
  Paperclip,
  X,
  User,
  Tag,
  FileText,
} from "lucide-react";

type Priority = "low" | "medium" | "high" | "critical";

const PRIORITY_CONFIG: Record<
  Priority,
  { label: string; color: string; bg: string; border: string; desc: string }
> = {
  low: {
    label: "Low",
    color: "text-slate-600",
    bg: "bg-slate-100",
    border: "border-slate-200",
    desc: "General inquiry, feature request, or feedback",
  },
  medium: {
    label: "Medium",
    color: "text-sky-700",
    bg: "bg-sky-50",
    border: "border-sky-200",
    desc: "Account issue, non-urgent bug, or data discrepancy",
  },
  high: {
    label: "High",
    color: "text-amber-700",
    bg: "bg-amber-50",
    border: "border-amber-200",
    desc: "Auction blocked, wallet miscalculation, or team approval stuck",
  },
  critical: {
    label: "Critical",
    color: "text-rose-700",
    bg: "bg-rose-50",
    border: "border-rose-200",
    desc: "Live auction frozen, security breach, or data loss",
  },
};

const CATEGORIES = [
  { id: "auction", label: "Auction Issue", icon: Shield },
  { id: "bidding", label: "Bidding / Wallet", icon: Tag },
  { id: "registration", label: "Registration", icon: User },
  { id: "account", label: "Account / Auth", icon: FileText },
  { id: "bug", label: "Bug Report", icon: AlertTriangle },
  { id: "feature", label: "Feature Request", icon: MessageSquare },
];

const COMMON_FIXES = [
  { title: "Clear browser cache", desc: "Fixes 90% of live auction UI glitches", icon: Clock },
  { title: "Check your team status", desc: "Ensure your franchise is APPROVED, not PENDING", icon: Shield },
  { title: "Verify auction state", desc: "Bidding only works when auction is LIVE", icon: Tag },
];

export default function ContactSupportPage() {
  const [form, setForm] = useState({
    name: "",
    email: "",
    role: "",
    category: "",
    subject: "",
    message: "",
    priority: "medium" as Priority,
  });
  const [submitted, setSubmitted] = useState(false);
  const [charCount, setCharCount] = useState(0);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
  };

  if (submitted) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="flex min-h-[60vh] flex-col items-center justify-center rounded-none bg-white p-12 ring-1 ring-slate-200"
      >
        <div className="flex h-16 w-16 items-center justify-center bg-emerald-100">
          <CheckCircle2 className="h-8 w-8 text-emerald-600" />
        </div>
        <h2 className="mt-6 text-2xl font-bold text-slate-900">Ticket Submitted</h2>
        <p className="mt-2 max-w-md text-center text-sm leading-relaxed text-slate-500">
          Your support request has been logged. Our team typically responds within{" "}
          <strong className="text-slate-700">2 hours</strong> for high-priority auction issues.
        </p>
        <div className="mt-8 flex gap-3">
          <button
            onClick={() => setSubmitted(false)}
            className="rounded-none bg-slate-900 px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-slate-800"
          >
            Send Another
          </button>
          <button
            onClick={() => window.location.href = "/dashboard"}
            className="rounded-none bg-white px-6 py-2.5 text-sm font-semibold text-slate-700 ring-1 ring-slate-200 transition-colors hover:bg-slate-50"
          >
            Back to Dashboard
          </button>
        </div>
      </motion.div>
    );
  }

  return (
    <div className="space-y-12">
      {/* Hero */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex items-center gap-2 text-indigo-600">
          <Mail className="h-5 w-5" />
          <span className="text-xs font-bold uppercase tracking-widest">Concierge</span>
        </div>
        <h1 className="mt-3 text-4xl font-extrabold tracking-tight text-slate-900 lg:text-5xl">
          Contact Support
        </h1>
        <p className="mt-4 max-w-2xl text-lg leading-relaxed text-slate-500">
          Direct line to the GullyBid operations team. We prioritize live auction emergencies
          and respond to all inquiries within 2–24 hours.
        </p>
      </motion.div>

      <div className="grid gap-10 lg:grid-cols-5">
        {/* Form */}
        <div className="lg:col-span-3">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Priority Selector */}
            <div className="rounded-none bg-white p-6 ring-1 ring-slate-200">
              <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                Priority Level
              </label>
              <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
                {(Object.keys(PRIORITY_CONFIG) as Priority[]).map((p) => {
                  const config = PRIORITY_CONFIG[p];
                  const active = form.priority === p;
                  return (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setForm((f) => ({ ...f, priority: p }))}
                      className={`rounded-none p-3 text-left transition-all ${
                        active
                          ? `${config.bg} ${config.border} ring-1`
                          : "bg-slate-50 ring-1 ring-slate-200 hover:bg-slate-100"
                      }`}
                    >
                      <span className={`text-xs font-bold ${active ? config.color : "text-slate-600"}`}>
                        {config.label}
                      </span>
                      <p className={`mt-1 text-[10px] leading-tight ${active ? config.color : "text-slate-400"}`}>
                        {config.desc}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Identity */}
            <div className="grid gap-6 sm:grid-cols-2">
              <div>
                <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                  Full Name
                </label>
                <input
                  required
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  className="mt-2 block w-full rounded-none border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  placeholder="Your name"
                />
              </div>
              <div>
                <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                  Email Address
                </label>
                <input
                  required
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                  className="mt-2 block w-full rounded-none border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  placeholder="you@franchise.com"
                />
              </div>
            </div>

            {/* Context */}
            <div className="grid gap-6 sm:grid-cols-2">
              <div>
                <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                  Your Role
                </label>
                <select
                  required
                  value={form.role}
                  onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}
                  className="mt-2 block w-full rounded-none border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                >
                  <option value="">Select role...</option>
                  <option value="organizer">Tournament Organizer</option>
                  <option value="franchise">Franchise Owner</option>
                  <option value="player">Player</option>
                  <option value="admin">Platform Admin</option>
                </select>
              </div>
              <div>
                <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                  Category
                </label>
                <div className="mt-2 grid grid-cols-3 gap-2">
                  {CATEGORIES.map((cat) => (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => setForm((f) => ({ ...f, category: cat.id }))}
                      className={`flex flex-col items-center gap-1.5 rounded-none p-2.5 text-center transition-all ${
                        form.category === cat.id
                          ? "bg-indigo-50 text-indigo-700 ring-1 ring-indigo-200"
                          : "bg-slate-50 text-slate-600 ring-1 ring-slate-200 hover:bg-slate-100"
                      }`}
                    >
                      <cat.icon className="h-3.5 w-3.5" />
                      <span className="text-[10px] font-semibold">{cat.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Subject */}
            <div>
              <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                Subject
              </label>
              <input
                required
                type="text"
                value={form.subject}
                onChange={(e) => setForm((f) => ({ ...f, subject: e.target.value }))}
                className="mt-2 block w-full rounded-none border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                placeholder="e.g., Auction timer frozen at 3 seconds"
              />
            </div>

            {/* Message */}
            <div>
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                  Message
                </label>
                <span className="text-[10px] font-mono text-slate-400">{charCount}/2000</span>
              </div>
              <textarea
                required
                rows={6}
                maxLength={2000}
                value={form.message}
                onChange={(e) => {
                  setForm((f) => ({ ...f, message: e.target.value }));
                  setCharCount(e.target.value.length);
                }}
                className="mt-2 block w-full resize-none rounded-none border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                placeholder="Describe the issue in detail. Include tournament ID, auction ID, and timestamps if applicable."
              />
            </div>

            {/* File Attachment (Visual) */}
            <div className="rounded-none border border-dashed border-slate-300 bg-slate-50 p-6 text-center">
              <Paperclip className="mx-auto h-5 w-5 text-slate-400" />
              <p className="mt-2 text-xs font-medium text-slate-600">Attach screenshots or logs</p>
              <p className="mt-1 text-[10px] text-slate-400">PNG, JPG, PDF up to 10MB</p>
            </div>

            {/* Submit */}
            <button
              type="submit"
              className="flex w-full items-center justify-center gap-2 rounded-none bg-slate-900 py-4 text-sm font-bold text-white shadow-lg transition-all hover:bg-slate-800 hover:shadow-xl"
            >
              <Send className="h-4 w-4" />
              Submit Ticket
            </button>
          </form>
        </div>

        {/* Sidebar Info */}
        <div className="space-y-6 lg:col-span-2">
          {/* Response Times */}
          <div className="rounded-none bg-slate-950 p-6 ring-1 ring-white/5">
            <h3 className="text-sm font-semibold text-white">Response Times</h3>
            <div className="mt-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-xs text-slate-400">
                  <span className="h-2 w-2 rounded-full bg-rose-500" />
                  Critical (Live Auction)
                </span>
                <span className="text-xs font-bold text-white">≤ 2 hours</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-xs text-slate-400">
                  <span className="h-2 w-2 rounded-full bg-amber-500" />
                  High Priority
                </span>
                <span className="text-xs font-bold text-white">≤ 6 hours</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-xs text-slate-400">
                  <span className="h-2 w-2 rounded-full bg-sky-500" />
                  Medium Priority
                </span>
                <span className="text-xs font-bold text-white">≤ 24 hours</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-xs text-slate-400">
                  <span className="h-2 w-2 rounded-full bg-slate-600" />
                  Low Priority
                </span>
                <span className="text-xs font-bold text-white">≤ 72 hours</span>
              </div>
            </div>
          </div>

          {/* Common Fixes */}
          <div className="rounded-none bg-white p-6 ring-1 ring-slate-200">
            <h3 className="text-sm font-semibold text-slate-900">Before You Contact</h3>
            <div className="mt-4 space-y-4">
              {COMMON_FIXES.map((fix) => (
                <div key={fix.title} className="flex gap-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center bg-slate-100">
                    <fix.icon className="h-4 w-4 text-slate-600" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-900">{fix.title}</p>
                    <p className="mt-0.5 text-[11px] text-slate-500">{fix.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Direct Contact */}
          <div className="rounded-none bg-indigo-600 p-6">
            <h3 className="text-sm font-bold text-white">Direct Escalation</h3>
            <p className="mt-2 text-xs leading-relaxed text-indigo-100">
              For security breaches or platform-wide outages, bypass the ticket queue.
            </p>
            <div className="mt-4 space-y-2">
              <div className="flex items-center gap-2 text-xs text-indigo-100">
                <Mail className="h-3.5 w-3.5" />
                <span className="font-mono">pvsram346@gmail.com</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-indigo-100">
                <Phone className="h-3.5 w-3.5" />
                <span className="font-mono">+91 7075002630</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-indigo-100">
                <MapPin className="h-3.5 w-3.5" />
                <span>Visakhapatnam, IN (IST +5:30)</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}