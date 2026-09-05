"use client";

import { Component, type ReactNode } from "react";

// Member Data View (2026-09-05, added after a real live crash traced to a JSON
// serialisation bug -- see data-view-serialize.ts's own comment): a render-phase
// error anywhere in Map/Dashboard/Rankings would otherwise take down the ENTIRE app
// (React 18+'s default behaviour with no error boundary present is to unmount the
// whole tree on an uncaught error during render), not just the one broken view.
// MapView.tsx's own drawing effect already got a narrower, per-marker try/catch for
// the specific imperative-DOM-loop failure mode that bug actually hit; this is the
// broader backstop for an ordinary React render-phase throw in any of the three
// views, which a plain try/catch inside a component body can't catch at all (errors
// thrown during render must be caught by a class-component boundary -- there is no
// hook equivalent in React today).
type Props = { children: ReactNode };
type State = { error: Error | null };

export default class DataViewErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: { componentStack?: string | null }) {
    console.error("[DataViewErrorBoundary] caught a render error:", error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="py-12 text-center text-sm text-neutral-500">
          <p>Something went wrong showing this view.</p>
          <p className="mt-3">
            <button type="button" className="underline" onClick={() => this.setState({ error: null })}>
              Try again
            </button>{" "}
            or{" "}
            <button type="button" className="underline" onClick={() => window.location.reload()}>
              reload the page
            </button>
            .
          </p>
        </div>
      );
    }
    return this.props.children;
  }
}
