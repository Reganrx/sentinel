import { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertTriangle, Home, RotateCcw } from "lucide-react";

type Props = { children: ReactNode; onReset: () => void };
type State = { error: Error | null };

export default class PageErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Sentinel page failed safely", error, info.componentStack);
  }

  private reset = () => {
    this.setState({ error: null });
    this.props.onReset();
  };

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <section className="page-error-boundary" role="alert">
        <AlertTriangle size={36} />
        <p>SENTINEL RECOVERY</p>
        <h1>This page stopped unexpectedly</h1>
        <span>The rest of Sentinel is still running. Return Home, then reopen the page.</span>
        <button onClick={this.reset}><Home size={17} />Return Home</button>
        <button onClick={() => window.location.reload()}><RotateCcw size={17} />Restart interface</button>
      </section>
    );
  }
}
