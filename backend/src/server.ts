import { buildApp } from "./app.js";
import { config } from "./config.js";
import { db } from "./db.js";
import { intel } from "./intel/store.js";
import { startIntelIngestion } from "./intel/ingest.js";

const app = await buildApp();

try {
  await db.connect();
  if (db.connected) app.log.info("MongoDB connected");
  else if (config.mongoUri)
    app.log.warn(`MongoDB unavailable (${db.info().error}) — running without persistence`);
  else app.log.info("No MONGODB_URI set — running without persistence");

  await intel.load();
  startIntelIngestion({ info: (m) => app.log.info(m) });
  await app.listen({ port: config.port, host: config.host });
  app.log.info(`SolShield backend listening on :${config.port}`);
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
