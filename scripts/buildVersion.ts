import type { Plugin } from "vite";

export function buildVersion(version: string, now = new Date()) {
  return {
    version,
    buildId: `${version}+${now.toISOString().replace(/[-:.TZ]/g, "")}`,
    builtAt: now.toISOString(),
  };
}

export function versionPlugin(build: ReturnType<typeof buildVersion>): Plugin {
  const source = JSON.stringify(build);
  return {
    name: "find-it-version",
    transformIndexHtml() {
      return [{ tag: "meta", attrs: { name: "application-version", content: build.buildId }, injectTo: "head" }];
    },
    generateBundle() {
      this.emitFile({ type: "asset", fileName: "version.json", source });
    },
    configureServer(server) {
      server.middlewares.use("/version.json", (_request, response) => {
        response.setHeader("Content-Type", "application/json");
        response.setHeader("Cache-Control", "no-store");
        response.end(source);
      });
    },
  };
}
