/**
 * LoadingState — skeleton loader while Supabase query runs
 * Shows instead of blank screen or fake data during fetch
 */
export default function LoadingState({ rows = 4, message = "Loading your data..." }) {
  return (
    <div style={{ padding: "16px 0" }}>
      <div style={{
        fontSize: 11, color: "#94A3B8", marginBottom: 16,
        display: "flex", alignItems: "center", gap: 8
      }}>
        <span style={{
          display: "inline-block", width: 8, height: 8,
          borderRadius: "50%", background: "#3B82F6",
          animation: "pulse 1.5s infinite"
        }} />
        {message}
      </div>
      {Array(rows).fill(0).map((_, i) => (
        <div key={i} style={{
          display: "flex", gap: 12, marginBottom: 12, alignItems: "center"
        }}>
          <div style={{
            height: 12, borderRadius: 6, background: "#F1F5F9",
            flex: i % 3 === 0 ? 3 : i % 3 === 1 ? 2 : 1,
            opacity: 1 - (i * 0.15)
          }} />
          <div style={{
            height: 12, borderRadius: 6, background: "#F1F5F9",
            width: 60, opacity: 0.6
          }} />
          <div style={{
            height: 12, borderRadius: 6, background: "#F1F5F9",
            width: 80, opacity: 0.4
          }} />
        </div>
      ))}
    </div>
  );
}
