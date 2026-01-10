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

### 2. フォルダ構造の設計

**目的が明確な命名**
```
packages/
  detectors/     # 何を検出するか明確
  csp/           # Content Security Policy
app/
  extension/     # Chrome拡張
    entrypoints/ # WXT規約に従う
```

**避けるべき命名**
- `utils/`, `helpers/`, `common/` - 何でも入る曖昧なフォルダ
- `core/` - 範囲が不明確になりがち

### 3. ファイル粒度のガイドライン

**1ファイル1責務**
```
# 良い例
types.ts        # 型定義のみ
patterns.ts     # 正規表現パターンのみ
analyzer.ts     # CSPAnalyzerクラス

# 悪い例
index.ts        # 型定義 + ロジック + エクスポート全部
```

**index.tsの役割はre-exportのみ**
```typescript
// Types
export type { CSPViolation, NetworkRequest } from "./types.js";

// Analyzer
export { CSPAnalyzer } from "./analyzer.js";
```

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

### 5. DRY原則の徹底

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
