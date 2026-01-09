import type { DBMessage, DBResponse } from "./db-schema";
import type { CSPViolation, NetworkRequest } from "@service-policy-auditor/core";

let offscreenCreated = false;

async function ensureOffscreenDocument(): Promise<void> {
  if (offscreenCreated) return;

  const existingContexts = await chrome.runtime.getContexts({
    contextTypes: [chrome.runtime.ContextType.OFFSCREEN_DOCUMENT],
  });

  if (existingContexts.length > 0) {
    offscreenCreated = true;
    return;
  }

  await chrome.offscreen.createDocument({
    url: "offscreen/index.html",
    reasons: [chrome.offscreen.Reason.WORKERS],
    justification: "DuckDB WASM requires Web Worker for database operations",
  });

  offscreenCreated = true;
}

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

async function sendMessage(message: Omit<DBMessage, "id">): Promise<DBResponse> {
  await ensureOffscreenDocument();

  const fullMessage: DBMessage = {
    ...message,
    id: generateId(),
  };

  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(fullMessage, (response: DBResponse) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
      } else if (!response.success) {
        reject(new Error(response.error || "Unknown error"));
      } else {
        resolve(response);
      }
    });
  });
}

export const DatabaseClient = {
  async init(): Promise<void> {
    await sendMessage({ type: "init" });
  },

  async insertCSPViolation(violations: CSPViolation[]): Promise<void> {
    if (violations.length === 0) return;
    await sendMessage({
      type: "insert",
      table: "csp_violations",
      data: violations,
    });
  },

  async insertNetworkRequest(requests: NetworkRequest[]): Promise<void> {
    if (requests.length === 0) return;
    await sendMessage({
      type: "insert",
      table: "network_requests",
      data: requests,
    });
  },

  async getAllViolations(): Promise<CSPViolation[]> {
    const response = await sendMessage({
      type: "query",
      sql: `SELECT
        timestamp, page_url as pageUrl, directive, blocked_url as blockedUrl,
        domain, disposition, original_policy as originalPolicy,
        source_file as sourceFile, line_number as lineNumber,
        column_number as columnNumber, status_code as statusCode
        FROM csp_violations ORDER BY timestamp DESC`,
    });
    return (response.data as CSPViolation[]) || [];
  },

  async getAllNetworkRequests(): Promise<NetworkRequest[]> {
    const response = await sendMessage({
      type: "query",
      sql: `SELECT
        timestamp, page_url as pageUrl, url, method, initiator,
        domain, resource_type as resourceType
        FROM network_requests ORDER BY timestamp DESC`,
    });
    return (response.data as NetworkRequest[]) || [];
  },

  async getStats(): Promise<{
    violations: number;
    requests: number;
    uniqueDomains: number;
  }> {
    const response = await sendMessage({ type: "stats" });
    return response.data as {
      violations: number;
      requests: number;
      uniqueDomains: number;
    };
  },

  async clearAll(): Promise<void> {
    await sendMessage({ type: "clear" });
  },

  async query<T>(sql: string): Promise<T[]> {
    const response = await sendMessage({ type: "query", sql });
    return (response.data as T[]) || [];
  },
};
