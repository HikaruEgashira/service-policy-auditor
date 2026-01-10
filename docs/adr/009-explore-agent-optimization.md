# ADR 009: Claude Code効率化ガイドライン

## Status

Accepted

## Context

Claude CodeのExplore Agentは`claude-haiku`モデルを使用し、コードベース探索を行う。効率的な開発体験のため、以下のガイドラインを定める。

## Decision

### 1. CLAUDE.mdの設計原則

**最小限に保つ**（目安: 20行以下、500バイト以下）

```markdown
# 良い例
- `packages/detectors/` - CASBドメイン（サービス検出）
- `packages/csp/` - CSP監査
詳細は各パッケージのindex.tsを参照。

# 悪い例（冗長）
| 機能 | ファイル | 説明 |
|------|---------|------|
| サービス可視性 | casb-types.ts | DetectedService, CookieInfo |
...（長いテーブル）
```

**理由**: CLAUDE.mdは全てのAgent呼び出しでコンテキストに含まれる。肥大化はトークン消費とレイテンシ増加の原因。

### 2. コード構造のベストプラクティス

#### index.tsでのre-export
```typescript
// 良い例: カテゴリコメント付きのre-export
// Types
export type { CSPViolation, NetworkRequest } from "./types.js";

// Analyzer
export { CSPAnalyzer } from "./analyzer.js";
```

#### DRY原則の徹底
```typescript
// 悪い例: 同じマッピングロジックの重複
return results[0].values.map((row) => {
  const obj: Record<string, unknown> = {}
  columns.forEach((col, i) => { obj[col] = row[i] })
  return { type: 'csp-violation', ... }  // 4箇所で重複
})

// 良い例: ヘルパー関数に抽出
function mapViolation(obj: Record<string, unknown>): CSPViolation { ... }
return values.map((row) => mapViolation(rowToObject(columns, row)))
```

### 3. AI Slop回避チェックリスト

新しいコードを書く際に確認:

- [ ] 過剰なコメントがないか（人間が書かないようなコメント）
- [ ] 不要な防御チェック/try-catchがないか
- [ ] 同じロジックが複数箇所にないか（DRY違反）
- [ ] ファイルの他の部分とスタイルが一貫しているか

### 4. Explore Agent呼び出しのコツ

| 方法 | 効果 |
|------|------|
| 具体的な質問 | 高速（10-15秒） |
| 広範な質問 | 低速（30秒以上） |
| `model: "sonnet"`指定 | 高精度だがコスト増 |

```typescript
// 良い例: 具体的
"LoginDetectionResult型の定義を教えてください"

// 悪い例: 広範
"このプロジェクトの構造を教えてください"
```

## Consequences

### 効果測定結果

| 指標 | Before | After | 改善率 |
|------|--------|-------|--------|
| CLAUDE.md | 61行 | 14行 | 83%削減 |
| 探索時間 | 33秒 | 13秒 | 60%削減 |
| ツール呼び出し | 28回 | 5回 | 82%削減 |

### 制約

- Explore Agentの内部動作は変更不可（Claude Code本体に組み込み）
- `SubagentStart`フックは未サポート（`SubagentStop`のみ利用可能）

## 関連

- [deslop skill](https://github.com/anthropics/claude-code-plugins) - AI生成コードの無駄を検出・削除
