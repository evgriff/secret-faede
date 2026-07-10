import { Component, Fragment, type ErrorInfo, type ReactNode } from 'react';

import { RouteErrorPage } from './RecoveryPages';

export interface GlobalErrorBoundaryProps {
  children: ReactNode;
  onError?(error: unknown, errorInfo: ErrorInfo): void;
  onReload?(): void;
  resetKeys?: readonly unknown[];
  returnHref?: string;
}

interface GlobalErrorBoundaryState {
  hasError: boolean;
  error: unknown;
  resetCount: number;
}

export class GlobalErrorBoundary extends Component<
  GlobalErrorBoundaryProps,
  GlobalErrorBoundaryState
> {
  override state: GlobalErrorBoundaryState = {
    hasError: false,
    error: null,
    resetCount: 0,
  };

  static getDerivedStateFromError(
    error: unknown,
  ): Partial<GlobalErrorBoundaryState> {
    return { error, hasError: true };
  }

  override componentDidCatch(error: unknown, errorInfo: ErrorInfo) {
    this.props.onError?.(error, errorInfo);
  }

  override componentDidUpdate(previousProps: GlobalErrorBoundaryProps) {
    if (
      this.state.hasError &&
      resetKeysChanged(previousProps.resetKeys, this.props.resetKeys)
    ) {
      this.reset();
    }
  }

  override render() {
    if (this.state.hasError) {
      const recoveryProps = {
        error: this.state.error,
        onRetry: () => this.reset(),
        ...(this.props.onReload ? { onReload: this.props.onReload } : {}),
        ...(this.props.returnHref ? { returnHref: this.props.returnHref } : {}),
      };
      return <RouteErrorPage {...recoveryProps} />;
    }

    return (
      <Fragment key={this.state.resetCount}>{this.props.children}</Fragment>
    );
  }

  private readonly reset = () => {
    this.setState((state) => ({
      error: null,
      hasError: false,
      resetCount: state.resetCount + 1,
    }));
  };
}

function resetKeysChanged(
  previous: readonly unknown[] | undefined,
  current: readonly unknown[] | undefined,
) {
  if (previous === current) {
    return false;
  }
  if (!previous || !current || previous.length !== current.length) {
    return true;
  }
  return previous.some((value, index) => !Object.is(value, current[index]));
}
