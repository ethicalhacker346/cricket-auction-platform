import { CheckCircle2, X } from 'lucide-react';

export function NotificationToast({ message, onDismiss }: { message: string; onDismiss: () => void }) {
  return <div className="toast-notice"><span className="toast-check"><CheckCircle2 size={15} /></span><span>{message}</span><button type="button" onClick={onDismiss} aria-label="Dismiss notification"><X size={14} /></button></div>;
}
