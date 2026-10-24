import { describe, expect, it } from "vitest";

import { renderMarkdown } from "./markdown";

describe("renderMarkdown", () => {
  it("renders recipe markdown, including GFM tables", () => {
    const html = renderMarkdown("## Method\n\n1. Mix\n\n| a | b |\n| - | - |\n| 1 | 2 |\n");
    expect(html).toContain("<h2>Method</h2>");
    expect(html).toContain("<ol>");
    expect(html).toContain("<table>");
  });

  it("escapes raw HTML", () => {
    const html = renderMarkdown('<script>alert(1)</script>\n\n<img src=x onerror="alert(1)">');
    expect(html).not.toContain("<script");
    expect(html).not.toContain("<img");
    expect(html).toContain("&lt;script&gt;");
  });

  it("drops dangerous link protocols", () => {
    const html = renderMarkdown("[x](javascript:alert(1)) [y](https://example.com)");
    expect(html).not.toContain("javascript:");
    expect(html).toContain('href="https://example.com"');
  });
});
