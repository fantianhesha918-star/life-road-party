# ライフロード

人生ゲーム風のマルチプレイすごろくアプリ。盤面・カード・ルールはすべてオリジナル(市販の「人生ゲーム」の商標・盤面は使用していない)。

- 公開URL: https://fantianhesha918-star.github.io/life-road-party/
- 公開元フォルダ: `docs/`(GitHub Pages)
- ビルド不要。`docs/`配下を直接編集して`git push`すれば反映される。

## 現在の状態(フェーズ1: MVP)

- 一人モード(CPU対戦)のみ実装済み。友達との通信対戦(部屋番号での接続)は未実装(準備中)。
- Firebase等の外部サービスはまだ未連携(通信モード実装時に追加予定)。

## ファイル構成

- `docs/index.html` — エントリーポイント
- `docs/game-data.js` — オリジナルの盤面・イベントカード・職業データ
- `docs/game-engine.js` — ゲームルールのコアロジック(一人/通信共通で使う想定)
- `docs/cpu.js` — CPU対戦の意思決定ロジック
- `docs/ui.js` — 画面描画
- `docs/app.js` — 画面遷移・状態管理・localStorageオートセーブ
- `docs/manifest.json` / `docs/service-worker.js` / `docs/icons/` — PWA対応

## 今後の予定(フェーズ2以降)

- Firebase(Firestore + 匿名認証)を連携し、部屋番号での通信対戦を実装
- 株・保険などの追加ギミック、CPU AIの強化
