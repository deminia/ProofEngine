import React from "react";

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("ErrorBoundary caught an error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 32, maxWidth: 800, margin: "40px auto", background: "var(--panel)", borderRadius: 12, border: "1px solid var(--border)" }}>
          <div style={{ fontSize: 24, marginBottom: 12 }}>⚠️ พบข้อผิดพลาดในการแสดงผลแท็บนี้</div>
          <p style={{ color: "var(--muted)", marginBottom: 16 }}>
            แท็บนี้พบข้อผิดพลาดบางประการ กรุณาลองกดปุ่มโหลดใหม่ หรือสลับไปยังแท็บอื่น
          </p>
          <div style={{ padding: 12, background: "rgba(0,0,0,0.4)", borderRadius: 8, fontSize: 13, color: "#f87171", fontFamily: "monospace", marginBottom: 20 }}>
            {this.state.error?.toString()}
          </div>
          <button
            className="primary"
            onClick={() => this.setState({ hasError: false, error: null })}
          >
            🔄 ลองใหม่อีกครั้ง (Retry)
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export default ErrorBoundary;
