import { Repo } from "../src/db.js";
import { createApp, type AppDeps } from "../src/app.js";
import { seedIfEmpty } from "../src/seed/index.js";

export function makeApp(over: Partial<AppDeps> = {}) {
  const repo = new Repo(":memory:");
  seedIfEmpty(repo);
  const app = createApp({ repo, ...over });
  const req = (path: string, init?: RequestInit) => app.request(path, init);
  const json = (path: string, body: unknown, method = "POST", headers: Record<string, string> = {}) =>
    app.request(path, { method, body: JSON.stringify(body), headers: { "content-type": "application/json", ...headers } });
  return { repo, app, req, json };
}
