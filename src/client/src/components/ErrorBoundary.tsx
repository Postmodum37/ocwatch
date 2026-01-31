import React, { Component } from 'react';
import type { ReactNode } from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    console.error('ErrorBoundary caught an error:', error);
    console.error('Component stack:', errorInfo.componentStack);

    this.setState({
      errorInfo,
    });
  }

  handleReload = (): void => {
    window.location.reload();
  };

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div className="flex h-screen bg-background text-text-primary items-center justify-center p-6">
          <div className="flex flex-col items-center gap-6 max-w-2xl text-center">
            <div className="p-4 bg-error/10 rounded-full border border-error/20">
              <AlertCircle className="w-16 h-16 text-error" />
            </div>
            
            <div className="space-y-2">
              <h1 className="text-3xl font-semibold">Something went wrong</h1>
              <p className="text-text-secondary text-lg">
                OCWatch encountered an unexpected error and needs to reload.
              </p>
            </div>

            {this.state.error && (
              <div className="w-full bg-surface border border-border rounded-lg p-4 text-left">
                <p className="text-sm font-mono text-error mb-2">
                  {this.state.error.toString()}
                </p>
                {this.state.errorInfo && (
                  <details className="text-xs font-mono text-text-secondary">
                    <summary className="cursor-pointer hover:text-text-primary">
                      Show stack trace
                    </summary>
                    <pre className="mt-2 overflow-auto max-h-64 whitespace-pre-wrap">
                      {this.state.errorInfo.componentStack}
                    </pre>
                  </details>
                )}
              </div>
            )}

            <button
              onClick={this.handleReload}
              className="flex items-center gap-2 px-6 py-3 bg-accent text-white rounded-lg hover:bg-accent/90 transition-colors font-medium"
            >
              <RefreshCw className="w-5 h-5" />
              Reload Application
            </button>

            <p className="text-sm text-text-secondary">
              If this problem persists, check the browser console for more details.
            </p>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
