import React from "react";

type State = { hasError: boolean; error?: any };
export default class ErrorBoundary extends React.Component<React.PropsWithChildren, State> {
  state: State = { hasError: false };
  static getDerivedStateFromError(error: any) { return { hasError: true, error }; }
  componentDidCatch(error: any, info: any) { console.error("UI ErrorBoundary:", error, info); }
  render() {
    if (this.state.hasError) {
      return (
        <div className="p-6">
          <h1 className="text-xl font-semibold mb-2">Что-то пошло не так</h1>
          <pre className="text-red-600 text-sm whitespace-pre-wrap">{String(this.state.error)}</pre>
        </div>
      );
    }
    return this.props.children;
  }
}
