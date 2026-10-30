import { useEffect, useRef, useState } from "react";
import { MAX_FILE_SIZE_MB } from "../constants";

export default function FileUploader({ file, onFileChange, disabled }) {
  const inputRef = useRef(null);
  const [dragOver, setDragOver] = useState(false);

  useEffect(() => {
    if (!file && inputRef.current) {
      inputRef.current.value = "";
    }
  }, [file]);

  function selectFile(nextFile) {
    if (!disabled && nextFile) {
      onFileChange(nextFile);
    }
  }

  function handleDrop(event) {
    event.preventDefault();
    setDragOver(false);
    selectFile(event.dataTransfer.files?.[0]);
  }

  return (
    <div
      className={`dropzone ${dragOver ? "is-active" : ""} ${disabled ? "is-disabled" : ""}`}
      onDragOver={(event) => {
        event.preventDefault();
        if (!disabled) {
          setDragOver(true);
        }
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={handleDrop}
    >
      <p className="dropzone-title">Drag and drop a document here</p>
      <p className="dropzone-copy">PDF, DOCX, or TXT up to {MAX_FILE_SIZE_MB} MB</p>
      <button
        type="button"
        className="btn btn-outline-dark"
        onClick={() => inputRef.current?.click()}
        disabled={disabled}
      >
        Browse Files
      </button>
      <input
        ref={inputRef}
        type="file"
        className="visually-hidden"
        aria-label="Choose a document"
        accept=".pdf,.docx,.txt,application/pdf,text/plain"
        onChange={(event) => selectFile(event.target.files?.[0])}
        disabled={disabled}
      />
      {file ? (
        <div className="selected-file">
          <strong>{file.name}</strong>
          <span>{formatFileSize(file.size)}</span>
        </div>
      ) : null}
    </div>
  );
}

function formatFileSize(bytes) {
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
