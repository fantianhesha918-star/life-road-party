# ライフロード

人生ゲーム風のマルチプレイすごろくアプリ。盤面・カード・ルールはすべてオリジナル(市販の「人生ゲーム」の商標・盤面は使用していない)。

- 公開URL: https://fantianhesha918-star.github.io/life-road-party/
- 公開元フォルダ: `docs/`(GitHub Pages)
- ビルド不要。`docs/`配下を直接編集して`git push`すれば反映される。
- Firebaseプロジェクト: `life-road-party`(Firestore + 匿名認証、リージョン`asia-northeast1`)

## 現在の状態(フェーズ2・3: 通信モード動作確認済み)

- 一人モード(CPU対戦)・通信モード(部屋番号で友達と接続)ともに動作確認済み。
- Firestoreセキュリティルール(`firestore.rules`)は、本番のFirebaseプロジェクトに対するREST APIテスト(部屋作成・参加・不正書き込み拒否・手番制御・ハートビートの8パターン)と、実機(スマホ2端末)での通信対戦の両方で動作確認済み(2026-08-03)。
- **TTLポリシー(部屋の自動削除)は見送り**: 403エラーの原因はプロジェクトの権限反映待ちではなく、「TTL機能の利用にはBlazeプラン(課金プラン、要クレジットカード登録)への切り替えが必須」という仕様だった。本プロジェクトは無料枠のみで運用する方針のため、Sparkプランのまま据え置き、TTLは設定しないことに決定(2026-08-03)。そのため`rooms`コレクションの部屋データは自動削除されず残り続けるが、1部屋あたりのデータ量が小さく友人数人規模の利用なので実質的な問題にはならない見込み。放置データが気になる場合は、Firestoreコンソールから手動で古い部屋を削除できる。

## ファイル構成

- `docs/index.html` — エントリーポイント
- `docs/game-data.js` — オリジナルの盤面・イベントカード・職業データ
- `docs/game-engine.js` — ゲームルールのコアロジック(一人/通信共通で使う)
- `docs/cpu.js` — CPU対戦の意思決定ロジック
- `docs/ui.js` — 画面描画
- `docs/app.js` — 画面遷移・状態管理・localStorageオートセーブ・通信モードの配線
- `docs/firebase-init.js` — Firebase SDK初期化・匿名認証(通信モード選択時に動的import)
- `docs/room.js` — Firestore読み書き(部屋作成/参加/購読/ハートビート、通信モード選択時に動的import)
- `firestore.rules` — Firestoreセキュリティルール(部屋単位アクセス制限・手番プレイヤーのみ書き込み可)
- `docs/manifest.json` / `docs/service-worker.js` / `docs/icons/` — PWA対応

## 今後の予定(フェーズ4・任意)

- 株・保険などの追加ギミック、CPU AIの性格プリセット
- 通信モードへのCPU枠混在、演出強化
