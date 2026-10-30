export function summaryToText(summary, filename) {
  const lines = summary.map((point, index) => `${index + 1}. ${point}`).join("\n");
  const title = filename ? `Summary of ${filename}` : "Summary";
  return `${title}\n\n${lines}\n`;
}

export async function copySummary(summary, filename) {
  if (!navigator.clipboard?.writeText) {
    throw new Error("Clipboard is not available.");
  }
  await navigator.clipboard.writeText(summaryToText(summary, filename));
}

export function downloadSummary(summary, filename) {
  const text = summaryToText(summary, filename);
  const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  const baseName = String(filename || "document").replace(/\.[^.]+$/, "");
  const safeName = baseName.replace(/[^\w.\- ()]/g, "_") || "document";
  link.href = url;
  link.download = `summary-${safeName}.txt`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
