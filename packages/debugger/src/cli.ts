import { DebugServer } from "./server.js";

const command = process.argv[2] || "dump";

async function main() {
  const server = new DebugServer();

  console.log("Waiting for extension to connect...\n");

  await waitForConnection(server, 30000);

  switch (command) {
    case "dump":
      await dumpStorage(server);
      break;
    case "watch":
      await watchStorage(server);
      break;
    case "clear":
      await clearStorage(server);
      break;
    default:
      console.log("Usage: pnpm start [dump|watch|clear]");
      console.log("  dump  - Dump current storage data and exit");
      console.log("  watch - Watch storage changes");
      console.log("  clear - Clear all storage data");
      server.close();
      process.exit(1);
  }
}

async function waitForConnection(server: DebugServer, timeout: number): Promise<void> {
  const start = Date.now();
  while (!server.isConnected()) {
    if (Date.now() - start > timeout) {
      console.error("Timeout waiting for extension connection.");
      console.error("Make sure the extension is running with debug mode enabled.");
      server.close();
      process.exit(1);
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
    process.stdout.write(".");
  }
  console.log("\nExtension connected!\n");
}

async function dumpStorage(server: DebugServer) {
  const data = await server.getStorage();
  if (!data) {
    console.error("Failed to get storage data");
    server.close();
    process.exit(1);
  }

  console.log("=== Services ===");
  const services = Object.values(data.services);
  if (services.length === 0) {
    console.log("(no services detected)");
  } else {
    for (const service of services) {
      console.log(`\n[${service.domain}]`);
      console.log(`  Detected: ${new Date(service.detectedAt).toISOString()}`);
      console.log(`  Login page: ${service.hasLoginPage}`);
      console.log(`  Privacy policy: ${service.privacyPolicyUrl || "(none)"}`);
      console.log(`  Cookies: ${service.cookies.length}`);
      for (const cookie of service.cookies) {
        console.log(`    - ${cookie.name} (session: ${cookie.isSession})`);
      }
    }
  }

  console.log("\n=== Recent Events ===");
  const events = data.events.slice(0, 20);
  if (events.length === 0) {
    console.log("(no events)");
  } else {
    for (const event of events) {
      const time = new Date(event.timestamp).toISOString();
      console.log(`[${time}] ${event.type} @ ${event.domain}`);
    }
  }

  console.log("\n=== Raw JSON ===");
  console.log(JSON.stringify(data, null, 2));

  server.close();
}

async function watchStorage(server: DebugServer) {
  console.log("Watching storage (Ctrl+C to stop)...\n");

  let lastEventCount = 0;

  const poll = async () => {
    const data = await server.getStorage();
    if (!data) return;

    const eventCount = data.events.length;
    if (eventCount > lastEventCount) {
      const newEvents = data.events.slice(0, eventCount - lastEventCount);
      for (const event of newEvents.reverse()) {
        const time = new Date(event.timestamp).toISOString();
        console.log(`[${time}] ${event.type} @ ${event.domain}`);
      }
      lastEventCount = eventCount;
    }
  };

  setInterval(poll, 2000);

  process.on("SIGINT", () => {
    server.close();
    process.exit(0);
  });
}

async function clearStorage(server: DebugServer) {
  const success = await server.clearStorage();
  if (success) {
    console.log("Storage cleared successfully");
  } else {
    console.error("Failed to clear storage");
  }
  server.close();
}

main().catch((error) => {
  console.error("Error:", error);
  process.exit(1);
});
