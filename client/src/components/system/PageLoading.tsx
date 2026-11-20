import { useEffect, useState } from "react";
import { Logo } from "@/components/auth/Logo";
import { reloadApp } from "@/lib/utils/reloadApp";

export function PageLoading() {
  const [slow, setSlow] = useState(false);
  const [offline, setOffline] = useState(
    () => typeof navigator !== "undefined" && !navigator.onLine,
  );
  useEffect(() => {
    const timer = window.setTimeout(() => setSlow(true), 8000);
    const sync = () => setOffline(!navigator.onLine);
    window.addEventListener("online", sync);
    window.addEventListener("offline", sync);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("online", sync);
      window.removeEventListener("offline", sync);
    };
  }, []);
  return (
    <div className="gb-page-state">
      <Logo />
      <div role="status" aria-live="polite">
        <p className="gb-page-state__eyebrow">
          {offline ? "YOU’RE OFFLINE" : "GETTING THINGS READY"}
        </p>
        <p>
          {offline
            ? "Reconnect to load this page. You can then reload if needed."
            : slow
              ? "This is taking a little longer. Please check your connection."
              : "Loading your next view…"}
        </p>
      </div>
      {!offline && <div className="gb-loading-line" aria-hidden="true" />}
      {(offline || slow) && (
        <button
          className="gb-button gb-button--ink"
          type="button"
          onClick={() => void reloadApp()}
        >
          Reload page
        </button>
      )}
    </div>
  );
}
