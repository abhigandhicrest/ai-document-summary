import { useState } from "react";
import { ACCEPTED_EXTENSIONS, MAX_FILE_SIZE_MB } from "../constants";
import { createSummary, getErrorMessage } from "../services/api";
import ErrorMessage from "../components/ErrorMessage";
import FileUploader from "../components/FileUploader";
import LoadingSpinner from "../components/LoadingSpinner";
import SummaryCard from "../components/SummaryCard";

export default function Dashboard() {
  const [file, setFile] = useState(null);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  function handleFileChange(nextFile) {
    setFile(nextFile);
    setError("");
    setResult(null);
  }

  async function handleGenerate() {
    const validationError = validateLocalFile(file);
    if (validationError) {
      setError(validationError);
      setResult(null);
      return;
    }

    setLoading(true);
    setError("");
    setResult(null);
    try {
      const response = await createSummary(file);
      setResult(response);
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setLoading(false);
    }
  }

  function handleClear() {
    setFile(null);
    setResult(null);
    setError("");
  }

  const summary = result?.summary;

  return (
    <section className="page-panel">
      <p className="eyebrow">Document workspace</p>
      <h1>AI Document Summarizer</h1>
      <p className="lead">
        Upload a PDF, Word, or text file. The app extracts the text and asks Amazon Bedrock for a
        concise summary of about 5–10 lines.
      </p>

      <FileUploader file={file} onFileChange={handleFileChange} disabled={loading} />
      <p className="disclaimer">
        Supported files: PDF, DOCX, and TXT up to {MAX_FILE_SIZE_MB} MB. Document text is sent to
        Amazon Bedrock in your AWS account. Original files are not stored. Scanned PDFs need OCR
        and are not supported.
      </p>

      <div className="d-flex flex-wrap gap-2 action-row">
        <button type="button" className="btn btn-accent" onClick={handleGenerate} disabled={!file || loading}>
          Generate Summary
        </button>
        <button type="button" className="btn btn-outline-dark" onClick={handleClear} disabled={loading}>
          Clear
        </button>
      </div>

      <ErrorMessage message={error} />
      {loading ? <LoadingSpinner label="Reading the document and generating a summary..." /> : null}
      {summary ? (
        <SummaryCard
          filename={summary.filename}
          summary={summary.summary}
          modelId={summary.modelId}
          note={result.persisted ? "" : result.message}
        />
      ) : null}
    </section>
  );
}

function validateLocalFile(file) {
  if (!file) {
    return "Choose a document to summarize.";
  }
  const extension = file.name.includes(".") ? file.name.split(".").pop().toLowerCase() : "";
  if (!ACCEPTED_EXTENSIONS.includes(extension)) {
    return "Upload a PDF, DOCX, or TXT file.";
  }
  if (file.size === 0) {
    return "The uploaded file is empty.";
  }
  if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
    return `The file exceeds the ${MAX_FILE_SIZE_MB} MB upload limit.`;
  }
  return "";
}
