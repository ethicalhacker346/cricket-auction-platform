import { useEffect, type RefObject } from "react";

/**
 * Closes a menu/dropdown when the user clicks or taps outside `ref`,
 * or presses Escape. Pass `active=false` to skip attaching listeners
 * while the menu is already closed (avoids unnecessary work).
 */
export function useOnClickOutside<T extends HTMLElement>(
  ref: RefObject<T | null>,
  handler: () => void,
  active: boolean = true
) {
  useEffect(() => {
    if (!active) return;

    function handlePointerDown(event: MouseEvent | TouchEvent) {
      const el = ref.current;
      if (!el || el.contains(event.target as Node)) return;
      handler();
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") handler();
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("touchstart", handlePointerDown);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("touchstart", handlePointerDown);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [ref, handler, active]);
}