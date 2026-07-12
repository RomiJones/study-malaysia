import { createServer } from "node:net";

export function buildIsolatedDatabaseName(runStamp) {
  const suffix = String(runStamp).replace(/[^a-zA-Z0-9]/g, "").toLowerCase();
  if (!suffix) throw new Error("E2E run stamp must produce a non-empty database suffix.");
  return `study_malaysia_e2e_${suffix}`;
}

export async function allocateLoopbackPort(preferredPort) {
  const requested = preferredPort == null || preferredPort === "" ? 0 : Number(preferredPort);
  if (!Number.isInteger(requested) || requested < 0 || requested > 65535) {
    throw new Error(`Invalid E2E port: ${preferredPort}`);
  }

  return await new Promise((resolvePromise, rejectPromise) => {
    const server = createServer();
    server.unref();
    server.once("error", (error) => rejectPromise(error));
    server.listen({ host: "127.0.0.1", port: requested, exclusive: true }, () => {
      const address = server.address();
      const port = typeof address === "object" && address ? address.port : null;
      server.close((error) => {
        if (error) rejectPromise(error);
        else if (!port) rejectPromise(new Error("Unable to allocate an E2E port."));
        else resolvePromise(port);
      });
    });
  });
}
