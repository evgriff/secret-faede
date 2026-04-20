import { Component, type ErrorInfo, type ReactNode } from 'react';

import { routePaths } from '../lib/routes';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

export class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  override state: ErrorBoundaryState = {
    hasError: false,
  };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  override componentDidCatch(error: unknown, errorInfo: ErrorInfo): void {
    console.error('Unhandled app error', error, errorInfo);
  }

  override render() {
    if (this.state.hasError) {
      return (
        <section className="pageShell pageCard stack" role="alert">
          <h1 className="pageTitle">Something went wrong.</h1>
          <p className="pageLead">Reload the app and try again.</p>
          <a className="inkLink" href={routePaths.root}>
            Return to sign-in
          </a>
        </section>
      );
    }

    return this.props.children;
  }
}
