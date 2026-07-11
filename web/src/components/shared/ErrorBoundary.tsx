import { Component, type ErrorInfo, type ReactNode } from 'react';

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
    console.error('Uncaught render error:', error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-z-bg flex items-center justify-center p-6">
          <div className="text-center max-w-sm">
            <p className="text-5xl mb-4">😵</p>
            <h1 className="text-xl font-bold mb-2">Something went wrong</h1>
            <p className="text-z-gray-400 text-sm mb-6">
              An unexpected error occurred. Reloading usually fixes it.
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
