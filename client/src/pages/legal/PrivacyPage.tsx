import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import {
  Shield,
  Lock,
  Eye,
  Server,
  Trash2,
  Download,
  Mail,
  Clock,
  Radio,
  FileText,
  ChevronRight,
  ArrowUpRight,
  AlertTriangle,
  CheckCircle2,
  HardDrive,
  Cookie,
  Globe,
  UserX,
} from "lucide-react";

const SECTIONS = [
  { id: "controller", label: "Data Controller", icon: Shield },
  { id: "collect", label: "What We Collect", icon: HardDrive },
  { id: "usage", label: "How We Use It", icon: Eye },
  { id: "basis", label: "Legal Basis", icon: FileText },
  { id: "sharing", label: "Data Sharing", icon: Globe },
  { id: "retention", label: "Retention", icon: Clock },
  { id: "rights", label: "Your Rights", icon: Download },
  { id: "security", label: "Security", icon: Lock },
  { id: "cookies", label: "Cookies", icon: Cookie },
  { id: "contact", label: "Contact", icon: Mail },
];

const DATA_CATEGORIES = [
  {
    title: "Identity & Authentication",
    items: [
      "Full name, email address, phone number",
      "Bcrypt-hashed password (never stored plain-text)",
      "Refresh token hashes for session persistence",
      "Role designation (Player, Franchise Owner, Organizer, Admin)",
      "Account status, failed login attempts, lockout timestamps",
    ],
    storage: "MongoDB User collection, JWT claims",
    access: "You, Platform admins",
  },
  {
    title: "Player Profiles",
    items: [
      "Full name, date of birth, nationality",
      "Cricket role (Batsman, Bowler, All-Rounder, Wicket-Keeper)",
      "Batting style, bowling style, biography",
      "Profile image URL and Cloudinary public ID",
    ],
    storage: "MongoDB Player collection",
    access: "You, Tournament organizers (for approval), Public (view-only)",
  },
  {
    title: "Franchise Data",
    items: [
      "Franchise name, slug, description",
      "City, state, country, brand colors",
      "Logo URL and Cloudinary public ID",
      "Ownership linkage to your User ID",
    ],
    storage: "MongoDB Franchise collection",
    access: "You, Tournament organizers (during team registration)",
  },
  {
    title: "Tournament & Auction Activity",
    items: [
      "Tournament creation metadata, registration settings, purse configuration",
      "Team registration status (PENDING, APPROVED, REJECTED) and rejection reasons",
      "Player base prices, lot outcomes, sold prices, sold-to-team references",
      "Wallet state: initial budget, spent, reserved, remaining balances",
      "Roster composition (acquired players, bought prices, roles, timestamps)",
    ],
    storage: "MongoDB Tournament, TournamentTeam, TournamentPlayer collections",
    access: "Tournament organizer, Your franchise (own data only), Platform admins",
  },
  {
    title: "Bid & Auction Logs",
    items: [
      "Bid amounts, timestamps, round associations, status (WINNING, OUTBID)",
      "Auction log entries (actions, user ID, messages, metadata patches)",
      "Live auction viewer presence (viewer ID, heartbeat timestamps, user association)",
      "Live state snapshots (highest bid, bidder team, remaining timer, version)",
    ],
    storage: "MongoDB Bid, Auction, AuctionViewer collections",
    access: "Tournament organizer, Participating franchise owners, Platform admins",
  },
  {
    title: "Technical & Telemetry",
    items: [
      "IP address, browser user-agent, session timestamps",
      "Socket.IO connection metadata for live auction rooms",
      "Email delivery status (password resets, notifications)",
      "Error logs and stack traces (anonymized where possible)",
    ],
    storage: "Server logs, SMTP transaction logs, Socket.IO room state",
    access: "Platform admins, Infrastructure operators",
  },
];

export default function PrivacyPage() {
  const [activeSection, setActiveSection] = useState("controller");

  useEffect(() => {
    const handleScroll = () => {
      const offsets = SECTIONS.map((s) => {
        const el = document.getElementById(s.id);
        return el ? { id: s.id, offset: el.offsetTop } : null;
      }).filter(Boolean) as { id: string; offset: number }[];

      const scrollPos = window.scrollY + 200;
      for (let i = offsets.length - 1; i >= 0; i--) {
        if (scrollPos >= offsets[i].offset) {
          setActiveSection(offsets[i].id);
          break;
        }
      }
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const scrollTo = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
      window.scrollTo({ top: el.offsetTop - 120, behavior: "smooth" });
    }
  };

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

      <div className="mx-auto max-w-7xl px-6 py-16 lg:flex lg:gap-16">
        {/* Sticky TOC */}
        <aside className="hidden shrink-0 lg:block lg:w-64">
          <nav className="sticky top-28">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              Last updated: 12 Aug 2026
            </p>
            <ul className="mt-6 space-y-1">
              {SECTIONS.map((section) => {
                const active = activeSection === section.id;
                return (
                  <li key={section.id}>
                    <button
                      onClick={() => scrollTo(section.id)}
                      className={`flex w-full items-center gap-2.5 rounded-sm px-3 py-2 text-left text-[13px] font-medium transition-all ${
                        active
                          ? "bg-slate-900 text-white shadow-md"
                          : "text-slate-600 hover:bg-slate-200/50 hover:text-slate-900"
                      }`}
                    >
                      <section.icon className="h-3.5 w-3.5" />
                      {section.label}
                    </button>
                  </li>
                );
              })}
            </ul>

            <div className="mt-8 rounded-sm bg-amber-50 p-4 ring-1 ring-amber-200">
              <AlertTriangle className="h-4 w-4 text-amber-600" />
              <p className="mt-2 text-[11px] font-semibold text-amber-800">
                This is a platform-specific privacy statement.
              </p>
              <p className="mt-1 text-[10px] leading-relaxed text-amber-700">
                It reflects the actual data structures and flows in the GullyBid system as of August 2026.
              </p>
            </div>
          </nav>
        </aside>

        {/* Content */}
        <main className="min-w-0 flex-1 space-y-20">
          {/* Hero */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <div className="flex items-center gap-2 text-indigo-600">
              <Shield className="h-5 w-5" />
              <span className="text-xs font-bold uppercase tracking-widest">Data Architecture</span>
            </div>
            <h1 className="mt-3 text-4xl font-extrabold tracking-tight text-slate-900 lg:text-5xl">
              Privacy Policy
            </h1>
            <p className="mt-4 max-w-2xl text-lg leading-relaxed text-slate-500">
              GullyBid processes cricket auction data across multiple MongoDB collections,
              Cloudinary asset stores, and real-time Socket.IO streams. This document maps
              exactly what we hold, why we hold it, and who can access it.
            </p>
          </motion.div>

          {/* Controller */}
          <section id="controller" className="scroll-mt-28">
            <h2 className="flex items-center gap-3 text-2xl font-bold text-slate-900">
              <span className="flex h-8 w-8 items-center justify-center bg-slate-900 text-sm font-bold text-white">
                01
              </span>
              Data Controller
            </h2>
            <div className="mt-6 rounded-none bg-white p-8 ring-1 ring-slate-200">
              <p className="text-sm leading-relaxed text-slate-600">
                <strong className="text-slate-900"> VS Technologies Pvt. Ltd.</strong> is the data controller for all personal information processed through the GullyBid cricket auction platform.
              </p>
              <div className="mt-6 grid gap-4 sm:grid-cols-2">
                <div className="rounded-sm bg-slate-50 p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Registered Address</p>
                  <p className="mt-1 text-sm text-slate-700">Visakhapatnam, Andhra Pradesh, India</p>
                </div>
                <div className="rounded-sm bg-slate-50 p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Data Protection Officer</p>
                  <p className="mt-1 text-sm text-slate-700">privacy@gullybid.in</p>
                </div>
              </div>
            </div>
          </section>

          {/* What We Collect */}
          <section id="collect" className="scroll-mt-28">
            <h2 className="flex items-center gap-3 text-2xl font-bold text-slate-900">
              <span className="flex h-8 w-8 items-center justify-center bg-slate-900 text-sm font-bold text-white">
                02
              </span>
              What We Collect
            </h2>
            <p className="mt-4 text-sm text-slate-500">
              We collect only data necessary to operate cricket auctions. No advertising trackers. No third-party analytics cookies.
            </p>

            <div className="mt-8 space-y-6">
              {DATA_CATEGORIES.map((cat, i) => (
                <motion.div
                  key={cat.title}
                  initial={{ opacity: 0, y: 16 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.05 }}
                  className="rounded-none bg-white ring-1 ring-slate-200"
                >
                  <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
                    <h3 className="text-sm font-bold text-slate-900">{cat.title}</h3>
                    <span className="rounded-sm bg-slate-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                      {cat.storage}
                    </span>
                  </div>
                  <div className="p-6">
                    <ul className="space-y-2">
                      {cat.items.map((item) => (
                        <li key={item} className="flex items-start gap-2 text-sm text-slate-600">
                          <ChevronRight className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" />
                          {item}
                        </li>
                      ))}
                    </ul>
                    <div className="mt-4 flex items-center gap-2 border-t border-slate-100 pt-4">
                      <Eye className="h-3.5 w-3.5 text-slate-400" />
                      <span className="text-[11px] font-semibold text-slate-500">
                        Access: {cat.access}
                      </span>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </section>

          {/* Usage */}
          <section id="usage" className="scroll-mt-28">
            <h2 className="flex items-center gap-3 text-2xl font-bold text-slate-900">
              <span className="flex h-8 w-8 items-center justify-center bg-slate-900 text-sm font-bold text-white">
                03
              </span>
              How We Use Your Data
            </h2>
            <div className="mt-6 grid gap-6 md:grid-cols-2">
              {[
                {
                  title: "Platform Operation",
                  desc: "To authenticate you, render your dashboard, enforce role-based access (Admin, Organizer, Franchise Owner, Player), and maintain tournament state machines.",
                },
                {
                  title: "Auction Execution",
                  desc: "To process bids in real-time, manage wallet reservations, extend lot timers, trigger unsold round generation, and emit Socket.IO events to auction rooms.",
                },
                {
                  title: "Security & Fraud Prevention",
                  desc: "To track failed login attempts, enforce account lockouts, store bcrypt password hashes, invalidate refresh tokens on logout, and audit auction actions.",
                },
                {
                  title: "Communications",
                  desc: "To send password reset emails, registration notifications, bid status updates, and auction lifecycle alerts via our SMTP infrastructure.",
                },
                {
                  title: "Asset Management",
                  desc: "To store and serve franchise logos, tournament logos, and player profile images via Cloudinary. Public IDs are retained for cleanup on deletion.",
                },
                {
                  title: "Compliance",
                  desc: "To maintain audit logs of organizer actions (lot openings, settlements, rule updates) for dispute resolution and platform integrity.",
                },
              ].map((use) => (
                <div key={use.title} className="rounded-none bg-white p-6 ring-1 ring-slate-200">
                  <h3 className="text-sm font-bold text-slate-900">{use.title}</h3>
                  <p className="mt-2 text-xs leading-relaxed text-slate-500">{use.desc}</p>
                </div>
              ))}
            </div>
          </section>

          {/* Legal Basis */}
          <section id="basis" className="scroll-mt-28">
            <h2 className="flex items-center gap-3 text-2xl font-bold text-slate-900">
              <span className="flex h-8 w-8 items-center justify-center bg-slate-900 text-sm font-bold text-white">
                04
              </span>
              Legal Basis for Processing
            </h2>
            <div className="mt-6 space-y-4">
              {[
                {
                  basis: "Contractual Necessity",
                  desc: "Account data, wallet states, and bid records are required to fulfill our Terms of Service. Without this data, auctions cannot function.",
                  examples: "User authentication, bid placement, roster management",
                },
                {
                  basis: "Legitimate Interest",
                  desc: "Security logs, failed login tracking, and auction audit trails protect the platform and all users from fraud and abuse.",
                  examples: "Account lockouts, action logs, viewer heartbeats",
                },
                {
                  basis: "Consent",
                  desc: "Optional profile fields (bio, profile image, brand colors) and marketing communications. You may withdraw consent at any time.",
                  examples: "Profile images, feature announcements",
                },
                {
                  basis: "Legal Obligation",
                  desc: "We retain auction logs and transaction records as required by Indian commercial and tax law.",
                  examples: "Financial audit trails, organizer action history",
                },
              ].map((item) => (
                <div key={item.basis} className="flex gap-4 rounded-none bg-white p-6 ring-1 ring-slate-200">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center bg-slate-100">
                    <FileText className="h-4 w-4 text-slate-600" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">{item.basis}</h3>
                    <p className="mt-1 text-xs leading-relaxed text-slate-500">{item.desc}</p>
                    <p className="mt-2 text-[10px] font-mono text-slate-400">Covers: {item.examples}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Sharing */}
          <section id="sharing" className="scroll-mt-28">
            <h2 className="flex items-center gap-3 text-2xl font-bold text-slate-900">
              <span className="flex h-8 w-8 items-center justify-center bg-slate-900 text-sm font-bold text-white">
                05
              </span>
              Data Sharing & Visibility
            </h2>
            <div className="mt-6 rounded-none bg-slate-950 p-8 ring-1 ring-white/5">
              <p className="text-sm leading-relaxed text-slate-300">
                GullyBid operates on a <strong className="text-white">need-to-know boundary</strong>. Your data is never sold. It is shared only as required by the auction mechanics you participate in.
              </p>

              <div className="mt-6 space-y-4">
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
                  <div>
                    <p className="text-xs font-bold text-slate-200">Tournament Organizers</p>
                    <p className="mt-0.5 text-xs text-slate-400">
                      See team registrations, player registrations, and bid history for tournaments they own. Cannot see other organizers' data.
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
                  <div>
                    <p className="text-xs font-bold text-slate-200">Franchise Owners</p>
                    <p className="mt-0.5 text-xs text-slate-400">
                      See their own team's wallet, roster, and bids. See public player profiles and live auction state. Cannot see other teams' reserved amounts.
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
                  <div>
                    <p className="text-xs font-bold text-slate-200">Players</p>
                    <p className="mt-0.5 text-xs text-slate-400">
                      See their own registration status, base price, and lot outcome. Public profiles are visible to all registered users.
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
                  <div>
                    <p className="text-xs font-bold text-slate-200">Infrastructure</p>
                    <p className="mt-0.5 text-xs text-slate-400">
                      Cloudinary stores images. MongoDB Atlas stores documents. SMTP provider delivers emails. All under strict DPA terms.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Retention */}
          <section id="retention" className="scroll-mt-28">
            <h2 className="flex items-center gap-3 text-2xl font-bold text-slate-900">
              <span className="flex h-8 w-8 items-center justify-center bg-slate-900 text-sm font-bold text-white">
                06
              </span>
              Data Retention
            </h2>
            <div className="mt-6 overflow-hidden rounded-none ring-1 ring-slate-200">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wider text-slate-500">
                  <tr>
                    <th className="px-6 py-3">Data Type</th>
                    <th className="px-6 py-3">Retention Period</th>
                    <th className="px-6 py-3">Rationale</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  <tr>
                    <td className="px-6 py-4 font-medium text-slate-900">Account & auth</td>
                    <td className="px-6 py-4 text-slate-600">Until account deletion + 90 days</td>
                    <td className="px-6 py-4 text-xs text-slate-500">Fraud investigation buffer</td>
                  </tr>
                  <tr>
                    <td className="px-6 py-4 font-medium text-slate-900">Auction logs</td>
                    <td className="px-6 py-4 text-slate-600">7 years</td>
                    <td className="px-6 py-4 text-xs text-slate-500">Commercial law compliance</td>
                  </tr>
                  <tr>
                    <td className="px-6 py-4 font-medium text-slate-900">Bid records</td>
                    <td className="px-6 py-4 text-slate-600">7 years</td>
                    <td className="px-6 py-4 text-xs text-slate-500">Dispute resolution</td>
                  </tr>
                  <tr>
                    <td className="px-6 py-4 font-medium text-slate-900">Viewer heartbeats</td>
                    <td className="px-6 py-4 text-slate-600">24 hours</td>
                    <td className="px-6 py-4 text-xs text-slate-500">Ephemeral presence data</td>
                  </tr>
                  <tr>
                    <td className="px-6 py-4 font-medium text-slate-900">Password reset tokens</td>
                    <td className="px-6 py-4 text-slate-600">15 minutes or until used</td>
                    <td className="px-6 py-4 text-xs text-slate-500">Security — minimal window</td>
                  </tr>
                  <tr>
                    <td className="px-6 py-4 font-medium text-slate-900">Deleted images</td>
                    <td className="px-6 py-4 text-slate-600">Immediate (Cloudinary destroy)</td>
                    <td className="px-6 py-4 text-xs text-slate-500">Asset cleanup on logo removal</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          {/* Rights */}
          <section id="rights" className="scroll-mt-28">
            <h2 className="flex items-center gap-3 text-2xl font-bold text-slate-900">
              <span className="flex h-8 w-8 items-center justify-center bg-slate-900 text-sm font-bold text-white">
                07
              </span>
              Your Rights
            </h2>
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              {[
                { icon: Eye, title: "Access", desc: "Request a complete export of your data across all collections." },
                { icon: FileText, title: "Rectification", desc: "Edit your profile, franchise details, or tournament settings at any time." },
                { icon: Trash2, title: "Erasure", desc: "Request account deletion. We purge your User record and anonymize auction references." },
                { icon: Download, title: "Portability", desc: "Export your tournament history, bid records, and roster data in JSON." },
                { icon: Lock, title: "Restriction", desc: "Temporarily freeze your account. All active bids and reservations are voided." },
                { icon: UserX, title: "Objection", desc: "Opt out of non-essential notifications and marketing emails." },
              ].map((right) => (
                <div key={right.title} className="flex gap-4 rounded-none bg-white p-6 ring-1 ring-slate-200">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center bg-slate-100">
                    <right.icon className="h-5 w-5 text-slate-600" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">{right.title}</h3>
                    <p className="mt-1 text-xs leading-relaxed text-slate-500">{right.desc}</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-4 rounded-sm bg-indigo-50 p-4 ring-1 ring-indigo-200">
              <p className="text-xs font-semibold text-indigo-900">How to exercise your rights</p>
              <p className="mt-1 text-xs leading-relaxed text-indigo-700">
                Email <span className="font-mono font-bold">privacy@gullybid.in</span> with your request type and registered email.
                We respond within 30 days as required by Indian data protection standards.
              </p>
            </div>
          </section>

          {/* Security */}
          <section id="security" className="scroll-mt-28">
            <h2 className="flex items-center gap-3 text-2xl font-bold text-slate-900">
              <span className="flex h-8 w-8 items-center justify-center bg-slate-900 text-sm font-bold text-white">
                08
              </span>
              Security Measures
            </h2>
            <div className="mt-6 space-y-4">
              {[
                {
                  title: "Password Hashing",
                  desc: "All passwords are hashed using bcrypt with a cost factor of 12. Plain-text passwords are never stored or logged.",
                },
                {
                  title: "JWT & Refresh Tokens",
                  desc: "Access tokens expire rapidly. Refresh tokens are hashed with bcrypt and invalidated on logout or password change.",
                },
                {
                  title: "Transaction Integrity",
                  desc: "Bid placement, lot settlement, and wallet updates run inside MongoDB multi-document transactions. Abort on error.",
                },
                {
                  title: "Role-Based Access Control",
                  desc: "PermissionEngine evaluates capabilities against ownership context. No role-only checks bypass resource ownership.",
                },
                {
                  title: "Image Security",
                  desc: "Cloudinary public IDs are extracted only from our own assets. Arbitrary URLs cannot inject unauthorized images.",
                },
              ].map((s) => (
                <div key={s.title} className="flex items-start gap-4 rounded-none bg-white p-6 ring-1 ring-slate-200">
                  <Lock className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">{s.title}</h3>
                    <p className="mt-1 text-xs leading-relaxed text-slate-500">{s.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Cookies */}
          <section id="cookies" className="scroll-mt-28">
            <h2 className="flex items-center gap-3 text-2xl font-bold text-slate-900">
              <span className="flex h-8 w-8 items-center justify-center bg-slate-900 text-sm font-bold text-white">
                09
              </span>
              Cookies & Tracking
            </h2>
            <div className="mt-6 rounded-none bg-white p-8 ring-1 ring-slate-200">
              <p className="text-sm leading-relaxed text-slate-600">
                GullyBid uses only <strong className="text-slate-900">essential cookies</strong> and local storage:
              </p>
              <ul className="mt-4 space-y-2">
                <li className="flex items-start gap-2 text-sm text-slate-600">
                  <ChevronRight className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" />
                  <span>
                    <code className="rounded-sm bg-slate-100 px-1 py-0.5 font-mono text-xs">sessionStorage.getItem("app-opening-seen")</code> — One-time splash screen gate
                  </span>
                </li>
                <li className="flex items-start gap-2 text-sm text-slate-600">
                  <ChevronRight className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" />
                  <span>JWT access token in memory (never localStorage for security)</span>
                </li>
                <li className="flex items-start gap-2 text-sm text-slate-600">
                  <ChevronRight className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" />
                  <span>Auth store state via Zustand (in-memory only)</span>
                </li>
              </ul>
              <div className="mt-6 rounded-sm bg-slate-50 p-4">
                <p className="text-xs font-semibold text-slate-700">No advertising cookies</p>
                <p className="mt-1 text-xs text-slate-500">
                  We do not use Google Analytics, Meta Pixel, or any third-party tracking scripts. Your auction behavior is not profiled for ads.
                </p>
              </div>
            </div>
          </section>

          {/* Contact */}
          <section id="contact" className="scroll-mt-28">
            <h2 className="flex items-center gap-3 text-2xl font-bold text-slate-900">
              <span className="flex h-8 w-8 items-center justify-center bg-slate-900 text-sm font-bold text-white">
                10
              </span>
              Contact
            </h2>
            <div className="mt-6 rounded-none bg-slate-950 p-8 ring-1 ring-white/5">
              <div className="grid gap-6 sm:grid-cols-3">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Privacy Inquiries</p>
                  <p className="mt-2 text-sm font-mono text-slate-300">privacy@gullybid.in</p>
                </div>
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Data Requests</p>
                  <p className="mt-2 text-sm font-mono text-slate-300">dpo@gullybid.in</p>
                </div>
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Response Time</p>
                  <p className="mt-2 text-sm text-slate-300">30 days maximum</p>
                </div>
              </div>
            </div>
          </section>

          {/* Bottom CTA */}
          <div className="flex items-center justify-between border-t border-slate-200 pt-8">
            <p className="text-xs text-slate-400">
              This policy is effective as of 12 August 2026.
            </p>
            <Link
              to="/terms"
              className="flex items-center gap-2 text-sm font-semibold text-indigo-600 hover:text-indigo-700"
            >
              Read Terms of Service <ArrowUpRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </main>
      </div>
    </div>
  );
}