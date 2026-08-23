import { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertTriangle, RotateCcw } from "lucide-react";

interface Props {
  children: ReactNode;
  onRetry?: () => void;
  fallback?: ReactNode;
}

interface State {
  error: Error | null;
}

/**
 * WebGL can fail independently of the rest of the auction (GPU reset,
 * context limit, browser policy). Never let that take bidding or live data
 * down with it: this boundary contains only the renderer.
 */
export class Auction3DErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Replace with your production telemetry client if one is available.
    console.error("GullyBid 3D renderer failed", error, info.componentStack);
  }

  private retry = () => {
    this.setState({ error: null });
    this.props.onRetry?.();
  };

  render() {
    if (!this.state.error) return this.props.children;
    if (this.props.fallback) return this.props.fallback;

    return (
      <div className="absolute inset-0 flex items-center justify-center bg-[#03050b] p-6 text-center">
        <div className="max-w-md rounded-3xl border border-amber-300/15 bg-slate-950/80 p-7 shadow-2xl backdrop-blur-xl">
          <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-300/10 text-amber-300 ring-1 ring-amber-300/20">
            <AlertTriangle className="h-6 w-6" />
          </span>
          <h2 className="mt-4 text-lg font-black text-white">3D renderer needs a reset</h2>
          <p className="mt-2 text-sm leading-6 text-slate-400">
            Live auction data is still connected. Retry the visual stage, or switch back to the
            standard room from the header.
          </p>
          <button
            type="button"
            onClick={this.retry}
            className="mt-5 inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-black text-slate-950 transition hover:bg-cyan-100"
          >
            <RotateCcw className="h-4 w-4" /> Retry 3D
          </button>
        </div>
      </div>
    );
  }
}
