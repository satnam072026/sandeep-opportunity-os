import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { pathToFileURL } from "node:url";
import type { IncomingMessage, ServerResponse } from "node:http";

function parseJsonBody(req: IncomingMessage): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk: Buffer) => {
      body += chunk.toString();
    });
    req.on("end", () => {
      try {
        resolve(body ? (JSON.parse(body) as Record<string, unknown>) : {});
      } catch (e) {
        reject(e);
      }
    });
    req.on("error", reject);
  });
}

/**
 * Vite plugin to handle secure server-side synchronization and Neon PostgreSQL API endpoints.
 * Never exposes server environment variables or private keys to the browser bundle.
 */
function neonBackendPlugin(): Plugin {
  const registerApiMiddlewares = (middlewares: { use: (route: string, fn: (req: IncomingMessage, res: ServerResponse, next: () => void) => Promise<void> | void) => void }) => {
    // 1. Ingestion / Sync Endpoint
    middlewares.use("/api/sync", async (req, res, next) => {
      if (req.method === "POST") {
        try {
          const syncScriptUrl = pathToFileURL(path.resolve("./scripts/sync-data.mjs")).href;
          const { runServerSync } = await import(/* @vite-ignore */ syncScriptUrl);
          const telemetry = await runServerSync();
          res.statusCode = 200;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify(telemetry));
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : String(err);
          res.statusCode = 500;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ error: message, status: "FAILED" }));
        }
        return;
      }
      next();
    });

    // 2. Neon Opportunities Endpoint
    middlewares.use("/api/opportunities", async (req, res, next) => {
      if (req.method === "GET") {
        try {
          const backendUrl = pathToFileURL(path.resolve("./src/server/neonBackendService.mjs")).href;
          const { fetchNeonOpportunities } = await import(/* @vite-ignore */ backendUrl);
          const data = await fetchNeonOpportunities();
          res.statusCode = 200;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify(data));
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : String(err);
          res.statusCode = 500;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ error: message, opportunities: [] }));
        }
        return;
      }
      next();
    });

    // 3. Workflow State Mutation Endpoint
    middlewares.use("/api/workflow", async (req, res, next) => {
      if (req.method === "POST" || req.method === "PATCH") {
        try {
          const body = await parseJsonBody(req);
          const opportunityId = body.opportunityId as string;
          const patch = (body.patch || {}) as Record<string, unknown>;

          if (!opportunityId) {
            res.statusCode = 400;
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({ error: "opportunityId is required" }));
            return;
          }

          const backendUrl = pathToFileURL(path.resolve("./src/server/neonBackendService.mjs")).href;
          const { updateNeonWorkflowState } = await import(/* @vite-ignore */ backendUrl);
          const result = await updateNeonWorkflowState(opportunityId, patch);
          res.statusCode = 200;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify(result));
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : String(err);
          res.statusCode = 500;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ error: message }));
        }
        return;
      }
      next();
    });

    // 4. Database Health Telemetry Endpoint
    middlewares.use("/api/db-health", async (req, res, next) => {
      if (req.method === "GET") {
        try {
          const backendUrl = pathToFileURL(path.resolve("./src/server/neonBackendService.mjs")).href;
          const { getDatabaseHealth } = await import(/* @vite-ignore */ backendUrl);
          const health = await getDatabaseHealth();
          res.statusCode = 200;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify(health));
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : String(err);
          res.statusCode = 500;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ connected: false, error: message }));
        }
        return;
      }
      next();
    });

    // 5. Neon Auth Endpoints
    middlewares.use("/api/auth/login", async (req, res, next) => {
      if (req.method === "POST") {
        try {
          const body = await parseJsonBody(req);
          const email = (body.email as string) || "";
          const password = (body.password as string) || "";
          const backendUrl = `${pathToFileURL(path.resolve("./src/server/neonBackendService.mjs")).href}?t=${Date.now()}`;
          const { authenticateAdmin } = await import(/* @vite-ignore */ backendUrl);
          const authResult = await authenticateAdmin(email, password);

          res.statusCode = authResult.success ? 200 : 401;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify(authResult));
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : String(err);
          res.statusCode = 500;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ success: false, error: message }));
        }
        return;
      }
      next();
    });

    middlewares.use("/api/auth/session", async (req, res, next) => {
      if (req.method === "GET") {
        try {
          const authHeader = req.headers.authorization || "";
          const token = authHeader.replace(/^Bearer\s+/i, "").trim();
          const backendUrl = `${pathToFileURL(path.resolve("./src/server/neonBackendService.mjs")).href}?t=${Date.now()}`;
          const { verifySessionToken } = await import(/* @vite-ignore */ backendUrl);
          const sessionResult = await verifySessionToken(token);

          res.statusCode = sessionResult.valid ? 200 : 401;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify(sessionResult));
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : String(err);
          res.statusCode = 500;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ valid: false, error: message }));
        }
        return;
      }
      next();
    });

    middlewares.use("/api/auth/logout", async (req, res, next) => {
      if (req.method === "POST") {
        try {
          const authHeader = req.headers.authorization || "";
          const token = authHeader.replace(/^Bearer\s+/i, "").trim();
          const backendUrl = `${pathToFileURL(path.resolve("./src/server/neonBackendService.mjs")).href}?t=${Date.now()}`;
          const { logoutSession } = await import(/* @vite-ignore */ backendUrl);
          await logoutSession(token);

          res.statusCode = 200;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ success: true }));
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : String(err);
          res.statusCode = 500;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ success: false, error: message }));
        }
        return;
      }
      next();
    });
  };

  return {
    name: "neon-backend-plugin",
    configureServer(server) {
      registerApiMiddlewares(server.middlewares);
    },
    configurePreviewServer(server) {
      registerApiMiddlewares(server.middlewares);
    }
  };
}

export default defineConfig({
  plugins: [react(), neonBackendPlugin()],
  build: {
    outDir: "dist",
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("node_modules")) {
            if (id.includes("react") || id.includes("react-dom") || id.includes("scheduler")) {
              return "vendor-react";
            }
            if (id.includes("lucide-react")) {
              return "vendor-icons";
            }
            if (id.includes("@supabase")) {
              return "vendor-supabase";
            }
            return "vendor";
          }
          if (id.includes("verified_seed_24.json")) {
            return "seed-data";
          }
          if (id.includes("explorerData")) {
            return "explorer-data";
          }
        }
      }
    }
  }
});
