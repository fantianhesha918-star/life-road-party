# 3Dモデルの出典

盤面3D化(フェーズB検証)で使用している3Dモデルの出典を記録する。すべて大手が運営する定番サイトのみから調達する方針(2026-08-04確定)。

## animal-dog.glb

- 配布元: [Kenney.nl](https://kenney.nl/assets/cube-pets) — 「Cube Pets」パック
- ライセンス: CC0 1.0(クレジット表記は必須ではないが、素材の由来を残す目的でここに記録)
- 取得日: 2026-08-04
- 形式: glTF Binary(.glb)、Kenney公式配布のGLB形式をそのまま使用
- 同パックには犬・猫・うさぎ(bunny)・ビーバー(beaver、げっ歯類でチンチラの代替候補)も含まれており、フェーズB本格着手時の追加候補
- モデルは`idle`/`walk`/`run`等8種のアニメーションクリップを内包(ボーンによるスキニングではなく、body/脚4本のノードをそれぞれ動かす方式)。`docs/board3d.js`では`idle`(待機)と`walk`(移動)を再生している
- **要注意**: このGLBは色・柄の情報を`Textures/colormap.png`という外部テクスチャファイルに分離参照している(埋め込みではない)。`docs/models/Textures/colormap.png`として同梱必須(一度コピーし忘れて無地の見た目になった経緯あり、2026-08-04)

## chinchilla-gray.glb

- **2026-08-08にAPI経由マルチビュー版で作り直し済み(v2)**。旧バージョン(v1、無料プランのWeb UIで生成)は`chinchilla-gray_v1_backup.glb`として同フォルダに残してある(不要になれば削除可、ユーザー確認の上で)
- 生成元(v2): Meshy AI API、Multi-Image to 3D(`ai_model: meshy-6`、`enable_pbr: true`、`texture_resolution: 4k`、`should_remesh: true`、`target_polycount: 15000`)。参考イラストはGeminiで生成した正面・側面・背面の3枚(`docs/models/reference/chinchilla-gray/`)すべてを入力に使用。消費30クレジット
- ライセンス: Meshy Premiumプラン(2026-08-08課金)での生成物のため、有料プランの利用規約に基づき完全所有・クレジット表記不要
- 最終仕上げ: Blenderでテクスチャ解像度を1024に縮小・Draco圧縮・JPEG変換
- 最終仕様(v2): 15,618ポリゴン・370KB
- **旧v1の経緯(参考)**: 最初はMeshy無料プランのWeb UI(Image-to-3D、Meshy 5、正面画像のみ)で生成し689,686ポリゴン・33MBと過大だった。単純なBlender Decimateでは、Meshyのテクスチャが「複数視点写真を継ぎ接ぎしたアトラス画像」形式であることが原因でUV対応が崩れノイズが出る問題があり、Meshy公式の「Remesh」機能(Web UI、5クレジット)で解決した経緯がある。API化後はこの手動手順が不要になった
- **残り4種(フレンチブルドッグ2色・三毛猫・うさぎ)もAPI経由マルチビュー方式(Meshy 6・PBR・4K・should_remesh込み)で進める**

## chinchilla-white-pied.glb

- 生成元: Meshy AI API(Multi-Image to 3D、`ai_model: meshy-6`、`enable_pbr: true`、`texture_resolution: 4k`)。参考イラストはGeminiで生成した正面・側面・背面の3枚(`docs/models/reference/chinchilla-white-pied/`)すべてを入力に使用
- 取得日: 2026-08-08
- **2026-08-08よりMeshy Premiumプランに課金(ユーザー決定)**、API経由でクロコが直接生成〜ダウンロードまで自動化できるようになった(手順は[[api-key-renkei]]に沿ってAPIキーを`.secrets/meshy_api_key.txt`に安全に保管)
- 比較検証: 同時に単純版(Meshy 5・正面画像のみ、15クレジット)も生成して見比べた結果、**マルチビュー(3方向)+Meshy 6+PBRの方が参考イラストへの再現度(耳の黒色など)・質感(法線マップあり)ともに優れていた**(消費30クレジット)ため、こちらを採用
- API呼び出し1回の中で`should_remesh: true`・`target_polycount: 15000`を指定することで、生成とポリゴン削減を同時に実行できた(Web UIでの「生成→4候補選択→別途Remesh実行」という手動の複数手順が、API経由なら1回のリクエストで完結)
- 最終仕上げはchinchilla-gray.glbと同様、Blenderでテクスチャ解像度を1024に縮小・Draco圧縮・JPEG変換
- 最終仕様: 15,640ポリゴン・335KB
- **残り4種(フレンチブルドッグ2色・三毛猫・うさぎ)も、このAPI経由マルチビュー方式(Meshy 6・PBR・4K・should_remesh込み)を基本パターンとする**
