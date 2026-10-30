import axios from "axios";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || "http://localhost:5000",
  timeout: 15000,
});

export async function createSummary(file) {
  const form = new FormData();
  form.append("document", file);
  const response = await api.post("/api/summaries", form, {
    timeout: 130000,
  });
  return response.data;
}

export async function listSummaries(page = 1) {
  const response = await api.get("/api/summaries", { params: { page, limit: 10 } });
  return response.data;
}

export async function getSummary(id) {
  const response = await api.get(`/api/summaries/${id}`);
  return response.data;
}

export async function deleteSummary(id) {
  const response = await api.delete(`/api/summaries/${id}`);
  return response.data;
}

export function getErrorMessage(error) {
  return (
    error?.response?.data?.error?.message ||
    "Unable to reach the server. Check that the API is running."
  );
}
