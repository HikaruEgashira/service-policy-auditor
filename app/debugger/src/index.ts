import { readExtensionStorage, watchExtensionStorage } from "./storage-reader.js";

const command = process.argv[2] || "dump";

async function main() {
  switch (command) {
    case "dump":
      await dumpStorage();
      break;
    case "watch":
      await watchStorage();
      break;
    default:
      console.log("Usage: pnpm start [dump|watch]");
      console.log("  dump  - Dump current storage data and exit");
      console.log("  watch - Watch storage changes in real-time");
      process.exit(1);
  }
}

async function dumpStorage() {
  console.log("Reading extension storage...\n");
  const data = await readExtensionStorage();

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
}

async function watchStorage() {
  console.log("Watching extension storage (Ctrl+C to stop)...\n");

  let lastEventCount = 0;
  let lastServiceCount = 0;

  await watchExtensionStorage((data) => {
    const eventCount = data.events.length;
    const serviceCount = Object.keys(data.services).length;

    if (eventCount !== lastEventCount || serviceCount !== lastServiceCount) {
      const now = new Date().toISOString();
      console.log(`[${now}] Services: ${serviceCount}, Events: ${eventCount}`);

      if (eventCount > lastEventCount) {
        const newEvents = data.events.slice(0, eventCount - lastEventCount);
        for (const event of newEvents.reverse()) {
          console.log(`  + ${event.type} @ ${event.domain}`);
        }
      }

      lastEventCount = eventCount;
      lastServiceCount = serviceCount;
    }
  });
}

main().catch((error) => {
  console.error("Error:", error);
  process.exit(1);
});
