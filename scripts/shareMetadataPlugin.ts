import type { Plugin } from "vite";
import { readFile } from "node:fs/promises";
import { decorateShareHtml, publicOrigin } from "../src/multiplayer/shareMetadata";

export function shareMetadataPlugin(siteUrl = ""): Plugin {
  const origin = publicOrigin(siteUrl);
  return {
    name: "find-it-share-metadata", enforce: "post",
    transformIndexHtml(html, context) { return decorateShareHtml(html, origin, context.originalUrl ?? "/"); },
    configureServer(server) {
      server.middlewares.use((request, response, next) => {
        const url = request.url ?? "/";
        if (!["/", "/multiplayer"].includes(url.split("?")[0]) || !["GET", "HEAD"].includes(request.method ?? "")) { next(); return; }
        void (async () => {
          const template = await readFile(`${server.config.root}/index.html`, "utf8");
          const html = await server.transformIndexHtml(url, template);
          response.setHeader("Content-Type", "text/html; charset=utf-8");
          response.setHeader("Cache-Control", "no-store");
          response.end(request.method === "HEAD" ? undefined : decorateShareHtml(html, `http://${request.headers.host}`, url));
        })().catch(next);
      });
    },
    generateBundle(_options, bundle) {
      const index = bundle["index.html"];
      if (index?.type === "asset") this.emitFile({ type: "asset", fileName: "multiplayer.html",
        source: decorateShareHtml(String(index.source), origin, "/multiplayer") });
    },
  };
}
