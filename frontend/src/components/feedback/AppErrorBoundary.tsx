'use client';

import { Component, type ErrorInfo, type ReactNode } from 'react';
import { toast } from '@/lib/stores/toast.store';
import { ErrorFallback } from './ErrorFallback';

type AppErrorBoundaryProps = {
  children: ReactNode;
  resetKey?: string;
};

type AppErrorBoundaryState = {
  hasError: boolean;
};

export class AppErrorBoundary extends Component<
  AppErrorBoundaryProps,
  AppErrorBoundaryState
> {
  state: AppErrorBoundaryState = {
    hasError: false,
  };

  static getDerivedStateFromError(): AppErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Unhandled client error boundary', error, errorInfo);
    toast.error(
      'Unexpected workspace error',
      'The current screen crashed. Try again or reload the page if it continues.',
    );
  }

  componentDidUpdate(previousProps: AppErrorBoundaryProps) {
    if (
      this.state.hasError &&
      previousProps.resetKey !== this.props.resetKey
    ) {
      this.resetBoundary();
    }
  }

  resetBoundary = () => {
    this.setState({ hasError: false });
  };

  render() {
    if (this.state.hasError) {
      return (
        <ErrorFallback
          title="Something went wrong in the workspace"
          description="A rendering error interrupted this screen. Retry first, then reload the page if the problem keeps happening."
          onReset={this.resetBoundary}
        />
      );
    }

    return this.props.children;
  }
}
