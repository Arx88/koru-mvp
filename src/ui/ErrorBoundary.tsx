import { Component, type ReactNode } from "react";

interface Props { children: ReactNode; fallback?: ReactNode; }
interface State { hasError: boolean; error?: Error; }

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: any) {
    console.error("[ErrorBoundary]", error.message, info?.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback ?? (
        <div style={{ padding: 24, textAlign: "center", color: "#6b5f8c" }}>
          <p style={{ fontWeight: 700, marginBottom: 8 }}>Algo salió mal</p>
          <p style={{ fontSize: 13 }}>{this.state.error?.message}</p>
          <button onClick={() => this.setState({ hasError: false, error: undefined })}
            style={{ marginTop: 12, padding: "8px 16px", borderRadius: 12, border: "1.5px solid rgba(131,99,249,0.25)", background: "rgba(131,99,249,0.08)", color: "#523a9e", cursor: "pointer", fontWeight: 700 }}>
            Reintentar
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
