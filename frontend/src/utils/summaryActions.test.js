import { describe, expect, it, vi } from "vitest";
import { copySummary, downloadSummary, summaryToText } from "./summaryActions";

describe("summary actions", () => {
  it("formats a numbered summary", () => {
    expect(summaryToText(["First point", "Second point"], "notes.txt")).toBe(
      "Summary of notes.txt\n\n1. First point\n2. Second point\n"
    );
  });

  it("copies the numbered summary", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });

    await copySummary(["First point"], "notes.txt");
    expect(writeText).toHaveBeenCalledWith("Summary of notes.txt\n\n1. First point\n");
  });

  it("downloads a text file", () => {
    const clicks = [];
    URL.createObjectURL = vi.fn(() => "blob:summary");
    URL.revokeObjectURL = vi.fn();
    const originalClick = HTMLAnchorElement.prototype.click;
    HTMLAnchorElement.prototype.click = function click() {
      clicks.push(this.download);
    };

    downloadSummary(["First point"], "notes.txt");

    expect(clicks).toEqual(["summary-notes.txt"]);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:summary");
    HTMLAnchorElement.prototype.click = originalClick;
  });
});
