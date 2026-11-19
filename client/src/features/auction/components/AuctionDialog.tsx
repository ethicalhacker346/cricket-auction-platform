import { useId, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

/** Keyboard-contained, with one stable portal across native fullscreen changes. */
export function AuctionDialog({ title, children, onClose, busy = false }: {
  title: string; children: ReactNode; onClose: () => void; busy?: boolean;
}) {
  const titleId = useId();
  const dialog = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  const busyRef = useRef(busy);
  const [portal] = useState(() => typeof document === 'undefined' ? null : document.createElement('div'));
  closeRef.current = onClose;
  busyRef.current = busy;

  useLayoutEffect(() => {
    if (!portal) return;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const overflow = document.body.style.overflow;
    const movePortal = () => (document.fullscreenElement ?? document.body).appendChild(portal);
    movePortal();
    document.addEventListener('fullscreenchange', movePortal);
    document.body.style.overflow = 'hidden';
    dialog.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !busyRef.current) {
        event.preventDefault(); event.stopPropagation(); closeRef.current();
      }
      if (event.key !== 'Tab') return;
      const focusable = Array.from(dialog.current?.querySelectorAll<HTMLElement>(
        'button:not(:disabled), a[href], input:not(:disabled), textarea:not(:disabled), select:not(:disabled), [tabindex="0"]',
      ) ?? []).filter((element) => !element.hidden);
      const first = focusable[0]; const last = focusable[focusable.length - 1];
      if (!first) { event.preventDefault(); dialog.current?.focus(); return; }
      const active = document.activeElement;
      if (!focusable.includes(active as HTMLElement) || (event.shiftKey ? active === first : active === last)) {
        event.preventDefault(); (event.shiftKey ? last : first).focus();
      }
    };
    const containFocus = (event: FocusEvent) => {
      if (event.target instanceof Node && !dialog.current?.contains(event.target)) dialog.current?.focus();
    };
    document.addEventListener('keydown', onKey, true);
    document.addEventListener('focusin', containFocus);
    return () => {
      document.removeEventListener('keydown', onKey, true);
      document.removeEventListener('focusin', containFocus);
      document.removeEventListener('fullscreenchange', movePortal);
      document.body.style.overflow = overflow;
      portal.remove();
      // The trigger can still be disabled until its parent's busy=false DOM
      // update commits. Restore focus after that commit, not during teardown.
      queueMicrotask(() => { if (previous?.isConnected) previous.focus(); });
    };
  }, [portal]);

  if (!portal) return null;
  return createPortal(
    <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/75 p-3 backdrop-blur-sm sm:p-6"
      onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) onClose(); }}>
      <div ref={dialog} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby={titleId} aria-busy={busy}
        className="max-h-[90dvh] w-full max-w-xl overflow-y-auto rounded-2xl border border-white/15 bg-slate-950 p-5 text-slate-100 shadow-2xl outline-none sm:p-6">
        <div className="mb-5 flex items-start justify-between gap-4">
          <h2 id={titleId} className="text-lg font-bold">{title}</h2>
          <button type="button" aria-label="Close dialog" disabled={busy} onClick={onClose}
            className="rounded-lg p-2 text-slate-400 hover:bg-white/10 hover:text-white focus-visible:ring-2 focus-visible:ring-amber-300 disabled:opacity-40">
            <X aria-hidden="true" className="h-4 w-4" />
          </button>
        </div>
        {children}
      </div>
    </div>, portal,
  );
}
