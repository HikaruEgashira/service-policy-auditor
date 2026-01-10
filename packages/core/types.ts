// ============================================================================
// CASB Domain: SaaS Visibility (サービス可視性)
// ----------------------------------------------------------------------------
// Shadow ITの検出と可視化を担う。組織が把握していないSaaSサービスの利用を
// 検出し、リスク評価のための情報を収集する。
// ============================================================================

/**
 * 検出されたSaaSサービス
 * - domain: サービスの識別子（FQDN）
 * - hasLoginPage: 認証機能の有無（Shadow IT判定に使用）
 * - privacyPolicyUrl: コンプライアンス評価用
 * - termsOfServiceUrl: リスク評価用
 * - cookies: セッション追跡情報
 */
export interface DetectedService {
  domain: string;
  detectedAt: number;
  hasLoginPage: boolean;
  privacyPolicyUrl: string | null;
  termsOfServiceUrl: string | null;
  cookies: CookieInfo[];
}

/**
 * Cookie情報
 * - isSession: セッションCookieか否か（認証状態の追跡に使用）
 */
export interface CookieInfo {
  name: string;
  domain: string;
  detectedAt: number;
  isSession: boolean;
}

// ============================================================================
// CASB Domain: Event Sourcing (イベントソーシング)
// ----------------------------------------------------------------------------
// サービス利用に関するイベントを時系列で記録する。
// 監査ログ、コンプライアンスレポート、リスク分析の基盤となる。
// ============================================================================

/** ログイン検出イベントの詳細 */
export interface LoginDetectedDetails {
  hasLoginForm: boolean;
  hasPasswordInput: boolean;
  isLoginUrl: boolean;
  formAction: string | null;
}

/** プライバシーポリシー発見イベントの詳細 */
export interface PrivacyPolicyFoundDetails {
  url: string;
  method: string;
}

/** 利用規約発見イベントの詳細 */
export interface TosFoundDetails {
  url: string;
  method: string;
}

/** Cookie設定イベントの詳細 */
export interface CookieSetDetails {
  name: string;
  isSession: boolean;
}

/**
 * イベントログ基底型
 * - Discriminated Union パターンで型安全なイベント処理を実現
 */
export type EventLogBase<T extends string, D> = {
  id: string;
  type: T;
  domain: string;
  timestamp: number;
  details: D;
};

/**
 * CASBイベントログ
 * - login_detected: Shadow IT検出
 * - privacy_policy_found: コンプライアンス監視
 * - terms_of_service_found: リスク評価
 * - cookie_set: セッション追跡
 * - csp_violation: セキュリティ監査
 * - network_request: トラフィック分析
 */
export type EventLog =
  | EventLogBase<"login_detected", LoginDetectedDetails>
  | EventLogBase<"privacy_policy_found", PrivacyPolicyFoundDetails>
  | EventLogBase<"terms_of_service_found", TosFoundDetails>
  | EventLogBase<"cookie_set", CookieSetDetails>
  | EventLogBase<"csp_violation", CSPViolationDetails>
  | EventLogBase<"network_request", NetworkRequestDetails>;

export type EventLogType = EventLog["type"];

// ============================================================================
// CASB Domain: Persistence (永続化)
// ----------------------------------------------------------------------------
// Chrome Storage APIを通じたデータ永続化のスキーマ定義。
// ============================================================================

/**
 * ストレージスキーマ
 * - services: 検出済みサービスのレジストリ
 * - events: 監査ログ
 * - cspReports: CSP違反・ネットワークリクエスト
 * - cspConfig: CSP収集設定
 */
export interface StorageData {
  services: Record<string, DetectedService>;
  events: EventLog[];
  cspReports?: CSPReport[];
  cspConfig?: CSPConfig;
}

// ============================================================================
// SASE Domain: Security Audit (セキュリティ監査)
// ----------------------------------------------------------------------------
// Content Security Policy (CSP) の監査機能。
// - CSP違反の検出・記録
// - ネットワークリクエストの監視
// - セキュリティポリシーの自動生成と推奨
// ============================================================================

/**
 * CSP違反レポート
 * - ブラウザが検出したCSP違反イベントを記録
 * - disposition: enforce（ブロック）またはreport（レポートのみ）
 */
export interface CSPViolation {
  type: "csp-violation";
  timestamp: string;
  pageUrl: string;
  directive: string;
  blockedURL: string;
  domain: string;
  disposition: "enforce" | "report";
  originalPolicy?: string;
  sourceFile?: string;
  lineNumber?: number;
  columnNumber?: number;
  statusCode?: number;
}

/**
 * ネットワークリクエスト記録
 * - CSPポリシー生成のためのリクエスト情報
 * - initiator: リクエスト発生元の種別
 */
export interface NetworkRequest {
  type: "network-request";
  timestamp: string;
  pageUrl: string;
  url: string;
  method: string;
  initiator:
    | "fetch"
    | "xhr"
    | "websocket"
    | "beacon"
    | "script"
    | "img"
    | "style"
    | "frame"
    | "font"
    | "media";
  domain: string;
  resourceType?: string;
}

/** CSPレポート（違反 or ネットワークリクエスト） */
export type CSPReport = CSPViolation | NetworkRequest;

/**
 * 生成されたCSPポリシー
 * - policy: ディレクティブ → ソースリストのマップ
 * - policyString: HTTP ヘッダー形式の文字列
 * - recommendations: セキュリティ改善提案
 */
export interface GeneratedCSPPolicy {
  policy: Record<string, string[]>;
  policyString: string;
  statistics: CSPStatistics;
  recommendations: SecurityRecommendation[];
}

/** CSP統計情報 */
export interface CSPStatistics {
  totalReports: number;
  cspViolations: number;
  networkRequests: number;
  uniqueDomains: string[];
  byDirective: Record<string, number>;
  byDomain: Record<string, number>;
}

/**
 * セキュリティ推奨事項
 * - severity: リスクレベル（critical > high > medium > low）
 */
export interface SecurityRecommendation {
  severity: "critical" | "high" | "medium" | "low";
  directive: string;
  message: string;
  suggestion: string;
}

/** CSP収集設定 */
export interface CSPConfig {
  enabled: boolean;
  collectNetworkRequests: boolean;
  collectCSPViolations: boolean;
  reportEndpoint: string | null;
  maxStoredReports: number;
}

/** CSPポリシー生成オプション */
export interface CSPGenerationOptions {
  strictMode: boolean;
  includeNonce: boolean;
  includeReportUri: boolean;
  reportUri: string;
  defaultSrc: string;
}

/** CSP違反イベント詳細（EventLog用） */
export interface CSPViolationDetails {
  directive: string;
  blockedURL: string;
  disposition: "enforce" | "report";
}

/** ネットワークリクエストイベント詳細（EventLog用） */
export interface NetworkRequestDetails {
  url: string;
  method: string;
  initiator: string;
}
