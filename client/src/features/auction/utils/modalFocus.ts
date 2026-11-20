/** Confirmation dialogs sit above cinematic verdicts; ties follow portal order. */
export function topAuctionModal(): HTMLElement | null {
  let top: HTMLElement | null = null;
  let priority = -Infinity;
  for (const element of document.querySelectorAll<HTMLElement>(
    '[data-auction-modal]:not([aria-hidden="true"]):not([inert])',
  )) {
    const next = Number(element.dataset.auctionModal);
    if (next >= priority) {
      top = element;
      priority = next;
    }
  }
  return top;
}

/** Only one trap may redirect focus or handle a modal shortcut at a time. */
export function isTopAuctionModal(element: HTMLElement | null): boolean {
  return element !== null && topAuctionModal() === element;
}

let scrollLocks = 0;
let previousOverflow = "";

/** Overlapping modals can close in either order without unlocking the page. */
export function lockAuctionScroll(): () => void {
  if (scrollLocks++ === 0) previousOverflow = document.body.style.overflow;
  document.body.style.overflow = "hidden";
  let released = false;
  return () => {
    if (released) return;
    released = true;
    if (--scrollLocks === 0) document.body.style.overflow = previousOverflow;
  };
}

export function restoreAuctionFocus(previous: HTMLElement | null) {
  const top = topAuctionModal();
  if (top) {
    if (!top.contains(document.activeElement))
      top.focus({ preventScroll: true });
  } else if (previous?.isConnected) {
    previous.focus({ preventScroll: true });
  }
}
