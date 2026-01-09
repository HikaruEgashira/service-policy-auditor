import type {
  DetectedService,
  EventLog,
  CookieInfo,
  LoginDetectedDetails,
  PrivacyPolicyFoundDetails,
  TosFoundDetails,
  CookieSetDetails,
} from "@service-policy-auditor/detectors";
import type {
  CSPViolation,
  NetworkRequest,
  CSPReport,
  CSPConfig,
  CSPViolationDetails,
  NetworkRequestDetails,
  GeneratedCSPPolicy,
  CSPGenerationOptions,
} from "@service-policy-auditor/csp";
import { DEFAULT_CSP_CONFIG } from "@service-policy-auditor/csp";
import { CSPAnalyzer, type GeneratedCSPByDomain } from "@service-policy-auditor/csp";
import { startCookieMonitor, onCookieChange } from "@/utils/cookie-monitor";
import { CSPReporter } from "@/utils/csp-reporter";
import { createMessageRouter, fireAndForget } from "@/utils/message-handler";
import {
  queueStorageOperation,
  getStorage,
  setStorage,
  getServiceCount,
  clearCSPReports,
} from "@/utils/storage";
import { DatabaseClient } from "@/utils/db-client";
import { checkMigrationNeeded, migrateToDatabase } from "@/utils/migration";

const MAX_EVENTS = 1000;
const DEV_REPORT_ENDPOINT = "http://localhost:3001/api/v1/reports";

async function updateBadge() {
  try {
    const count = await getServiceCount();
    await chrome.action.setBadgeText({ text: count > 0 ? String(count) : "" });
    await chrome.action.setBadgeBackgroundColor({ color: "#666" });
  } catch (error) {
    console.error("[Service Policy Auditor] Failed to update badge:", error);
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
      type: "terms_of_service_found";
      domain: string;
      timestamp: number;
      details: TosFoundDetails;
    }
  | {
      type: "cookie_set";
      domain: string;
      timestamp: number;
      details: CookieSetDetails;
    }
  | {
      type: "csp_violation";
      domain: string;
      timestamp: number;
      details: CSPViolationDetails;
    }
  | {
      type: "network_request";
      domain: string;
      timestamp: number;
      details: NetworkRequestDetails;
    };

async function addEvent(event: NewEvent): Promise<EventLog> {
  return queueStorageOperation(async () => {
    const storage = await getStorage();
    const newEvent = {
      ...event,
      id: generateEventId(),
    } as EventLog;
    storage.events.unshift(newEvent);
    storage.events = storage.events.slice(0, MAX_EVENTS);
    await setStorage({ events: storage.events });
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
    termsOfServiceUrl: null,
    cookies: [],
  };
}

async function updateService(domain: string, update: Partial<DetectedService>) {
  return queueStorageOperation(async () => {
    const storage = await getStorage();
    const existing = storage.services[domain] || createDefaultService(domain);

    storage.services[domain] = {
      ...existing,
      ...update,
    };

    await setStorage({ services: storage.services });
    await updateBadge();
  });
}

async function addCookieToService(domain: string, cookie: CookieInfo) {
  return queueStorageOperation(async () => {
    const storage = await getStorage();

    if (!storage.services[domain]) {
      storage.services[domain] = createDefaultService(domain);
    }

    const service = storage.services[domain];
    const exists = service.cookies.some((c) => c.name === cookie.name);
    if (!exists) {
      service.cookies.push(cookie);
    }

    await setStorage({ services: storage.services });
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
  tos: {
    found: boolean;
    url: string | null;
    method: string;
  };
}

async function handlePageAnalysis(analysis: PageAnalysis) {
  const { domain, login, privacy, tos, timestamp } = analysis;

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

  if (tos.found && tos.url) {
    await updateService(domain, { termsOfServiceUrl: tos.url });
    await addEvent({
      type: "terms_of_service_found",
      domain,
      timestamp,
      details: { url: tos.url, method: tos.method },
    });
  }
}

// ===== CSP Auditor Functions =====

let cspReporter: CSPReporter | null = null;
let reportQueue: CSPReport[] = [];

async function handleCSPViolation(
  data: Omit<CSPViolation, "type"> & { type?: string },
  sender: chrome.runtime.MessageSender
): Promise<{ success: boolean; reason?: string }> {
  const storage = await getStorage();
  const config = storage.cspConfig || DEFAULT_CSP_CONFIG;

  if (!config.enabled || !config.collectCSPViolations) {
    return { success: false, reason: "Disabled" };
  }

  const violation: CSPViolation = {
    type: "csp-violation",
    timestamp: data.timestamp || new Date().toISOString(),
    pageUrl: sender.tab?.url || data.pageUrl,
    directive: data.directive,
    blockedURL: data.blockedURL,
    domain: data.domain,
    disposition: data.disposition,
    originalPolicy: data.originalPolicy,
    sourceFile: data.sourceFile,
    lineNumber: data.lineNumber,
    columnNumber: data.columnNumber,
    statusCode: data.statusCode,
  };

  await storeCSPReport(violation);
  reportQueue.push(violation);

  await addEvent({
    type: "csp_violation",
    domain: violation.domain,
    timestamp: Date.now(),
    details: {
      directive: violation.directive,
      blockedURL: violation.blockedURL,
      disposition: violation.disposition,
    },
  });

  return { success: true };
}

async function handleNetworkRequest(
  data: Omit<NetworkRequest, "type"> & { type?: string },
  sender: chrome.runtime.MessageSender
): Promise<{ success: boolean; reason?: string }> {
  const storage = await getStorage();
  const config = storage.cspConfig || DEFAULT_CSP_CONFIG;

  if (!config.enabled || !config.collectNetworkRequests) {
    return { success: false, reason: "Disabled" };
  }

  const request: NetworkRequest = {
    type: "network-request",
    timestamp: data.timestamp || new Date().toISOString(),
    pageUrl: sender.tab?.url || data.pageUrl,
    url: data.url,
    method: data.method,
    initiator: data.initiator,
    domain: data.domain,
    resourceType: data.resourceType,
  };

  await storeCSPReport(request);
  reportQueue.push(request);

  return { success: true };
}

async function storeCSPReport(report: CSPReport) {
  try {
    if (report.type === "csp-violation") {
      const violation = report as CSPViolation;
      await DatabaseClient.insertCSPViolation([
        {
          timestamp: violation.timestamp,
          pageUrl: violation.pageUrl,
          directive: violation.directive,
          blockedUrl: violation.blockedURL,
          domain: violation.domain,
          disposition: violation.disposition,
          originalPolicy: violation.originalPolicy,
          sourceFile: violation.sourceFile,
          lineNumber: violation.lineNumber,
          columnNumber: violation.columnNumber,
          statusCode: violation.statusCode,
        },
      ]);
    } else if (report.type === "network-request") {
      const request = report as NetworkRequest;
      await DatabaseClient.insertNetworkRequest([
        {
          timestamp: request.timestamp,
          pageUrl: request.pageUrl,
          url: request.url,
          method: request.method,
          initiator: request.initiator,
          domain: request.domain,
          resourceType: request.resourceType,
        },
      ]);
    }
  } catch (error) {
    console.error("[Service Policy Auditor] Error storing to database:", error);
    // Fallback to chrome.storage
    await queueStorageOperation(async () => {
      const storage = await getStorage();
      const config = storage.cspConfig || DEFAULT_CSP_CONFIG;
      const maxReports = config.maxStoredReports;

      const cspReports = storage.cspReports || [];
      cspReports.push(report);

      if (cspReports.length > maxReports) {
        cspReports.splice(0, cspReports.length - maxReports);
      }

      await setStorage({ cspReports });
    });
  }
}

async function flushReportQueue() {
  if (!cspReporter || reportQueue.length === 0) return;

  const batch = reportQueue.splice(0, 100);
  const success = await cspReporter.send(batch);

  if (!success) {
    reportQueue.unshift(...batch);
  }
}

async function getCSPReports(options?: {
  type?: "csp-violation" | "network-request";
}): Promise<CSPReport[]> {
  try {
    if (options?.type === "csp-violation") {
      const violations = await DatabaseClient.getAllViolations();
      return violations.map((v) => ({
        type: "csp-violation" as const,
        timestamp: v.timestamp,
        pageUrl: v.pageUrl,
        directive: v.directive,
        blockedURL: v.blockedUrl,
        domain: v.domain,
        disposition: v.disposition,
        originalPolicy: v.originalPolicy,
        sourceFile: v.sourceFile,
        lineNumber: v.lineNumber,
        columnNumber: v.columnNumber,
        statusCode: v.statusCode,
      }));
    }
    if (options?.type === "network-request") {
      const requests = await DatabaseClient.getAllNetworkRequests();
      return requests.map((r) => ({
        type: "network-request" as const,
        timestamp: r.timestamp,
        pageUrl: r.pageUrl,
        url: r.url,
        method: r.method,
        initiator: r.initiator,
        domain: r.domain,
        resourceType: r.resourceType,
      }));
    }

    const [violations, requests] = await Promise.all([
      DatabaseClient.getAllViolations(),
      DatabaseClient.getAllNetworkRequests(),
    ]);

    const violationReports: CSPReport[] = violations.map((v) => ({
      type: "csp-violation" as const,
      timestamp: v.timestamp,
      pageUrl: v.pageUrl,
      directive: v.directive,
      blockedURL: v.blockedUrl,
      domain: v.domain,
      disposition: v.disposition,
      originalPolicy: v.originalPolicy,
      sourceFile: v.sourceFile,
      lineNumber: v.lineNumber,
      columnNumber: v.columnNumber,
      statusCode: v.statusCode,
    }));

    const requestReports: CSPReport[] = requests.map((r) => ({
      type: "network-request" as const,
      timestamp: r.timestamp,
      pageUrl: r.pageUrl,
      url: r.url,
      method: r.method,
      initiator: r.initiator,
      domain: r.domain,
      resourceType: r.resourceType,
    }));

    return [...violationReports, ...requestReports].sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
  } catch (error) {
    console.error("[Service Policy Auditor] Error getting CSP reports from database:", error);
    // Fallback to chrome.storage
    const storage = await getStorage();
    const cspReports = storage.cspReports || [];

    if (options?.type) {
      return cspReports.filter((r) => r.type === options.type);
    }
    return cspReports;
  }
}

async function generateCSPPolicy(
  options?: Partial<CSPGenerationOptions>
): Promise<GeneratedCSPPolicy> {
  const cspReports = await getCSPReports();
  const analyzer = new CSPAnalyzer(cspReports);
  return analyzer.generatePolicy({
    strictMode: options?.strictMode ?? false,
    includeReportUri: options?.includeReportUri ?? false,
    reportUri: options?.reportUri ?? "",
    defaultSrc: options?.defaultSrc ?? "'self'",
    includeNonce: options?.includeNonce ?? false,
  });
}

async function generateCSPPolicyByDomain(
  options?: Partial<CSPGenerationOptions>
): Promise<GeneratedCSPByDomain> {
  const cspReports = await getCSPReports();
  const analyzer = new CSPAnalyzer(cspReports);
  return analyzer.generatePolicyByDomain({
    strictMode: options?.strictMode ?? false,
    includeReportUri: options?.includeReportUri ?? false,
    reportUri: options?.reportUri ?? "",
    defaultSrc: options?.defaultSrc ?? "'self'",
    includeNonce: options?.includeNonce ?? false,
  });
}

async function getCSPConfig(): Promise<CSPConfig> {
  const storage = await getStorage();
  return storage.cspConfig || DEFAULT_CSP_CONFIG;
}

async function setCSPConfig(
  newConfig: Partial<CSPConfig>
): Promise<{ success: boolean }> {
  const current = await getCSPConfig();
  const updated = { ...current, ...newConfig };
  await setStorage({ cspConfig: updated });

  if (cspReporter) {
    const endpoint =
      updated.reportEndpoint ?? (import.meta.env.DEV ? DEV_REPORT_ENDPOINT : null);
    cspReporter.setEndpoint(endpoint);
  }

  return { success: true };
}

async function clearCSPData(): Promise<{ success: boolean }> {
  try {
    await DatabaseClient.clearAll();
    await clearCSPReports();
    reportQueue = [];
    return { success: true };
  } catch (error) {
    console.error("[Service Policy Auditor] Error clearing data:", error);
    return { success: false };
  }
}

function setupMessageHandlers() {
  const router = createMessageRouter();

  // Page analysis (fire-and-forget)
  router.register<PageAnalysis, void>("PAGE_ANALYZED", {
    handler: async (data) => {
      await handlePageAnalysis(data);
    },
    errorResponse: undefined,
    logPrefix: "page analysis",
  });

  // CSP handlers
  router.register("CSP_VIOLATION", {
    handler: handleCSPViolation,
    errorResponse: { success: false, reason: "Error" },
  });

  router.register("NETWORK_REQUEST", {
    handler: handleNetworkRequest,
    errorResponse: { success: false, reason: "Error" },
  });

  router.register("GET_CSP_REPORTS", {
    handler: async (data) => getCSPReports(data),
    errorResponse: [],
  });

  router.register("GENERATE_CSP", {
    handler: async (data: { options?: Partial<CSPGenerationOptions> } | undefined) =>
      generateCSPPolicy(data?.options),
    errorResponse: null,
  });

  router.register("GENERATE_CSP_BY_DOMAIN", {
    handler: async (data: { options?: Partial<CSPGenerationOptions> } | undefined) =>
      generateCSPPolicyByDomain(data?.options),
    errorResponse: null,
  });

  router.register("GET_CSP_CONFIG", {
    handler: async () => getCSPConfig(),
    errorResponse: DEFAULT_CSP_CONFIG,
  });

  router.register("SET_CSP_CONFIG", {
    handler: async (data) => setCSPConfig(data as Partial<CSPConfig>),
    errorResponse: { success: false },
  });

  router.register("CLEAR_CSP_DATA", {
    handler: async () => clearCSPData(),
    errorResponse: { success: false },
  });

  router.listen();
}

export default defineBackground(() => {
  // Initialize database on startup and run migration if needed
  DatabaseClient.init()
    .then(async () => {
      const needsMigration = await checkMigrationNeeded();
      if (needsMigration) {
        const result = await migrateToDatabase();
        if (result.success) {
          console.log(`[Service Policy Auditor] Migration completed: ${result.migratedCount} reports migrated`);
        }
      }
    })
    .catch((error) => {
      console.error("[Service Policy Auditor] Failed to initialize database:", error);
    });

  // Initialize CSP reporter on startup
  getCSPConfig().then((config) => {
    const endpoint =
      config.reportEndpoint ?? (import.meta.env.DEV ? DEV_REPORT_ENDPOINT : null);
    cspReporter = new CSPReporter(endpoint);
  });

  // Set up periodic flush for CSP reports
  chrome.alarms.create("flushCSPReports", { periodInMinutes: 0.5 });

  chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === "flushCSPReports") {
      fireAndForget(flushReportQueue(), "flushing CSP reports");
    }
  });

  setupMessageHandlers();

  startCookieMonitor();

  onCookieChange((cookie, removed) => {
    if (removed) return;

    const domain = cookie.domain.replace(/^\./, "");

    fireAndForget(addCookieToService(domain, cookie), "adding cookie");
    fireAndForget(
      addEvent({
        type: "cookie_set",
        domain,
        timestamp: cookie.detectedAt,
        details: {
          name: cookie.name,
          isSession: cookie.isSession,
        },
      }),
      "adding cookie event"
    );
  });

  updateBadge();

  console.log("[Service Policy Auditor] Background service worker started");
});
