export const DB_SCHEMA = `
CREATE TABLE IF NOT EXISTS csp_violations (
  id INTEGER PRIMARY KEY,
  timestamp TEXT NOT NULL,
  page_url TEXT NOT NULL,
  directive TEXT NOT NULL,
  blocked_url TEXT NOT NULL,
  domain TEXT NOT NULL,
  disposition TEXT,
  original_policy TEXT,
  source_file TEXT,
  line_number INTEGER,
  column_number INTEGER,
  status_code INTEGER
);

CREATE TABLE IF NOT EXISTS network_requests (
  id INTEGER PRIMARY KEY,
  timestamp TEXT NOT NULL,
  page_url TEXT NOT NULL,
  url TEXT NOT NULL,
  method TEXT NOT NULL,
  initiator TEXT NOT NULL,
  domain TEXT NOT NULL,
  resource_type TEXT
);

CREATE INDEX IF NOT EXISTS idx_violations_timestamp ON csp_violations(timestamp);
CREATE INDEX IF NOT EXISTS idx_violations_domain ON csp_violations(domain);
CREATE INDEX IF NOT EXISTS idx_requests_timestamp ON network_requests(timestamp);
CREATE INDEX IF NOT EXISTS idx_requests_domain ON network_requests(domain);
`;

export type DBMessageType =
  | "init"
  | "insert"
  | "query"
  | "clear"
  | "export"
  | "stats";

export interface DBMessage {
  id: string;
  type: DBMessageType;
  table?: "csp_violations" | "network_requests";
  data?: unknown[];
  sql?: string;
  params?: unknown[];
}

export interface DBResponse {
  id: string;
  success: boolean;
  data?: unknown;
  error?: string;
}
