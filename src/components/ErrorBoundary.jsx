import React from "react";

/**
 * ErrorBoundary — catches JavaScript errors in module trees and displays a
 * useful diagnostic message instead of a blank screen.
 *
 * Why this exists:
 * Without an error boundary, ANY thrown error in any child component unmounts
 * the entire React tree and the user sees nothing. Schema mismatches, missing
 * data fields, and runtime errors all produce the same symptom: blank page.
 * That makes debugging slow and shipping confidence low.
 *
 * With this boundary, errors are caught at the module level, logged to console
 * with full context, and displayed inline with a "what to do" message. The
 * rest of the app keeps working — the user can navigate to other modules
 * while the broken one is fixed.
 *
 * Built by Imaginary Farms LLC
 */
export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, info: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    // Log full diagnostic to the console so Claude can read it during debug
    console.group(`🔴 ErrorBoundary caught an error in module: ${this.props.name || "unknown"}`);
    console.error("Error:", error);
    console.error("Component stack:", info?.componentStack);
    console.groupEnd();
    this.setState({ info });
  }

  reset = () => {
    this.setState({ hasError: false, error: null, info: null });
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    const moduleName = this.props.name || "this module";
    const errMsg = this.state.error?.message || String(this.state.error || "Unknown error");
    const stackPreview = (this.state.error?.stack || "")
      .split("\n")
      .slice(0, 5)
      .join("\n");

    return (
      <div style={{
        padding: "24px",
        margin: "16px 0",
        background: "#FEF3C7",
        border: "1px solid #FBBF24",
        borderRadius: 12,
        color: "#92400E",
      }}>
        <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:12 }}>
          <span style={{ fontSize:24 }}>⚠️</span>
          <div>
            <div style={{ fontSize:15, fontWeight:700, color:"#92400E" }}>
              Something went wrong loading {moduleName}
            </div>
            <div style={{ fontSize:12, color:"#B45309", marginTop:2 }}>
              The rest of the BCC is still working — try another module while this is fixed.
            </div>
          </div>
        </div>

        <div style={{
          fontFamily: "monospace",
          fontSize: 11,
          background: "#FFFBEB",
          padding: "10px 12px",
          borderRadius: 8,
          border: "1px solid #FDE68A",
          color: "#78350F",
          marginBottom: 12,
          overflow: "auto",
        }}>
          <div style={{ fontWeight: 700, marginBottom: 4 }}>{errMsg}</div>
          {stackPreview && (
            <pre style={{ margin:0, whiteSpace:"pre-wrap", fontSize:10, color:"#92400E" }}>
              {stackPreview}
            </pre>
          )}
        </div>

        <div style={{ display:"flex", gap:8 }}>
          <button onClick={this.reset} style={{
            padding: "8px 14px",
            fontSize: 12, fontWeight: 600,
            background: "#F59E0B", color: "#fff",
            border: "none", borderRadius: 7, cursor: "pointer",
          }}>Try again</button>
          <button onClick={() => location.reload()} style={{
            padding: "8px 14px",
            fontSize: 12, fontWeight: 600,
            background: "#fff", color: "#92400E",
            border: "1px solid #FBBF24", borderRadius: 7, cursor: "pointer",
          }}>Reload page</button>
        </div>

        <div style={{ marginTop:14, fontSize:11, color:"#78350F" }}>
          <strong>For your Claude:</strong> Check the browser console for the full error and stack trace.
          The most common cause is a schema mismatch — a column referenced in the code that does not
          exist in the database. Run <code style={{ background:"#FFFBEB", padding:"1px 5px", borderRadius:3 }}>npm run audit:schema</code> to find it.
        </div>
      </div>
    );
  }
}
