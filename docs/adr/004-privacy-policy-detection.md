# ADR-004: プライバシーポリシー特定方法

## Status
Accepted

## Context
プライバシーポリシーのURLを自動特定する必要がある。方法は複数あり、コストと精度のトレードオフがある。

## Options
1. **URLパターンマッチング** - `/privacy`, `/privacy-policy`など
2. **リンクテキスト検索** - フッターの「プライバシーポリシー」リンク
3. **Well-known パス** - `/.well-known/privacy-policy`
4. **サーバーキャッシュ** - 同じドメインの結果を共有
5. **AI Agent** - LLMでページ解析

## Decision
MVPでは1→2の順で試行。端末完結のため3-5は将来対応。

```
1. URLパターンマッチ（即時）
2. フッターリンクテキスト検索（DOM走査）
3. ローカルストレージキャッシュ
```

## Consequences
- サーバー不要で動作
- 主要サイトの80-90%をカバー
- 検出できない場合はサービス情報のみ記録
- 将来のintelligence機能でAI Agent対応可能
