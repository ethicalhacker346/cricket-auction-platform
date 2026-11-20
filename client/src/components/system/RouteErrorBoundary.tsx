import { Component, type ReactNode } from "react";
import { ArrowLeft, RotateCcw } from "lucide-react";
import { Logo } from "@/components/auth/Logo";
import { reloadApp } from "@/lib/utils/reloadApp";

/**
 * Failed lazy imports (offline / an expired deployment chunk) must not blank
 * the app. Recovery is explicit: never auto-reload a running auction or retry
 * a command. A full reload also clears React.lazy's cached rejected promise.
 */
export class RouteErrorBoundary extends Component<
  { children: ReactNode; resetKey?: string },
  { failed: boolean; routeKey?: string }
> {
  state = { failed: false, routeKey: this.props.resetKey };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  static getDerivedStateFromProps(
    props: { resetKey?: string },
    state: { routeKey?: string },
  ) {
    return props.resetKey !== state.routeKey
      ? { failed: false, routeKey: props.resetKey }
      : null;
  }
  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <main className="gb-page-state" id="main-content">
        <Logo />
        <p className="gb-page-state__eyebrow">LET’S GET YOU BACK TO THE GAME</p>
        <h1>This page couldn’t load.</h1>
        <p>
          Your connection may have dropped, or the app may have been updated.
          Check your connection and reload to try again.
        </p>
        <div className="gb-page-state__actions">
          <button
            className="gb-button gb-button--ink"
            type="button"
            onClick={() => void reloadApp()}
          >
            <RotateCcw size={16} aria-hidden="true" />
            Reload page
          </button>
          <a className="gb-button gb-button--outline" href="/">
            <ArrowLeft size={16} aria-hidden="true" />
            Go home
          </a>
        </div>
      </main>
    );
  }
}
