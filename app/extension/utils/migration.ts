import type { CSPReport, CSPViolation, NetworkRequest } from "@service-policy-auditor/core";
import { DatabaseClient } from "./db-client";

const MIGRATION_KEY = "duckdbMigrationCompleted";
const LEGACY_REPORTS_KEY = "cspReports";

export async function checkMigrationNeeded(): Promise<boolean> {
  const result = await chrome.storage.local.get([MIGRATION_KEY, LEGACY_REPORTS_KEY]);
  return !result[MIGRATION_KEY] && Array.isArray(result[LEGACY_REPORTS_KEY]) && result[LEGACY_REPORTS_KEY].length > 0;
}

export async function migrateToDatabase(): Promise<{ success: boolean; migratedCount: number }> {
  try {
    const result = await chrome.storage.local.get([MIGRATION_KEY, LEGACY_REPORTS_KEY]);

    if (result[MIGRATION_KEY]) {
      return { success: true, migratedCount: 0 };
    }

    const legacyReports: CSPReport[] = result[LEGACY_REPORTS_KEY] || [];

    if (legacyReports.length === 0) {
      await chrome.storage.local.set({ [MIGRATION_KEY]: true });
      return { success: true, migratedCount: 0 };
    }

    console.log(`[Migration] Starting migration of ${legacyReports.length} reports`);

    const violations: CSPViolation[] = [];
    const requests: NetworkRequest[] = [];

    for (const report of legacyReports) {
      if (report.type === "csp-violation") {
        violations.push(report as CSPViolation);
      } else if (report.type === "network-request") {
        requests.push(report as NetworkRequest);
      }
    }

    const BATCH_SIZE = 100;

    for (let i = 0; i < violations.length; i += BATCH_SIZE) {
      const batch = violations.slice(i, i + BATCH_SIZE);
      await DatabaseClient.insertCSPViolation(
        batch.map((v) => ({
          timestamp: v.timestamp,
          pageUrl: v.pageUrl,
          directive: v.directive,
          blockedUrl: v.blockedURL,
          domain: v.domain,
          disposition: v.disposition,
          originalPolicy: v.originalPolicy,
          sourceFile: v.sourceFile,
          lineNumber: v.lineNumber,
          columnNumber: v.columnNumber,
          statusCode: v.statusCode,
        }))
      );
    }

    for (let i = 0; i < requests.length; i += BATCH_SIZE) {
      const batch = requests.slice(i, i + BATCH_SIZE);
      await DatabaseClient.insertNetworkRequest(
        batch.map((r) => ({
          timestamp: r.timestamp,
          pageUrl: r.pageUrl,
          url: r.url,
          method: r.method,
          initiator: r.initiator,
          domain: r.domain,
          resourceType: r.resourceType,
        }))
      );
    }

    await chrome.storage.local.set({ [MIGRATION_KEY]: true });

    await chrome.storage.local.remove([LEGACY_REPORTS_KEY]);

    console.log(`[Migration] Successfully migrated ${legacyReports.length} reports`);

    return { success: true, migratedCount: legacyReports.length };
  } catch (error) {
    console.error("[Migration] Failed to migrate data:", error);
    return { success: false, migratedCount: 0 };
  }
}
