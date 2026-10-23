import { Component, type ReactNode } from "react";
import { ShieldAlert } from "./icons";

interface Props {
  children: ReactNode;
}
interface State {
  error: Error | null;
}

/** Catches render errors so a crash in one view doesn't blank the whole app. */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error) {
    // In production this would report to an error service.
    console.error("SolShield UI error:", error);
  }

  render() {
    if (this.state.error) {
      return (
        <div role="alert" className="grid min-h-screen place-items-center p-6">
          <div className="glass max-w-md p-8 text-center">
            <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-danger/15 text-danger ring-1 ring-danger/30">
              <ShieldAlert width={28} height={28} />
            </span>
            <h1 className="mt-4 text-lg font-bold text-white">Something went wrong</h1>
            <p className="mt-1.5 text-sm text-slate-400">
              The interface hit an unexpected error. Your wallet and funds are unaffected.
            </p>
            <button className="btn-primary mt-5" onClick={() => window.location.reload()}>
              Reload
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
