import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const sourceRoot = path.resolve("src");
const forbidden = [
  "AWS_SECRET_ACCESS_KEY",
  "AWS_ACCESS_KEY_ID",
  "PYTHON_SERVICE_TOKEN",
  "PYTHON_SERVICE_URL",
  "BEDROCK_MODEL_ID",
  "AKIA",
];

describe("frontend source", () => {
  it("does not contain private service settings or AWS credentials", () => {
    const files = walk(sourceRoot).filter((file) => !file.endsWith(".test.js") && !file.endsWith(".test.jsx"));
    const hits = [];
    for (const file of files) {
      const contents = readFileSync(file, "utf8");
      for (const secret of forbidden) {
        if (contents.includes(secret)) {
          hits.push(`${path.relative(sourceRoot, file)} contains ${secret}`);
        }
      }
    }
    expect(hits).toEqual([]);
  });
});

function walk(directory) {
  const files = [];
  for (const entry of readdirSync(directory)) {
    const fullPath = path.join(directory, entry);
    if (statSync(fullPath).isDirectory()) {
      files.push(...walk(fullPath));
    } else {
      files.push(fullPath);
    }
  }
  return files;
}
