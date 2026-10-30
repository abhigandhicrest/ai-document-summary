import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import SummaryCard from "../components/SummaryCard";

describe("SummaryCard", () => {
  it("shows the summary and supports copy and download", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });
    URL.createObjectURL = vi.fn(() => "blob:summary");
    URL.revokeObjectURL = vi.fn();

    render(
      <SummaryCard
        filename="notes.txt"
        summary={["First point", "Second point"]}
        modelId="amazon.nova-lite-v1:0"
      />
    );

    expect(screen.getAllByRole("listitem")).toHaveLength(2);
    expect(screen.getByText("First point")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Copy Summary" }));

    await waitFor(() => {
      expect(writeText).toHaveBeenCalledWith(
        "Summary of notes.txt\n\n1. First point\n2. Second point\n"
      );
    });
    expect(screen.getByRole("button", { name: "Copied" })).toBeTruthy();

    const originalClick = HTMLAnchorElement.prototype.click;
    HTMLAnchorElement.prototype.click = () => {};
    fireEvent.click(screen.getByRole("button", { name: "Download Summary" }));
    HTMLAnchorElement.prototype.click = originalClick;
    expect(URL.createObjectURL).toHaveBeenCalled();
  });
});
