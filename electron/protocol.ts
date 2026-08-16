import { net, protocol } from "electron";
import path from "path";
import { pathToFileURL } from "url";

import { getAppRoot } from "./platform/paths";

export function registerPrivilegedSchemes(): void {
  protocol.registerSchemesAsPrivileged([
    {
      scheme: "app",
      privileges: {
        secure: true,
        standard: true,
        supportFetchAPI: true,
        corsEnabled: true,
        stream: true,
      },
    },
  ]);
}

export function registerAppProtocol(): void {
  protocol.handle("app", async (request) => {
    const url = new URL(request.url);
    const relative = decodeURIComponent(url.pathname).replace(/^\/+/, "");
    const root = getAppRoot();
    const filePath = path.normalize(path.join(root, relative));

    if (!filePath.startsWith(root)) {
      return new Response("Forbidden", { status: 403 });
    }

    return net.fetch(pathToFileURL(filePath).href);
  });
}
