import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import ErrorMessage from "../components/ErrorMessage";
import LoadingSpinner from "../components/LoadingSpinner";
import SummaryCard from "../components/SummaryCard";
import { deleteSummary, getErrorMessage, getSummary, listSummaries } from "../services/api";

export default function History() {
  const [page, setPage] = useState(1);
  const [data, setData] = useState(null);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState("");

  useEffect(() => {
    let ignore = false;

    async function load() {
      setLoading(true);
      setError("");
      try {
        const response = await listSummaries(page);
        if (!ignore) {
          setData(response);
        }
      } catch (requestError) {
        if (!ignore) {
          setData(null);
          setError(getErrorMessage(requestError));
        }
      } finally {
        if (!ignore) {
          setLoading(false);
        }
      }
    }

    load();
    return () => {
      ignore = true;
    };
  }, [page]);

  async function handleView(id) {
    setBusyId(id);
    setError("");
    try {
      const response = await getSummary(id);
      setSelected(response.summary);
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setBusyId("");
    }
  }

  async function handleDelete(id) {
    const confirmed = window.confirm("Delete this saved summary?");
    if (!confirmed) {
      return;
    }
    setBusyId(id);
    setError("");
    try {
      await deleteSummary(id);
      if (selected?.id === id) {
        setSelected(null);
      }
      const response = await listSummaries(page);
      setData(response);
      if (response.items.length === 0 && page > 1) {
        setPage(page - 1);
      }
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setBusyId("");
    }
  }

  const items = data?.items || [];

  return (
    <section className="page-panel">
      <p className="eyebrow">Saved results</p>
      <h1>Summary history</h1>
      <p className="lead">Previous summaries are listed here. Original documents are not stored.</p>
      <ErrorMessage message={error} />
      {loading ? <LoadingSpinner label="Loading saved summaries..." /> : null}
      {!loading && !error && items.length === 0 ? (
        <div className="empty-state">
          <p>No summaries yet.</p>
          <Link to="/">Generate a summary</Link>
        </div>
      ) : null}
      <div className="history-list">
        {items.map((item) => (
          <article className="history-card" key={item.id}>
            <div>
              <h2>{item.filename}</h2>
              <p className="history-date">{formatDate(item.createdAt)}</p>
              <p className="history-preview">{preview(item.summary)}</p>
            </div>
            <div className="d-flex flex-wrap gap-2">
              <button
                type="button"
                className="btn btn-accent btn-sm"
                onClick={() => handleView(item.id)}
                disabled={busyId === item.id}
              >
                View
              </button>
              <button
                type="button"
                className="btn btn-outline-danger btn-sm"
                onClick={() => handleDelete(item.id)}
                disabled={busyId === item.id}
              >
                Delete
              </button>
            </div>
          </article>
        ))}
      </div>
      {selected ? (
        <SummaryCard filename={selected.filename} summary={selected.summary} modelId={selected.modelId} />
      ) : null}
      {data && data.totalPages > 1 ? (
        <div className="d-flex gap-2 align-items-center pager">
          <button
            type="button"
            className="btn btn-outline-dark btn-sm"
            onClick={() => setPage(page - 1)}
            disabled={page <= 1}
          >
            Previous
          </button>
          <span>
            Page {data.page} of {data.totalPages}
          </span>
          <button
            type="button"
            className="btn btn-outline-dark btn-sm"
            onClick={() => setPage(page + 1)}
            disabled={page >= data.totalPages}
          >
            Next
          </button>
        </div>
      ) : null}
    </section>
  );
}

function preview(summary) {
  const text = (summary || []).slice(0, 2).join(" ");
  if (text.length <= 180) {
    return text;
  }
  return `${text.slice(0, 177)}...`;
}

function formatDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  return date.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}
