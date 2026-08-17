import { MoreHorizontal, ArrowUpRight } from 'lucide-react';
import type { ComponentType } from 'react';
import type { LucideProps } from 'lucide-react';

type IconType = ComponentType<LucideProps>;

export function MetricCard({
  icon: Icon,
  label,
  value,
  support,
  trend,
  tone,
  detail,
  onOpen,
}: {
  icon: IconType;
  label: string;
  value: string;
  support: string;
  trend?: string;
  tone: 'lime' | 'blue' | 'violet' | 'amber';
  detail?: string;
  onOpen?: () => void;
}) {
  return (
    <article className={`metric-card metric-${tone} ${onOpen ? 'is-clickable' : ''}`} onClick={onOpen} onKeyDown={(event) => { if (onOpen && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); onOpen(); } }} role={onOpen ? 'button' : undefined} tabIndex={onOpen ? 0 : undefined}>
      <div className="metric-topline">
        <span className="metric-icon"><Icon size={18} strokeWidth={1.8} /></span>
        {trend && <span className="metric-trend"><ArrowUpRight size={13} />{trend}</span>}
        <button type="button" className="metric-more" aria-label={`${label} options`} onClick={(event) => { event.stopPropagation(); onOpen?.(); }}><MoreHorizontal size={16} /></button>
      </div>
      <div className="metric-label">{label}</div>
      <div className="metric-value">{value}</div>
      <div className="metric-support"><span>{support}</span>{detail && <b>{detail}</b>}</div>
      <div className="metric-glow" />
    </article>
  );
}
