import { createServer } from "node:http";
import os from "os";
import app from "./app.js";
import { logger } from "./lib/logger.js";
import { initSocketIO, setIO } from "./socket/index.js";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error("PORT environment variable is required but was not provided.");
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

// Create HTTP server wrapping Express (required for Socket.IO)
const httpServer = createServer(app);

// Initialize Socket.IO real-time engine
const io = initSocketIO(httpServer);
setIO(io);

// Initialize Cron Jobs (dynamic import to avoid issues with ESM circular deps)
import("./lib/cron.js").then(() => {
  logger.info("Cron jobs loaded and running");
}).catch((err) => {
  logger.error({ err }, "Failed to load cron jobs — cron disabled");
});

httpServer.listen(port, () => {
  logger.info({ port }, "Server listening");

  // Log QR base URL so developer always knows what phones will scan
  const envUrl = process.env.PICKUP_BASE_URL || process.env.FRONTEND_URL || process.env.VITE_APP_URL;
  if (envUrl) {
    logger.info(`[QR codes] Using env-configured URL: ${envUrl}`);
  } else {
    const ifaces = os.networkInterfaces();
    let localIP = "localhost";
    for (const list of Object.values(ifaces)) {
      for (const iface of list ?? []) {
        if (iface.family === "IPv4" && !iface.internal && !iface.address.startsWith("169.")) {
          localIP = iface.address;
          break;
        }
      }
      if (localIP !== "localhost") break;
    }
    const frontendPort = process.env.FRONTEND_PORT || "5173";
    logger.info(`[QR codes] Auto-detected base URL: http://${localIP}:${frontendPort} — phones on same WiFi can scan`);
  }
});
