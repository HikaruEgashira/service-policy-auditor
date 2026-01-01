# ADR-003: 技術スタック

## Status
Accepted

## Context
Chrome拡張機能の開発に適した技術スタックを選定する必要がある。

## Decision
- **ブラウザ**: Chrome (Manifest V3)
- **言語**: TypeScript
- **ビルド**: Vite + CRXJS
- **UI**: Preact
- **構成**: pnpmモノレポ（app/ + packages/）

## Consequences
- Manifest V3は最新のChrome拡張規格で将来性がある
- Vite + CRXJSでHMR対応の快適な開発体験
- Preactは軽量（3KB）でPopup UIに最適
- モノレポ構成で将来のサーバー連携時にコード共有可能
