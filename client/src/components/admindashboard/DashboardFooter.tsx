import { ShieldCheck } from 'lucide-react';

export function DashboardFooter() {
  return <footer className="dashboard-footer"><span><span className="footer-brand-dot" /> GullyBid Admin Console</span><span>Read-only overview · Powered by operational aggregates</span><span><ShieldCheck size={13} /> Secure admin session</span></footer>;
}