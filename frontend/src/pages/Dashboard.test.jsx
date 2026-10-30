import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import Dashboard from "../pages/Dashboard";

vi.mock("../services/api", () => ({
  createSummary: vi.fn(),
  getErrorMessage: (error) =>
    error?.response?.data?.error?.message || "Unable to reach the server. Check that the API is running.",
}));

import { createSummary } from "../services/api";

describe("Dashboard", () => {
  beforeEach(() => {
    createSummary.mockReset();
  });

  it("summarizes a text file and can clear the result", async () => {
    createSummary.mockResolvedValue({
      success: true,
      persisted: true,
      message: null,
      summary: {
        filename: "notes.txt",
        summary: ["The note records a March launch."],
        modelId: "amazon.nova-lite-v1:0",
      },
    });

    render(<Dashboard />);
    const file = new File(["Launch notes for March."], "notes.txt", { type: "text/plain" });
    fireEvent.change(screen.getByLabelText("Choose a document"), { target: { files: [file] } });
    expect(screen.getByText("notes.txt")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Generate Summary" }));
    expect(await screen.findByText("The note records a March launch.")).toBeTruthy();
    expect(createSummary).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("button", { name: "Clear" }));
    expect(screen.queryByText("The note records a March launch.")).toBeNull();
  });

  it("rejects an unsupported file before calling the API", () => {
    render(<Dashboard />);
    const file = new File(["image"], "photo.png", { type: "image/png" });
    fireEvent.change(screen.getByLabelText("Choose a document"), { target: { files: [file] } });
    fireEvent.click(screen.getByRole("button", { name: "Generate Summary" }));
    expect(screen.getByRole("alert").textContent).toMatch(/PDF, DOCX, or TXT/);
    expect(createSummary).not.toHaveBeenCalled();
  });

  it("rejects an empty file", () => {
    render(<Dashboard />);
    const file = new File([], "empty.txt", { type: "text/plain" });
    fireEvent.change(screen.getByLabelText("Choose a document"), { target: { files: [file] } });
    fireEvent.click(screen.getByRole("button", { name: "Generate Summary" }));
    expect(screen.getByRole("alert").textContent).toMatch(/empty/i);
    expect(createSummary).not.toHaveBeenCalled();
  });

  it("shows a Python service failure", async () => {
    createSummary.mockRejectedValue({
      response: {
        data: {
          error: {
            message: "The summarization service is unavailable. Start the Python service and try again.",
          },
        },
      },
    });
    render(<Dashboard />);
    const file = new File(["A useful note."], "notes.txt", { type: "text/plain" });
    fireEvent.change(screen.getByLabelText("Choose a document"), { target: { files: [file] } });
    fireEvent.click(screen.getByRole("button", { name: "Generate Summary" }));
    expect((await screen.findByRole("alert")).textContent).toMatch(/summarization service is unavailable/i);
  });
});
