import { serve } from "@hono/node-server";
import { createApp } from "./app.js";
import { createChainReader, nullChain } from "./chain.js";
import { Repo } from "./db.js";
import { env } from "./env.js";
import { seedIfEmpty } from "./seed/index.js";

const e = env();
const repo = Repo.open(e.dataDir);
if (seedIfEmpty(repo)) console.log(`seeded catalog with ${repo.countCards()} cards`);
const anyContract = Object.values(e.contracts).some(Boolean);
const chain = anyContract ? createChainReader(e) : nullChain;
const app = createApp({ repo, chain });

const server = serve({ fetch: app.fetch, port: e.port }, (info) => {
  console.log(`cata backend listening on http://localhost:${info.port} (chain reads: ${anyContract ? "on" : "off"}, scan: ${e.anthropicKey ? "on" : "off"})`);
});
const stop = () => server.close(() => process.exit(0));
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
