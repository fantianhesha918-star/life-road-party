# ライフロード

人生ゲーム風のマルチプレイすごろくアプリ。盤面・カード・ルールはすべてオリジナル(市販の「人生ゲーム」の商標・盤面は使用していない)。

- 公開URL: https://fantianhesha918-star.github.io/life-road-party/
- 公開元フォルダ: `docs/`(GitHub Pages)
- ビルド不要。`docs/`配下を直接編集して`git push`すれば反映される。

## 現在の状態(フェーズ2: Firebase未接続)

- 一人モード(CPU対戦)は動作する(フェーズ1で公開済み)。
- 通信モード(部屋番号で友達と接続)のコードは実装済みだが、**Firebaseプロジェクトが未作成のため未接続**。`docs/firebase-init.js`の`firebaseConfig`がプレースホルダーのままで、実際のFirebaseプロジェクトの値に差し替えるまで通信モードは動作しない。
- Firestoreセキュリティルールは`firestore.rules`に実装済み。手動でのロジックレビューと、Firestore非依存の変換ロジック(`roomToEngineState`/`engineStateToRoomPatch`)のシミュレーションテストは実施済みだが、**実際のFirestoreエミュレータでの動作検証は未実施**(このマシンにJavaが入っておらずエミュレータを起動できなかったため)。実機・実プロジェクトでの動作確認が必要。

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

## Firebaseセットアップ手順(未実施・要作業)

1. https://console.firebase.google.com/ でGoogleアカウントを使い新規プロジェクトを作成する。
2. Firestore Database を有効化(本番モード、リージョンは`asia-northeast1`推奨)。
3. Authentication > Sign-in method で「匿名」を有効化する。
4. Firestore > ルール で`firestore.rules`の内容を貼り付けて公開する。
5. Firestore > TTL で`rooms`コレクション・`expireAt`フィールドを対象にTTLポリシーを設定する(放置された部屋を自動削除するため)。
6. プロジェクト設定 > 全般 からWebアプリを追加し、`firebaseConfig`の値を`docs/firebase-init.js`の該当箇所に貼り付ける。
7. `~/OneDrive/Desktop/クロードコード/API連携リスト.md`にFirebase連携を追記する。

## 今後の予定

- 上記Firebaseセットアップ完了後、実機2台以上での通信対戦の動作確認
- 株・保険などの追加ギミック、CPU AIの強化(フェーズ4)
