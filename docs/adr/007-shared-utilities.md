# ADR 007: 共通ユーティリティ層の導入

## ステータス

Accepted

## コンテキスト

プロジェクトの成長に伴い、以下の問題が発生していた：

1. **コードの重複**: privacy-finder.tsとtos-finder.tsで同じ検出ロジックが重複（各140行以上）
2. **URL解析の散在**: `decodeUrlSafe`, `getPathFromUrl`が複数ファイルで重複定義
3. **メッセージハンドリングの冗長性**: background.tsで9つのハンドラーが同じパターンを繰り返し
4. **ストレージアクセスの型安全性**: 文字列リテラルによるキー指定、型推論の欠如

これらは機能追加時にアーキテクチャを崩す要因となり、技術的負債を増大させる。

## 決定

以下の共通ユーティリティ層を導入する：

### 1. packages/core/url-utils.ts
URL解析関数を一元管理：
- `decodeUrlSafe`: 安全なURLデコード
- `getPathFromUrl`: URLからパス抽出
- `resolveUrl`: 相対URL解決

### 2. packages/detectors/src/policy-finder-base.ts
ポリシー検出の共通ロジック：
- `createPolicyFinder`: 設定オブジェクトベースのfinder生成
- 検出手順（URL→link[rel]→JSON-LD→OG Meta→フッター→全リンク）を標準化

### 3. app/extension/utils/message-handler.ts
メッセージルーティング：
- `createMessageRouter`: ハンドラー登録とリスニングの一元化
- `fireAndForget`: 非同期エラーハンドリングの統一

### 4. app/extension/utils/storage.ts
型安全なストレージアクセス：
- `getStorage`, `setStorage`: 型付きストレージ操作
- `queueStorageOperation`: 競合防止のキューイング

## 結果

### メリット
- **拡張性向上**: 新しいポリシータイプの追加が設定オブジェクトのみで可能
- **コード削減**: privacy-finder.ts -86%, tos-finder.ts -78%
- **型安全性**: コンパイル時にエラーを検出可能
- **保守性**: 変更箇所の一元化

### トレードオフ
- ファイル数の増加（4ファイル追加）
- 抽象化による若干の学習コスト

## 関連ADR
- ADR 004: プライバシーポリシー検出
- ADR 006: 利用規約検出機能
