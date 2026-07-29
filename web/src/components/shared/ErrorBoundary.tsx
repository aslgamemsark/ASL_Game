import { Component, type ErrorInfo, type ReactNode } from 'react';
import { reportError } from '@/lib/errorReporting';
import { Zippy } from './Zippy';
import { ZIPPY_LINES } from '@/data/zippy';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

// Catches uncaught render errors anywhere below it in the tree. Without this, a single thrown
// error (e.g. a bad avatar/animation frame, a null landmark result) white-screens the entire app
// with no recovery path — this shows a friendly fallback with a reload button instead.
export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    reportError(error, { source: 'error-boundary', componentStack: info.componentStack ?? undefined });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-dvh bg-z-bg flex items-center justify-center overflow-y-auto p-6">
          <div className="text-center max-w-sm">
            <div className="mb-4 flex justify-center">
              <Zippy expression="oops" size="lg" alt="Zippy looking puzzled" priority />
            </div>
            <h1 className="text-xl font-bold mb-2">Oops!</h1>
            <p className="text-z-gray-400 text-sm mb-6">
              {ZIPPY_LINES.error[0]}
            </p>
            <button
              onClick={() => window.location.reload()}
              className="w-full py-3 rounded-2xl font-bold text-white text-base bg-gradient-primary"
            >
              Reload
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
