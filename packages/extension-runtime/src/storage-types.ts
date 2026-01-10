/**
 * @fileoverview Extension Storage Schema
 *
 * Chrome Storage APIを通じたデータ永続化のスキーマ定義。
 * CASBドメインとCSPドメインの両方のデータを統合して管理する。
 */

import type {
  DetectedService,
  EventLog,
  CapturedAIPrompt,
  AIMonitorConfig,
} from "@service-policy-auditor/detectors";
import type { CSPConfig, CSPReport } from "@service-policy-auditor/csp";

/**
 * ストレージスキーマ
 * - services: 検出済みサービスのレジストリ
 * - events: 監査ログ
 * - cspReports: CSP違反・ネットワークリクエスト
 * - cspConfig: CSP収集設定
 * - aiPrompts: AIプロンプト/レスポンス
 * - aiMonitorConfig: AIモニタリング設定
 */
export interface StorageData {
  services: Record<string, DetectedService>;
  events: EventLog[];
  cspReports?: CSPReport[];
  cspConfig?: CSPConfig;
  aiPrompts?: CapturedAIPrompt[];
  aiMonitorConfig?: AIMonitorConfig;
}

export type {
  DetectedService,
  EventLog,
  CSPConfig,
  CSPReport,
  CapturedAIPrompt,
  AIMonitorConfig,
};
