import initSqlJs, { type Database } from "sql.js";
import { DB_SCHEMA } from "../../utils/db-schema";
import type { DBMessage, DBResponse } from "../../utils/db-schema";

let db: Database | null = null;

async function initDatabase(): Promise<void> {
  if (db) return;

  const SQL = await initSqlJs({
    locateFile: () => chrome.runtime.getURL("sql-wasm.wasm"),
  });

  db = new SQL.Database();

  db.run(DB_SCHEMA);

  console.log("[SQLite] Initialized successfully");
}

function escapeSQL(str: string): string {
  return str.replace(/'/g, "''");
}

async function insertCSPViolation(data: unknown[]): Promise<void> {
  if (!db) throw new Error("Database not initialized");

  for (const item of data) {
    const v = item as {
      timestamp: string;
      pageUrl: string;
      directive: string;
      blockedUrl: string;
      domain: string;
      disposition?: string;
      originalPolicy?: string;
      sourceFile?: string;
      lineNumber?: number;
      columnNumber?: number;
      statusCode?: number;
    };

    db.run(
      `INSERT INTO csp_violations (
        timestamp, page_url, directive, blocked_url, domain,
        disposition, original_policy, source_file, line_number, column_number, status_code
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        v.timestamp,
        v.pageUrl,
        v.directive,
        v.blockedUrl,
        v.domain,
        v.disposition ?? null,
        v.originalPolicy ?? null,
        v.sourceFile ?? null,
        v.lineNumber ?? null,
        v.columnNumber ?? null,
        v.statusCode ?? null,
      ]
    );
  }
}

async function insertNetworkRequest(data: unknown[]): Promise<void> {
  if (!db) throw new Error("Database not initialized");

  for (const item of data) {
    const r = item as {
      timestamp: string;
      pageUrl: string;
      url: string;
      method: string;
      initiator: string;
      domain: string;
      resourceType?: string;
    };

    db.run(
      `INSERT INTO network_requests (
        timestamp, page_url, url, method, initiator, domain, resource_type
      ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        r.timestamp,
        r.pageUrl,
        r.url,
        r.method,
        r.initiator,
        r.domain,
        r.resourceType ?? null,
      ]
    );
  }
}

function executeQuery(sql: string): unknown[] {
  if (!db) throw new Error("Database not initialized");

  const result = db.exec(sql);
  if (result.length === 0) return [];

  const columns = result[0].columns;
  return result[0].values.map((row) => {
    const obj: Record<string, unknown> = {};
    columns.forEach((col, idx) => {
      obj[col] = row[idx];
    });
    return obj;
  });
}

function clearAllData(): void {
  if (!db) throw new Error("Database not initialized");

  db.run("DELETE FROM csp_violations");
  db.run("DELETE FROM network_requests");
}

function getStats(): {
  violations: number;
  requests: number;
  uniqueDomains: number;
} {
  if (!db) throw new Error("Database not initialized");

  const violationsResult = db.exec(
    "SELECT COUNT(*) as count FROM csp_violations"
  );
  const requestsResult = db.exec(
    "SELECT COUNT(*) as count FROM network_requests"
  );
  const domainsResult = db.exec(`
    SELECT COUNT(DISTINCT domain) as count FROM (
      SELECT domain FROM csp_violations
      UNION
      SELECT domain FROM network_requests
    )
  `);

  return {
    violations: Number(violationsResult[0]?.values[0]?.[0] ?? 0),
    requests: Number(requestsResult[0]?.values[0]?.[0] ?? 0),
    uniqueDomains: Number(domainsResult[0]?.values[0]?.[0] ?? 0),
  };
}

async function handleMessage(message: DBMessage): Promise<DBResponse> {
  try {
    switch (message.type) {
      case "init":
        await initDatabase();
        return { id: message.id, success: true };

      case "insert":
        if (message.table === "csp_violations") {
          await insertCSPViolation(message.data || []);
        } else if (message.table === "network_requests") {
          await insertNetworkRequest(message.data || []);
        }
        return { id: message.id, success: true };

      case "query":
        const queryResult = executeQuery(message.sql || "");
        return { id: message.id, success: true, data: queryResult };

      case "clear":
        clearAllData();
        return { id: message.id, success: true };

      case "stats":
        const stats = getStats();
        return { id: message.id, success: true, data: stats };

      default:
        return {
          id: message.id,
          success: false,
          error: `Unknown message type: ${message.type}`,
        };
    }
  } catch (error) {
    return {
      id: message.id,
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

chrome.runtime.onMessage.addListener(
  (message: DBMessage, _sender, sendResponse) => {
    if (!message.type) return false;

    handleMessage(message)
      .then(sendResponse)
      .catch((error) => {
        sendResponse({
          id: message.id,
          success: false,
          error: error instanceof Error ? error.message : String(error),
        });
      });

    return true;
  }
);

initDatabase().catch(console.error);
