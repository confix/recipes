import { micromark } from "micromark";
import { gfm, gfmHtml } from "micromark-extension-gfm";

/**
 * Markdown → HTML for display. Recipe text can come from anywhere (LLMs via
 * MCP, imported pages), so it is treated as untrusted: micromark's defaults
 * escape raw HTML and drop dangerous link protocols (javascript:, data:, …).
 * Never pass allowDangerousHtml / allowDangerousProtocol here.
 */
export function renderMarkdown(markdown: string): string {
  return micromark(markdown, {
    extensions: [gfm()],
    htmlExtensions: [gfmHtml()],
  });
}
