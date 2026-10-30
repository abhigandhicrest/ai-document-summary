import { useState } from "react";
import { copySummary, downloadSummary } from "../utils/summaryActions";
import ErrorMessage from "./ErrorMessage";

export default function SummaryCard({ filename, summary, modelId, note }) {
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState("");

  async function handleCopy() {
    try {
      await copySummary(summary, filename);
      setCopied(true);
      setCopyError("");
      window.setTimeout(() => setCopied(false), 2000);
    } catch (_error) {
      setCopyError("The summary could not be copied. Use Download Summary instead.");
    }
  }

  return (
    <section className="summary-card" aria-live="polite">
      <div className="summary-card-header">
        <div>
          <p className="eyebrow">Summary</p>
          <h2>{filename}</h2>
        </div>
        {modelId ? <span className="model-pill">{modelId}</span> : null}
      </div>
      <ol className="summary-list">
        {summary.map((point, index) => (
          <li key={`${index}-${point.slice(0, 24)}`}>{point}</li>
        ))}
      </ol>
      {note ? <p className="persistence-note">{note}</p> : null}
      <ErrorMessage message={copyError} />
      <div className="d-flex flex-wrap gap-2">
        <button type="button" className="btn btn-accent" onClick={handleCopy}>
          {copied ? "Copied" : "Copy Summary"}
        </button>
        <button type="button" className="btn btn-outline-dark" onClick={() => downloadSummary(summary, filename)}>
          Download Summary
        </button>
      </div>
    </section>
  );
}
