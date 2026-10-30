export default function LoadingSpinner({ label = "Working..." }) {
  return (
    <div className="loading-panel" role="status" aria-live="polite">
      <div className="spinner-border" aria-hidden="true"></div>
      <p>{label}</p>
    </div>
  );
}
