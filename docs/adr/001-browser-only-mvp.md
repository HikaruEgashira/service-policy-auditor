# ADR-001: 端末完結型MVP

## Status
Accepted

## Context
CASBのようなサービス監視ツールを作りたい。サーバー連携（intelligence機能）も将来的に必要だが、まずは価値検証が必要。

## Decision
MVPは端末完結型のブラウザ拡張機能のみとする。

## Consequences
- サーバー不要で即座に利用開始可能
- 個人ユーザーに無料で価値提供
- プライバシーポリシー特定はローカル処理（URLパターン + リンクテキスト）
- 将来のサーバー連携のため`packages/core`に共通ロジックを分離
