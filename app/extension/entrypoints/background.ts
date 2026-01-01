import type {
  DetectedService,
  EventLog,
  StorageData,
  CookieInfo,
  LoginDetectedDetails,
  PrivacyPolicyFoundDetails,
  CookieSetDetails,
} from "@ai-service-exposure/core";
import { startCookieMonitor, onCookieChange } from "@/utils/cookie-monitor";
import { initDebugClient } from "@/utils/debug-client";

const MAX_EVENTS = 1000;

let storageQueue: Promise<void> = Promise.resolve();

function queueStorageOperation<T>(operation: () => Promise<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    storageQueue = storageQueue
      .then(() => operation())
      .then(resolve)
      .catch(reject);
  });
}

async function initStorage(): Promise<StorageData> {
  const result = await chrome.storage.local.get(["services", "events"]);
  return {
    services: result.services || {},
    events: result.events || [],
  };
}

async function saveStorage(data: Partial<StorageData>) {
  await chrome.storage.local.set(data);
}

async function updateBadge() {
  try {
    const result = await chrome.storage.local.get(["services"]);
    const count = Object.keys(result.services || {}).length;
    await chrome.action.setBadgeText({ text: count > 0 ? String(count) : "" });
    await chrome.action.setBadgeBackgroundColor({ color: "#666" });
  } catch (error) {
    console.error("[AI Service Exposure] Failed to update badge:", error);
  }
}

function generateEventId(): string {
  return crypto.randomUUID();
}

type NewEvent =
  | {
      type: "login_detected";
      domain: string;
      timestamp: number;
      details: LoginDetectedDetails;
    }
  | {
      type: "privacy_policy_found";
      domain: string;
      timestamp: number;
      details: PrivacyPolicyFoundDetails;
    }
  | {
      type: "cookie_set";
      domain: string;
      timestamp: number;
      details: CookieSetDetails;
    };

async function addEvent(event: NewEvent): Promise<EventLog> {
  return queueStorageOperation(async () => {
    const storage = await initStorage();
    const newEvent = {
      ...event,
      id: generateEventId(),
    } as EventLog;
    storage.events.unshift(newEvent);
    storage.events = storage.events.slice(0, MAX_EVENTS);
    await saveStorage({ events: storage.events });
    await updateBadge();
    return newEvent;
  });
}

function createDefaultService(domain: string): DetectedService {
  return {
    domain,
    detectedAt: Date.now(),
    hasLoginPage: false,
    privacyPolicyUrl: null,
    cookies: [],
  };
}

async function updateService(domain: string, update: Partial<DetectedService>) {
  return queueStorageOperation(async () => {
    const storage = await initStorage();
    const existing = storage.services[domain] || createDefaultService(domain);

    storage.services[domain] = {
      ...existing,
      ...update,
    };

    await saveStorage({ services: storage.services });
    await updateBadge();
  });
}

async function addCookieToService(domain: string, cookie: CookieInfo) {
  return queueStorageOperation(async () => {
    const storage = await initStorage();

    if (!storage.services[domain]) {
      storage.services[domain] = createDefaultService(domain);
    }

    const service = storage.services[domain];
    const exists = service.cookies.some((c) => c.name === cookie.name);
    if (!exists) {
      service.cookies.push(cookie);
    }

    await saveStorage({ services: storage.services });
    await updateBadge();
  });
}

interface PageAnalysis {
  url: string;
  domain: string;
  timestamp: number;
  login: LoginDetectedDetails;
  privacy: {
    found: boolean;
    url: string | null;
    method: string;
  };
}

async function handlePageAnalysis(analysis: PageAnalysis) {
  const { domain, login, privacy, timestamp } = analysis;

  if (login.hasPasswordInput || login.isLoginUrl) {
    await updateService(domain, { hasLoginPage: true });
    await addEvent({
      type: "login_detected",
      domain,
      timestamp,
      details: login,
    });
  }

  if (privacy.found && privacy.url) {
    await updateService(domain, { privacyPolicyUrl: privacy.url });
    await addEvent({
      type: "privacy_policy_found",
      domain,
      timestamp,
      details: { url: privacy.url, method: privacy.method },
    });
  }
}

export default defineBackground(() => {
  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message.type === "PAGE_ANALYZED") {
      handlePageAnalysis(message.payload)
        .then(() => sendResponse({ success: true }))
        .catch((error) => {
          console.error(
            "[AI Service Exposure] Error handling page analysis:",
            error
          );
          sendResponse({ success: false, error: String(error) });
        });
      return true;
    }
    return false;
  });

  startCookieMonitor();

  onCookieChange((cookie, removed) => {
    if (removed) return;

    const domain = cookie.domain.replace(/^\./, "");

    addCookieToService(domain, cookie).catch((error) => {
      console.error("[AI Service Exposure] Error adding cookie:", error);
    });

    addEvent({
      type: "cookie_set",
      domain,
      timestamp: cookie.detectedAt,
      details: {
        name: cookie.name,
        isSession: cookie.isSession,
      },
    }).catch((error) => {
      console.error("[AI Service Exposure] Error adding event:", error);
    });
  });

  updateBadge();

  if (import.meta.env.DEV && import.meta.env.VITE_DEBUG === "true") {
    initDebugClient(
      initStorage,
      async () => {
        await chrome.storage.local.clear();
        await updateBadge();
      }
    );
  }

  console.log("[AI Service Exposure] Background service worker started");
});
