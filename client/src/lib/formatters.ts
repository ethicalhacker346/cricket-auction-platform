import { format, formatDistanceToNow } from 'date-fns';

export function formatCount(value: number | undefined | null) {
  return new Intl.NumberFormat('en-IN').format(value ?? 0);
}

export function formatCompact(value: number | undefined | null) {
  const amount = value ?? 0;
  if (amount >= 1_000_000) return `${(amount / 1_000_000).toFixed(amount >= 10_000_000 ? 0 : 1)}M`;
  if (amount >= 1_000) return `${(amount / 1_000).toFixed(amount >= 100_000 ? 0 : 1)}K`;
  return formatCount(amount);
}

export function formatRupees(value: number | undefined | null) {
  const amount = value ?? 0;
  if (amount >= 10_000_000) return `₹${(amount / 10_000_000).toFixed(2)} Cr`;
  if (amount >= 100_000) return `₹${(amount / 100_000).toFixed(1)}L`;
  return `₹${formatCount(amount)}`;
}

export function formatActivityTime(timestamp: string | Date | null | undefined) {
  if (!timestamp) return 'Unknown time';
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return 'Unknown time';
  return formatDistanceToNow(date, { addSuffix: true });
}

export function formatExactDate(timestamp: string | Date | null | undefined) {
  if (!timestamp) return '';
  const date = new Date(timestamp);
  return Number.isNaN(date.getTime()) ? '' : format(date, 'd MMM, h:mm a');
}

export function toTitleCase(value: string | null | undefined) {
  if (!value) return '';

  return value
    .trim()
    .toLowerCase()
    .split('_')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}