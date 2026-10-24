import type { EntryContext } from "react-router";
import { ServerRouter } from "react-router";
import { isbot } from "isbot";
import { renderToReadableStream } from "react-dom/server";

export default async function handleRequest(
  request: Request,
  responseStatusCode: number,
  responseHeaders: Headers,
  routerContext: EntryContext,
) {
  let shellRendered = false;
  const userAgent = request.headers.get("user-agent");

  const body = await renderToReadableStream(
    <ServerRouter context={routerContext} url={request.url} />,
    {
      onError(error: unknown) {
        responseStatusCode = 500;
        // Log streaming rendering errors from inside the shell.  Don't log
        // errors encountered during initial shell rendering since they'll
        // reject and get logged in handleDocumentRequest.
        if (shellRendered) {
          console.error(error);
        }
      },
    },
  );
  shellRendered = true;

  // Ensure requests from bots and SPA Mode renders wait for all content to load before responding
  // https://react.dev/reference/react-dom/server/renderToPipeableStream#waiting-for-all-content-to-load-for-crawlers-and-static-generation
  if ((userAgent && isbot(userAgent)) || routerContext.isSpaMode) {
    await body.allReady;
  }

  responseHeaders.set("Content-Type", "text/html");
  // Recipe text is untrusted, and markdown images would let it make the
  // reader's browser fetch from any host (a tracking pixel). Set on every
  // document, because client-side navigation keeps the first page's policy.
  // Appended, not set: routes may send their own policy (the OAuth consent
  // page forbids framing), and both must hold.
  const csp = responseHeaders.get("Content-Security-Policy");
  responseHeaders.set(
    "Content-Security-Policy",
    [csp, "img-src 'self' data:"].filter(Boolean).join("; "),
  );
  return new Response(body, {
    headers: responseHeaders,
    status: responseStatusCode,
  });
}
