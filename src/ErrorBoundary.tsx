import React from 'react';

// Simple error boundary to surface render errors instead of a white screen

type Props = { children: React.ReactNode };
type State = { hasError: boolean; error?: any };

export default class ErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(error: any) {
    return { hasError: true, error };
  }

  componentDidCatch(error: any, info: any) {
    // Log to console; could also POST to server here if desired
    console.error('Render error:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <pre style={{ padding: 16, color: '#fff', background: '#c00', whiteSpace: 'pre-wrap' }}>
          {String(this.state.error ?? 'Unknown error')}
        </pre>
      );
    }
    return this.props.children;
  }
}