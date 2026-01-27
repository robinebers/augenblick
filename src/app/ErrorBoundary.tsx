import { Component, type ReactNode } from "react";

type Props = {
  children: ReactNode;
};

type State = {
  error: Error | null;
};

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error) {
    console.error("App error:", error);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="h-screen w-screen bg-[var(--bg-secondary)] text-[var(--text-primary)]">
          <div className="mx-auto max-w-[720px] px-10 py-12">
            <h1 className="text-[18px] font-semibold">App error</h1>
            <pre className="mt-3 whitespace-pre-wrap rounded-md border bg-[var(--bg-elevated)] p-3 text-[12px]">
              {this.state.error.stack || this.state.error.message}
            </pre>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
