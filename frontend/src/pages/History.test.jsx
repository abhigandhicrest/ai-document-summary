import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import History from "../pages/History";

vi.mock("../services/api", () => ({
  listSummaries: vi.fn(),
  getSummary: vi.fn(),
  deleteSummary: vi.fn(),
  getErrorMessage: (error) => error.message || "Unable to reach the server.",
}));

import { deleteSummary, getSummary, listSummaries } from "../services/api";

const record = {
  id: "64b7f3a2c1d4e5f678901234",
  filename: "notes.txt",
  fileType: "txt",
  fileSize: 20,
  summary: ["The note describes the project timeline."],
  modelId: "amazon.nova-lite-v1:0",
  createdAt: "2026-03-03T10:00:00.000Z",
};

describe("History", () => {
  beforeEach(() => {
    listSummaries.mockReset();
    getSummary.mockReset();
    deleteSummary.mockReset();
  });

  it("shows an empty state", async () => {
    listSummaries.mockResolvedValue({ items: [], page: 1, totalPages: 0, total: 0 });
    render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <History />
      </MemoryRouter>
    );
    expect(await screen.findByText("No summaries yet.")).toBeTruthy();
  });

  it("shows an error when history cannot be loaded", async () => {
    listSummaries.mockRejectedValue(new Error("Summary history is unavailable because the database is not connected."));
    render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <History />
      </MemoryRouter>
    );
    expect((await screen.findByRole("alert")).textContent).toMatch(/database is not connected/i);
  });

  it("views and deletes a saved summary", async () => {
    listSummaries.mockResolvedValue({ items: [record], page: 1, totalPages: 1, total: 1 });
    getSummary.mockResolvedValue({ success: true, summary: record });
    deleteSummary.mockResolvedValue({ success: true });
    vi.spyOn(window, "confirm").mockReturnValue(true);

    render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <History />
      </MemoryRouter>
    );

    expect(await screen.findByText("notes.txt")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "View" }));
    expect(await screen.findByRole("list")).toBeTruthy();
    expect(getSummary).toHaveBeenCalledWith(record.id);

    listSummaries.mockResolvedValueOnce({ items: [], page: 1, totalPages: 0, total: 0 });
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    await screen.findByText("No summaries yet.");
    expect(deleteSummary).toHaveBeenCalledWith(record.id);
  });
});
