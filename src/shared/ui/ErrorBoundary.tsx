import { Component, type ErrorInfo, type ReactNode } from 'react';

import {
  Banner,
  Button,
  Panel,
} from '../../features/shared/design/DesignPrimitives';
import { routePaths } from '../lib/routes';

interface ErrorBoundaryProps {
  children: ReactNode;
  onError?(error: unknown, errorInfo: ErrorInfo): void;
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
    this.props.onError?.(error, errorInfo);
  }

  override render() {
    if (this.state.hasError) {
      return (
        <div className="pageShell" role="alert">
          <Panel>
            <div className="stack">
              <Banner tone="warning">The app hit an unexpected error.</Banner>
              <h1 className="pageTitle">Something went wrong.</h1>
              <p className="pageLead">
                Reload the app and try again. Unsaved offline changes remain in
                local browser storage when they were already queued.
              </p>
              <div className="inlineCluster">
                <Button onClick={() => this.setState({ hasError: false })}>
                  Try again
                </Button>
                <Button onClick={() => window.location.reload()} tone="primary">
                  Reload app
                </Button>
              </div>
              <div className="inlineCluster">
                <a className="inkLink" href={routePaths.today}>
                  Open Today
                </a>
                <a className="inkLink" href={routePaths.plan}>
                  Open Plan
                </a>
                <a className="inkLink" href={routePaths.root}>
                  Return to sign-in
                </a>
              </div>
            </div>
          </Panel>
        </div>
      );
    }

    return this.props.children;
  }
}
