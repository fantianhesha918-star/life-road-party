# 3Dモデルの出典

盤面3D化(フェーズB検証)で使用している3Dモデルの出典を記録する。すべて大手が運営する定番サイトのみから調達する方針(2026-08-04確定)。

**注意(2026-08-10)**: このファイル内の「バウンディングボックス」「Y幅」等の記述は、クロコ(Codex連携チャット)がBlenderまたはGLBのaccessor min/maxをオフラインで読んだ簡易チェックの値であり、glTFノードのtransform(回転等)を考慮できていないため軸の対応がファイルごとにずれる場合がある。**スケール・配置の最終確認は、進行用チャットが実施するThree.js(Box3)での実機実測を優先すること。**

## animal-dog.glb

- 配布元: [Kenney.nl](https://kenney.nl/assets/cube-pets) — 「Cube Pets」パック
- ライセンス: CC0 1.0(クレジット表記は必須ではないが、素材の由来を残す目的でここに記録)
- 取得日: 2026-08-04
- 形式: glTF Binary(.glb)、Kenney公式配布のGLB形式をそのまま使用
- 同パックには犬・猫・うさぎ(bunny)・ビーバー(beaver、げっ歯類でチンチラの代替候補)も含まれており、フェーズB本格着手時の追加候補
- モデルは`idle`/`walk`/`run`等8種のアニメーションクリップを内包(ボーンによるスキニングではなく、body/脚4本のノードをそれぞれ動かす方式)。`docs/board3d.js`では`idle`(待機)と`walk`(移動)を再生している
- **要注意**: このGLBは色・柄の情報を`Textures/colormap.png`という外部テクスチャファイルに分離参照している(埋め込みではない)。`docs/models/Textures/colormap.png`として同梱必須(一度コピーし忘れて無地の見た目になった経緯あり、2026-08-04)

## chinchilla-gray.glb

- **2026-08-09にクオリティ向上のため作り直し済み(v3)**。ユーザーから「しっぽの質感・顔の可愛さをホワイトパイド相当に近づけたい」との要望を受け、参考イラストは変えずMeshy AIでの3D変換のみ再実行。旧バージョン(v2)は`chinchilla-gray_v2_backup.glb`、さらに旧v1は`chinchilla-gray_v1_backup.glb`として同フォルダに残してある(不要になれば削除可、ユーザー確認の上で)
- 経緯: 同一参考イラスト・同一設定のままMeshyで2回再生成して比較。1回目(v3候補)はしっぽに意図しない縞模様アーティファクトが出たため不採用、2回目(採用版)でしっぽの毛量・ボリュームともに改善しアーティファクトも無かったため採用
- 生成元(v3): Meshy AI API、Multi-Image to 3D(`ai_model: meshy-6`、`enable_pbr: true`、`texture_resolution: 4k`、`should_remesh: true`、`topology: triangle`、`target_polycount: 15000`)。参考イラストはGeminiで生成した正面・側面・背面の3枚(`docs/models/reference/chinchilla-gray/`、変更なし)を使用。比較のための1回を含め計60クレジット消費
- ライセンス: Meshy Premiumプランでの生成物のため、有料プランの利用規約に基づき完全所有・クレジット表記不要
- 最終仕上げ: Blenderでテクスチャ解像度を1024に縮小・Draco圧縮・JPEG変換(従来と同じパイプライン)
- 最終仕様(v3): 15,637ポリゴン・346KB、バウンディングボックスY幅1.899(旧バージョンとほぼ一致、CHARACTER_SCALE等の変更は不要な見込み)
- **旧v1の経緯(参考)**: 最初はMeshy無料プランのWeb UI(Image-to-3D、Meshy 5、正面画像のみ)で生成し689,686ポリゴン・33MBと過大だった。単純なBlender Decimateでは、Meshyのテクスチャが「複数視点写真を継ぎ接ぎしたアトラス画像」形式であることが原因でUV対応が崩れノイズが出る問題があり、Meshy公式の「Remesh」機能(Web UI、5クレジット)で解決した経緯がある。API化後はこの手動手順が不要になった
- **2026-08-11、進行用チャット側で`docs/board3d.js`に反映・commit済み**。Three.js Box3実機実測(Y軸=1.468、min.y=-0.734)の結果、旧scale(0.47)のままだと表示後の高さ(≈0.69)が他5種の基準(≈0.89)より約2割低く、地面から少し浮いて見える状態だった(v2→v3差し替え時にscaleを再計算していなかったバグ)。scaleを0.606に修正し、他種と揃う表示高さにした(yOffsetは0.445のまま変更不要)。

## chinchilla-white-pied.glb

- 生成元: Meshy AI API(Multi-Image to 3D、`ai_model: meshy-6`、`enable_pbr: true`、`texture_resolution: 4k`)。参考イラストはGeminiで生成した正面・側面・背面の3枚(`docs/models/reference/chinchilla-white-pied/`)すべてを入力に使用
- 取得日: 2026-08-08
- **2026-08-08よりMeshy Premiumプランに課金(ユーザー決定)**、API経由でクロコが直接生成〜ダウンロードまで自動化できるようになった(手順は[[api-key-renkei]]に沿ってAPIキーを`.secrets/meshy_api_key.txt`に安全に保管)
- 比較検証: 同時に単純版(Meshy 5・正面画像のみ、15クレジット)も生成して見比べた結果、**マルチビュー(3方向)+Meshy 6+PBRの方が参考イラストへの再現度(耳の黒色など)・質感(法線マップあり)ともに優れていた**(消費30クレジット)ため、こちらを採用
- API呼び出し1回の中で`should_remesh: true`・`target_polycount: 15000`を指定することで、生成とポリゴン削減を同時に実行できた(Web UIでの「生成→4候補選択→別途Remesh実行」という手動の複数手順が、API経由なら1回のリクエストで完結)
- 最終仕上げはchinchilla-gray.glbと同様、Blenderでテクスチャ解像度を1024に縮小・Draco圧縮・JPEG変換
- 最終仕様: 15,640ポリゴン・335KB
- **残り4種(フレンチブルドッグ2色・三毛猫・うさぎ)も、このAPI経由マルチビュー方式(Meshy 6・PBR・4K・should_remesh込み)を基本パターンとする**

## building-house.glb / building-shop.glb / tree-round.glb / tree-conifer.glb(ステージ装飾)

- 2026-08-09、盤面3D化のステージ装飾(建造物・木)第一弾として作成。キャラクターと違い**コスト節約のためMeshy 5・単一画像・PBR無効**のシンプル版パイプラインを採用し、その分バリエーションを増やす方針
- 参考イラスト: Codexが作成(`クロコとcodex受け渡し\素材受け渡し\02_Codex作成素材\アニマルライフ_ステージ建物木イラスト_2026-08-09\`)。白背景・フェルト調の「ジオラマのミニチュア」テイスト、斜め45度(3/4)アングルの1枚絵
- 生成: Meshy AI API Image-to-3D(`ai_model: meshy-5`、`should_remesh: true`、`enable_pbr: false`、`target_polycount`は建物12,000・木6,000)
- 最終仕上げ: Blenderでテクスチャ解像度を1024に縮小・Draco圧縮・JPEG変換(チンチラと同じ手順)
- 最終ファイルサイズ: building-house 209KB、building-shop 209KB、tree-round 145KB、tree-conifer 140KB
- `docs/board3d.js`の`STAGE_PROP_MODELS`にscale/yOffsetを設定して読み込み。木は`round`/`conifer`をランダムに混ぜて配置している
- 次回以降、公園・遊園地・水族館・動物園・橋、ビル・マンション・飲食店・駅などを同じ簡易パイプラインで追加予定(依頼書は同フォルダの`追加依頼_2026-08-09.md`)

## building-office.glb / building-apartment.glb / building-restaurant.glb / building-station.glb / building-school.glb / building-hospital.glb / facility-park.glb / facility-amusement-park.glb / facility-aquarium.glb / facility-zoo.glb / facility-farm.glb / facility-bridge.glb(ステージ装飾・第二弾)

- 2026-08-09、`追加依頼_2026-08-09.md`でCodexに依頼した施設5種・建物4種・追加候補3種(学校・病院・牧場)の計12点を受け取り、第一弾(house/shop/tree)と同じMeshy 5(単一画像・`should_remesh: true`・`enable_pbr: false`)パイプラインで3Dモデル化
- 参考イラストの保存先は第一弾と同じ`クロコとcodex受け渡し\素材受け渡し\02_Codex作成素材\アニマルライフ_ステージ建物木イラスト_2026-08-09\`
- `target_polycount`: ランドマーク施設(公園・遊園地・水族館・動物園)15,000、橋10,000、建物12,000
- scale/yOffsetはBlenderで実測したバウンディングボックス(原点が中心)を基準に、各建物のシルエット(縦長/横長)と役割(オフィスビルは高く、公園は低く広く、遊園地はランドマークとして一番大きく、など)に応じて個別に調整
- 最終仕上げ(テクスチャ1024縮小・Draco圧縮・JPEG変換)は第一弾と同じ手順
- `docs/board3d.js`の`STAGE_PROP_LAYOUT`に配置済み(9つの隙間×南北2方向=18枠に、建物8種・施設5種(公園/遊園地/水族館/動物園/牧場)・木5本を配置)
- `facility-bridge.glb`のみ**未配置**。将来「パスが折れ曲がり、橋の上にすごろくマスを置く」機能を実装する際に使う想定(上面を平らに保つよう依頼済み)

## dog-frenchie-white.glb

- 2026-08-09、残り4種(フレンチブルドッグ2色・三毛猫・うさぎ)の第一弾として作成(`species-dog-frenchie-white`に対応)
- 参考イラスト: Gemini生成の正面・側面・背面ターンアラウンド(`クロコ確認フォルダ\アプリ素材\Gemini_Generated_Image_ (3).png`)をPythonで自動トリミングし`docs/models/reference/dog-frenchie-white/`に保存
- 生成: Meshy AI API Multi-Image to 3D(`ai_model: meshy-6`、`enable_pbr: true`、`texture_resolution: 4k`、`should_remesh: true`、`target_polycount: 15000`)。チンチラ2種と同じマルチビュー方式
- 最終仕上げ: Blenderでテクスチャ解像度を1024に縮小(4096/2048→1024)・Draco圧縮・JPEG変換
- 最終仕様: 15,634ポリゴン(11,182頂点)・268KB
- バウンディングボックス(原点中心、Blender座標): X幅0.81 / Y幅1.90 / Z幅1.40(board3d.js組み込み時のCHARACTER_SCALE/Y_OFFSET算出に使用)
- **このモデルはCodex連携チャット側で並行生成した**([[heikou-chat-renkei]]運用下、`life-road-party/作業状況.md`参照)。
- **2026-08-09、進行用チャット側で`docs/board3d.js`のSPECIES_MODEL_MAPに組み込み済み**(scale 0.635/yOffset 0.445、Three.jsのBox3で実測)。
- **表示が単色の塊に見える件は解決済み**: GLB自体は正常(metallicRoughnessが赤橙に見えるのはglTF仕様上問題なし)。原因は`docs/app.js`側でspeciesId欠落時のプレースホルダー固定化だったため、モデル側の修正は不要だった(詳細は`life-road-party/作業状況.md`参照)

## dog-frenchie-black.glb / cat-calico.glb / rabbit-white.glb

- 2026-08-09、残り4種の第二弾としてCodex連携チャット側で3体同時に作成(`species-dog-frenchie-black`/`species-cat-calico`/`species-rabbit-white`に対応)。これで6種全モデルが揃った
- 参考イラスト: Gemini生成の正面・側面・背面ターンアラウンド(`クロコ確認フォルダ\アプリ素材\Gemini_Generated_Image_ (2).png`=黒フレンチブルドッグ、`(4).png`=三毛猫、`(1).png`=うさぎ)をPythonで自動トリミングし`docs/models/reference/<種名>/`に保存
- 生成: dog-frenchie-white.glbと同じMeshy AI API Multi-Image to 3D(`ai_model: meshy-6`、`enable_pbr: true`、`texture_resolution: 4k`、`should_remesh: true`、`target_polycount: 15000`)、3体を並行リクエストして時間短縮
- 最終仕上げ: Blenderでテクスチャ解像度を1024に縮小・Draco圧縮・JPEG変換(同一パイプライン)
- 最終仕様: dog-frenchie-black 15,611ポリゴン・344KB / cat-calico 15,618ポリゴン・292KB / rabbit-white 15,652ポリゴン・326KB
- バウンディングボックス(CHARACTER_SCALE/Y_OFFSET算出用)はこの時点では未計測だったが、**2026-08-09に進行用チャット側でThree.js(Box3)実測の上、`docs/board3d.js`のSPECIES_MODEL_MAPに組み込み済み**(dog-frenchie-black: scale 0.624、cat-calico: scale 0.635、rabbit-white: scale 0.469、いずれもyOffset 0.445)。あわせてchinchilla-white-piedのyOffsetも近似値から実測値(scale 0.598)に更新した。
- **表示が単色の塊に見える件は解決済み**(dog-frenchie-whiteと同じ原因・同じ修正、詳細は`life-road-party/作業状況.md`参照)
- **2026-08-10、うさぎを座りポーズに作り直し**: ユーザーがGeminiで新規作成した「座っているうさぎ」の正面・側面・背面ターンアラウンド(`クロコ確認フォルダ\アプリ素材\Gemini_Generated_Image_a9x57ja9x57ja9x5.png`、1枚の合成画像をPythonで3枚に自動トリミング)を`docs/models/reference/rabbit-white/`に上書きし、同じMeshy AI API Multi-Image to 3Dパイプラインで再生成。配色・キャラクターは従来の立ちポーズ版と同一(グレー系の毛色・ブルーの瞳)。
- 最終仕様(座りポーズ版): 15,571ポリゴン・324KB
- **バウンディングボックス確認(glTF Y-up、実ファイルのaccessor min/maxを直接読んで確認)**: 旧立ちポーズ版のY幅(高さ)1.899に対し、新座りポーズ版もY幅1.899でほぼ完全一致。X幅(0.69→1.05)・Z幅(0.85→1.59)は座りポーズ特有の横幅・奥行き増加分で、想定通り。**`board3d.js`のCHARACTER_SCALE(0.469)・yOffset(0.445)は変更不要な見込み**、ただし念のため進行用チャット側で実機確認を推奨。
- 旧立ちポーズ版のモデル・参考イラストはユーザー指示によりゴミ箱へ移動済み(完全削除ではない)。

- **2026-08-10、三毛猫を新デザインに作り直し**: ユーザーがクロコ確認フォルダに新規Gemini画像(丸っこいトイフィギュア調から、よりリアルな質感の座り猫・正面/側面/背面ターンアラウンド、1枚の合成画像)を投入、それを使って作り直した。合成画像は背景色を四隅から推定してPythonで自動的に3枚(front/side/back)に切り分け(`docs/models/reference/cat-calico/`を上書き)。
- 同じMeshy AI API Multi-Image to 3Dパイプライン(`ai_model: meshy-6`、`enable_pbr: true`、`texture_resolution: 4k`、`should_remesh: true`、`target_polycount: 15000`)で再生成、Blenderで同一の最終仕上げ(1024縮小・Draco圧縮・JPEG変換)。最終仕様: 12,682頂点・396KB。
- **バウンディングボックスがX/Y/Zとも大きく変化**(旧: X1.07/Y1.40/Z1.90 → 新: X0.98/Y1.90/Z1.77、glTFファイルのaccessor min/maxを直接読んで確認)。旧デザインは丸く縮こまった体型、新デザインは背筋を伸ばして座る細身の体型のため、実際の見た目の高さが変わった。**このため`docs/board3d.js`の`SPECIES_MODEL_MAP`のscaleを0.635→0.469に変更**(表示後の高さが他種と揃うよう、旧cat-calicoの表示高さ(scale×Y幅=0.890)を基準に逆算)。yOffsetは0.445のまま変更不要(新モデルもバウンディングボックス中心がほぼ原点のため)。
- 実機相当のPlaywright確認(スタンドアロンレンダリングと実際のゲーム画面の両方)で、地面への接地・他キャラクターとの縮尺バランスとも問題ないことを確認済み。
- 旧バージョン(モデル・参考イラスト)はユーザー指示によりゴミ箱へ移動予定(完全削除ではない)。

## masu-base.glb / prop-streetlamp.glb / prop-bench.glb / prop-signboard.glb / gate-start.glb / gate-goal.glb / cloud-puffy.glb

- 2026-08-09、Codex連携チャット側でマップ装飾素材7点を3Dモデル化。参考イラストはCodex作成(`クロコとcodex受け渡し\素材受け渡し\02_Codex作成素材\`直下および`アニマルライフ_道沿い小物とゲート雲_2026-08-09\`配下)
- 生成: 建物・施設と同じ簡易パイプライン(Meshy AI API Image-to-3D、`ai_model: meshy-5`、単一画像、`should_remesh: true`、`enable_pbr: false`)。7点を並行リクエストして時間短縮
- `target_polycount`: masu-base 5,000/prop-streetlamp 6,000/prop-bench 8,000/prop-signboard 6,000/gate-start 10,000/gate-goal 12,000/cloud-puffy 6,000(サイズ・複雑さに応じて個別設定)
- 最終仕上げ: テクスチャ解像度1024縮小・Draco圧縮・JPEG変換(同一パイプライン)
- 最終ファイルサイズ: masu-base 58KB/prop-streetlamp 116KB/prop-bench 176KB/prop-signboard 134KB/gate-start 148KB/gate-goal 172KB/cloud-puffy 50KB
- **masu-base.glbは無地(白〜クリーム色)のまま**。マスの種類(8種)ごとの色分けは`board3d.js`組み込み時にマテリアル色を上書きする実装が必要(2D版`style.css`の配色を参照)
- **2026-08-09、進行用チャット側で`docs/board3d.js`に組み込み済み**:
  - masu-base: 1回だけ読み込みマス数分クローンし、`app.js`から渡るBOARD_SQUARESの種類ごとにマテリアル色を上書き(旧`.cell-*`の配色を流用)
  - prop-streetlamp/prop-bench/prop-signboard: `buildStagePropLayout`の各隙間に、建物より道に近い位置へ巡回配置
  - gate-start/gate-goal: 盤面の最初/最後のマスに、道を横切る向きで設置
  - cloud-puffy: 盤面の長さに応じた数を空に散りばめて配置(接地なし)

## sky-backdrop.jpg / ground-grass.jpg / road-path.jpg(背景・地面・道)

- 2026-08-09、Codex連携チャット側で作成した背景イラスト3点(`sky-backdrop.png`1920×1080・`ground-grass.png`/`road-path.png`各1024×1024のタイル可能テクスチャ)を、進行用チャット側でモバイル配信用に軽量化(sky-backdropは1280×720のJPEGに、ground-grass/road-pathは512×512のJPEGに変換)して`docs/images/`へ配置
- `docs/board3d.js`に組み込み済み: sky-backdropは`scene.background`、ground-grassは地面平面のタイル敷きテクスチャ、road-pathはマス中心を結ぶリボン状メッシュ(`createRoadRibbon`)のテクスチャとして使用

## telop-frame.png / roulette-dial.png(UI装飾)

- 2026-08-09、Codex連携チャット側で作成(`アニマルライフ_UI装飾素材_2026-08-09\`)。進行用チャット側で軽量化して`docs/images/`へ配置し、`docs/style.css`/`docs/ui.js`に組み込み済み
- roulette-dial.pngは`.roulette-wheel`の背景画像として使用(旧CSSグラデーションから差し替え)
- telop-frame.pngは選択モーダル(`renderChoiceModal`)のタイトル+説明文を囲む`.modal-telop`の背景として使用

## human-male.glb / human-female.glb

- 2026-08-09、Codex連携チャット側で人間キャラクター(男性・女性)を作成。プレイヤーが選べるキャラクター種として動物6種に加える想定
- 参考イラスト: Codex作成の正面・側面・背面ターンアラウンド(`クロコとcodex受け渡し\素材受け渡し\02_Codex作成素材\アニマルライフ_人間キャラクターイラスト_2026-08-09\`)。無地の普段着(帽子・アクセサリーなし)、3方向ともポーズ・カメラ距離が統一されておりMulti-Image入力に適した仕上がりだった
- 生成: 動物6種と同じMeshy AI API Multi-Image to 3D(`ai_model: meshy-6`、`enable_pbr: true`、`texture_resolution: 4k`、`should_remesh: true`、`target_polycount: 15000`)
- 最終仕上げ: テクスチャ解像度1024縮小・Draco圧縮・JPEG変換(同一パイプライン)
- 最終ファイルサイズ: human-male 384KB、human-female 369KB(他キャラクターと同水準)
- バウンディングボックス(Blender座標、原点中心): human-male X幅0.80/Y幅0.62/Z幅1.90、human-female X幅0.79/Y幅0.73/Z幅1.90(board3d.js組み込み時のCHARACTER_SCALE/Y_OFFSET算出用)
- **2026-08-11、進行用チャット側で組み込み完了**: `shop-data.js`のSPECIES_ITEMSに`species-human-male`/`species-human-female`(価格0、既存6種と同じ無料枠)を追加。`docs/board3d.js`のSPECIES_MODEL_MAPにもThree.js Box3実測(human-male: Y軸1.898/min.y -0.951、human-female: Y軸1.899/min.y -0.950)から算出したscale 0.469・yOffset 0.446を設定し、他6種と表示後の高さ(≈0.89)が揃うようにした。アバターバッジ(`docs/avatars/human-male.png`/`human-female.png`)は、上記front参考イラストから四隅を背景色として検出し透明化(既存のコスチュームバッジと同じ手法)して新規生成した。トイフィギュア調のイラストのまま統合しており、動物6種のリアル路線の見た目とは意図的にテイストが異なる(ユーザー了承済み、2026-08-11)。

## costume-kimono_chinchilla-gray.glb

- 2026-08-09、コスチューム(全身衣装)システムの試作第一弾。「チンチラ(グレー)が着物を着た状態」を丸ごと1体のモデルとして作成(頭・体を分離せず、着せ替え時はモデルまるごと差し替える方式で確定済み)
- 参考イラスト: 既存の`chinchilla-gray`参考イラスト(3方向)をCodexに渡し、**全く同じポーズ・カメラ距離・体型のまま着物(紺地に和柄、赤茶の帯)を着せた**3方向イラストを作成してもらった(`クロコとcodex受け渡し\素材受け渡し\02_Codex作成素材\アニマルライフ_コスチューム試作_着物チンチラ_2026-08-09\`)。素のchinchilla-gray.glbを実際にBlenderでレンダリングして元イラストと見比べ、プロポーション・尻尾の位置に乖離がないことを事前確認した上で依頼した
- 生成: 他キャラクターと同じMeshy AI API Multi-Image to 3D(`ai_model: meshy-6`、`enable_pbr: true`、`texture_resolution: 4k`、`should_remesh: true`、`target_polycount: 15000`)
- 最終仕上げ: テクスチャ解像度1024縮小・Draco圧縮・JPEG変換(同一パイプライン)
- 最終仕様: 約15,467ポリゴン(46,401indices)・460KB
- バウンディングボックス: X幅0.88/Y幅1.90/Z幅1.42(素のchinchilla-gray.glbとY幅がほぼ一致、CHARACTER_SCALE等を流用しやすい可能性が高い)
- **今後の展開**: このコスチューム(着物)を残り5種(チンチラ白パイド・フレンチブルドッグ2色・三毛猫・うさぎ)に展開する場合、同じ手順(各動物の素の参考イラスト+同ポーズで着物を着せる)を踏襲する。コスチューム1種類につき動物種の数だけ個別モデルが必要になる(頭部アイテムのような使い回しはできない)。
- **`docs/board3d.js`(コスチューム装備時のモデル差し替えロジック)への組み込みは未実施**、進行用チャット側での対応待ち。まだcommit/pushしていない
- **2026-08-10、進行用チャット側で組み込み完了**: ユーザーから「帽子・アクセサリーを廃止し、全身コスチューム(動物種ごとに着せる、独立キャラクターではなく既存の動物種フィット型を採用)に置き換える」との指示を受け、この試作モデルをテストケースとして`board3d.js`にコスチューム+動物種の組み合わせモデル差し替えロジック(`COSTUME_MODEL_MAP`、キー`"{costumeId}_{speciesId}"`)を実装した。
  - scale/yOffset算出: Three.js`GLTFLoader`+`DRACOLoader`(本番と同じ構成)で素の`chinchilla-gray.glb`とこのモデルを実機読み込みし、`Box3.setFromObject(gltf.scene)`で実測。Y軸(垂直方向)の実測サイズは素=1.4678/コスチューム版=1.4151、min.y絶対値は素=0.7343/コスチューム版=0.7088で、既存の`scale=0.47, yOffset=0.445`(素のchinchilla-gray用)に対してこの比率をそのまま適用し`scale=0.4875, yOffset=0.4295`を算出。実機表示(Playwright)でも素のモデルと違和感のない大きさ・接地で表示されることを確認済み。
  - **注記**: このファイル冒頭(2026-08-10)の「Blender等のオフライン計測は軸がずれる場合がある」という注意書きの実例が、まさにこのモデルで確認できた。Blender計測では「Y幅1.90/Z幅1.42」だったのに対し、Three.js実機実測では垂直方向(表示上の高さ)がZ軸相当(≈1.899)ではなくY軸(≈1.415〜1.468)に出ており、素のchinchilla-gray.glbも同じ傾向(Y軸1.468/Z軸1.899)だった。両ファイルで軸の出方が揃っていたため、今回はY軸実測値どうしの比率をそのまま使えば正しく揃うと判断した。
  - **2026-08-11、着物の残り5種+忍者6種を3Dモデル化(下記セクション参照)、他29組み合わせのうちスーツ6種・くまの着ぐるみ6種(計12組み合わせ)は引き続き3Dモデル化未着手**のため、`COSTUME_MODEL_MAP`に無ければ素の動物モデルにフォールバックする(3D盤面には反映されないが、ショップ・キャラクター編集画面の2Dイラストには反映される)。
  - あわせて、`docs/costumes/costume-<id>_<species>.png`(24枚、512×512、透過PNG)をショップ・キャラクター編集画面用のバッジ画像として新規生成した。各コスチュームフォルダの`front.png`(3Dモデル化用の参考イラスト、白背景)から、四隅を背景色として検出し外周と連結した領域のみを透明化する手法(内部の白い衣装部分は透明化しない)で背景除去し、正方形にトリミングしている。

## costume-kimono_chinchilla-white-pied.glb / costume-kimono_dog-frenchie-white.glb / costume-kimono_dog-frenchie-black.glb / costume-kimono_cat-calico.glb / costume-kimono_rabbit-white.glb / costume-ninja_chinchilla-gray.glb / costume-ninja_chinchilla-white-pied.glb / costume-ninja_dog-frenchie-white.glb / costume-ninja_dog-frenchie-black.glb / costume-ninja_cat-calico.glb / costume-ninja_rabbit-white.glb(着物残り5種+忍者6種)

- 2026-08-11、`costume-kimono_chinchilla-gray.glb`の試作確認後、保留していた「着物の残り5種」「忍者6種」を追加でユーザー指示により3Dモデル化(計11組み合わせ)。スーツ・くまの着ぐるみは今回対象外、引き続き保留中
- 参考イラスト: 着物残り5種は`クロコとcodex受け渡し\素材受け渡し\02_Codex作成素材\アニマルライフ_コスチューム_着物_残り5種_2026-08-09\`、忍者6種は`アニマルライフ_コスチューム_忍者_6種_2026-08-09\`(いずれも既存納品分・正面/側面/背面の3方向)。**うさぎ分(着物・忍者とも)は座りポーズ再作成版に差し替え済みのため、`アニマルライフ_コスチューム_うさぎ座りポーズ再作成_2026-08-10\`の画像を使用**(既存のうさぎ本体モデルと同じポーズに統一するため)
- 生成: 素の動物モデル・costume-kimono_chinchilla-grayと同じMeshy AI API Multi-Image to 3D(`ai_model: meshy-6`、`enable_pbr: true`、`texture_resolution: 4k`、`should_remesh: true`、`target_polycount: 15000`)。11点を並行リクエスト
- 最終仕上げ: テクスチャ解像度1024縮小・Draco圧縮・JPEG変換(同一パイプライン)
- 最終ファイルサイズ: costume-kimono_chinchilla-white-pied 410KB / costume-kimono_dog-frenchie-white 521KB / costume-kimono_dog-frenchie-black 506KB / costume-kimono_cat-calico 522KB / costume-kimono_rabbit-white 501KB / costume-ninja_chinchilla-gray 424KB / costume-ninja_chinchilla-white-pied 431KB / costume-ninja_dog-frenchie-white 458KB / costume-ninja_dog-frenchie-black 387KB / costume-ninja_cat-calico 477KB / costume-ninja_rabbit-white 484KB
- Blender簡易レンダーで全11点の形状確認済み、いずれも参考イラストの意匠(着物の和柄・帯、忍者装束のフード・帯)が正しく再現されており問題なし
- **scale/yOffsetの実測・`docs/board3d.js`の`COSTUME_MODEL_MAP`への組み込みは未実施**、進行用チャット側での対応待ち(costume-kimono_chinchilla-grayと同様、Three.js実機実測での算出が必要)。まだcommit/pushしていない

## costume-wedding_chinchilla-gray.glb / costume-wedding_chinchilla-white-pied.glb

- 2026-08-10、結婚マスの飾り(新郎新婦キャラ)として、納品済みのウェディング衣装イラスト(オス=タキシード/メス=ウェディングドレス)のうち代表2体を3Dモデル化。全6種ではなくこの2体のみ(コスト抑制、結婚マス周辺に静的に配置する用途のため)
- 参考イラスト: `クロコとcodex受け渡し\素材受け渡し\02_Codex作成素材\アニマルライフ_コスチューム_ウェディング_6種_2026-08-10\`(既存納品分)
- 生成: 他コスチュームと同じMeshy AI API Multi-Image to 3D(`ai_model: meshy-6`、`enable_pbr: true`、`texture_resolution: 4k`、`should_remesh: true`、`target_polycount: 15000`)
- 最終仕上げ: テクスチャ解像度1024縮小・Draco圧縮・JPEG変換(同一パイプライン)
- 最終仕様: chinchilla-gray(タキシード)15,392ポリゴン・481KB / chinchilla-white-pied(ウェディングドレス)14,813ポリゴン・693KB
- **用途**: 結婚マス(`BOARD_SQUARES`のindex17)周辺に静的な装飾として配置する想定(プレイヤーキャラクターとしての着せ替えではなく、風景装飾)。
- **組み込み・commit済み**(進行用チャット側、`docs/board3d.js`の`WEDDING_COUPLE_MODELS`/`createWeddingCouple()`)。scale/yOffsetはThree.js Box3実測から算出(groom: scale 0.3634/yOffset 0.5758、bride: scale 0.4691/yOffset 0.5674)。glb本体のgit追跡漏れ(コードはcommit済みだが本体ファイルが未追跡だった)を2026-08-11に発見・追加commit済み。

## icon-job.glb / icon-payday.glb / icon-event.glb / icon-fortune.glb / icon-choice.glb / icon-rest.glb / icon-childbirth.glb / icon-house.glb / icon-stock.glb / facility-church.glb(マス種別の視覚的判別強化)

- 2026-08-11、「マスの種類が見た目で分かるようにしたい」という要望を受け、マス目印アイコン9種+結婚マス用の教会を作成
- 参考イラスト: Codexへ依頼(`アニマルライフ_マス目印アイコン_9種_2026-08-10`・`アニマルライフ_教会_2026-08-10`)、既存の街灯/ベンチ/看板/建物と同じフェルト調ミニチュアジオラマ様式。教会は正面が開いた内部ジオラマ版(`facility-church.png`、新郎新婦キャラが中に配置された演出込み)を採用、扉が閉じた外観のみ版(`facility-church-exterior-v1.png`)は不採用
- アイコンの対応関係: icon-job=就職(カバン)、icon-payday=給料日(お金袋)、icon-event=イベント(ギフトボックス)、icon-fortune=運(水晶玉)、icon-choice=選択(二股看板)、icon-rest=ひと休み(ベンチ+Zzz)、icon-childbirth=出産(ベビーカー)、icon-house=マイホーム(家看板)、icon-stock=株(グラフ看板)
- 生成: 他の街灯/ベンチ/看板/建物と同じ簡易パイプライン(`ai_model: meshy-5`、単一画像、`enable_pbr: false`、`should_remesh: true`、`topology: triangle`)。`target_polycount`はアイコン5,000〜8,000(形状の複雑さに応じて個別設定)、教会は建物と同じ12,000
- 最終仕上げ: テクスチャ解像度1024縮小・Draco圧縮・JPEG変換(同一パイプライン)
- 最終仕様: icon-job 140KB / icon-payday 127KB / icon-event 139KB / icon-fortune 116KB / icon-choice 126KB / icon-rest 165KB / icon-childbirth 141KB / icon-house 153KB / icon-stock 173KB / facility-church 214KB
- Blender簡易レンダーで形状・質感を確認済み(icon-job・icon-stock・facility-churchで実施、いずれも既存の街灯/ベンチ/看板/建物と同等の品質)。教会は単一画像からの再構築のため側面・背面のディテールは簡略化されている(既存建物群と同じ制約、正面重視のジオラマ用途として許容範囲)
- **用途**: 各マス種別の周辺に静的な目印として配置する想定。スタート/ゴールは既存ゲートがあるため対象外
- **組み込み・commit済み**(進行用チャット側、`docs/board3d.js`の`SQUARE_TYPE_ICON_MODELS`/`createSquareIcons()`・`createChurch()`)。glb本体のgit追跡漏れ(コードはcommit済みだが本体ファイルが未追跡だった)を2026-08-11に発見・追加commit済み。

## snack-mascot.glb / building-job-center.glb / prop-flowerbed.glb / facility-plaza-circle.glb / scenery-distant-hill.glb(おやつ集めモード・ステージ1プロトタイプ素材)

- 2026-08-11、検討中の新ゲームモード「おやつ集めモード」のステージ1(アニマルタウン・リングパーク)プロトタイプ向けに作成
- 参考イラスト: Codexへ依頼(`アニマルライフ_おやつ集めモード_おやつマスコット_2026-08-11`・`アニマルライフ_おやつ集めモード_プロトタイプ地形素材4種_2026-08-11`)、既存の建物/小道具/マス目印アイコンと同じフェルト調ミニチュアジオラマ様式
- 生成: 既存の街灯/ベンチ/看板/建物/マス目印アイコンと同じ簡易パイプライン(`ai_model: meshy-5`、単一画像、`enable_pbr: false`、`should_remesh: true`、`topology: triangle`)。`target_polycount`はsnack-mascot 8,000・building-job-center 12,000(建物と同じ)・prop-flowerbed 6,000・facility-plaza-circle 8,000・scenery-distant-hill 5,000
- 最終仕上げ: テクスチャ解像度1024縮小・Draco圧縮・JPEG変換(同一パイプライン)
- 最終仕様: snack-mascot 89KB / building-job-center 248KB / prop-flowerbed 170KB / facility-plaza-circle 147KB / scenery-distant-hill 79KB
- Blender簡易レンダーで形状・質感を確認済み、いずれも既存素材と同等の品質。building-job-centerの壁面に単一画像生成由来の軽い模様ノイズがあるが、実用上問題ないレベル
- **用途**: おやつ集めモードのステージ1(北エリア=就職センター、中央=円形広場、道沿い=花壇、遠景=丘)。snack-mascotはマップ上に出現・取得・再配置される中心の収集アイテム
- **このゲームモード自体はまだアイデア段階で実装未着手**、`docs/board3d.js`への組み込みも未実施。素材のみ準備完了の状態。まだcommit/pushしていない

## facility-small-bridge.glb / prop-low-hedge.glb / building-house-small-a.glb / building-house-small-b.glb(おやつ集めモード・ステージ2地形素材)

- 2026-08-11、ステージ2(シーサイド・アドベンチャー)向けに作成。同時に納品された`terrain-water-tile.png`は繰り返し敷き詰めるテクスチャ素材のため、Meshy 3D化の対象外(平面へ直接適用する想定)
- 参考イラスト: Codexへ依頼(`アニマルライフ_おやつ集めモード_ステージ2地形素材_2026-08-11`)、既存の建物/小道具と同じフェルト調ミニチュアジオラマ様式。既存の`facility-bridge.png`(ステージ2中央の大型橋)とは別物の、島内の小水路用の小橋として依頼
- 生成: 既存素材と同じ簡易パイプライン(`ai_model: meshy-5`、単一画像、`enable_pbr: false`、`should_remesh: true`、`topology: triangle`)。`target_polycount`はfacility-small-bridge 8,000・prop-low-hedge 6,000・building-house-small-a/b 各10,000
- 最終仕上げ: テクスチャ解像度1024縮小・Draco圧縮・JPEG変換(同一パイプライン)
- 最終仕様: facility-small-bridge 143KB / prop-low-hedge 89KB / building-house-small-a 170KB / building-house-small-b 211KB
- Blender簡易レンダーで形状・質感を確認済み、いずれも既存素材と同等の品質。目立つアーティファクトなし
- **用途**: ステージ2の水路・牧場エリア背景装飾(入口ノード必須の主要施設ではなく、装飾レイヤーとして使用)
- **このゲームモード自体はまだアイデア段階で実装未着手**、`docs/board3d.js`への組み込みも未実施。素材のみ準備完了の状態。まだcommit/pushしていない

## prop-paw-fountain.glb(おやつ集めモード・中央広場の肉球噴水)

- 2026-08-11、中央広場(`facility-plaza-circle.glb`)に置く噴水として作成。景観デザイン案の「追加が必要そうな背景素材」10点のうち最後の1点
- 参考イラスト: Codexへ依頼(`アニマルライフ_おやつ集めモード_肉球噴水_2026-08-11`)、肉球そのものが噴水(掌パッド+指パッド4つがそれぞれ浅い水盤)になったデザイン。既存の円形広場タイルの中央花壇部分と差し替える想定
- 生成: 既存素材と同じ簡易パイプライン(`ai_model: meshy-5`、単一画像、`enable_pbr: false`、`should_remesh: true`、`topology: triangle`、`target_polycount: 8000`)
- 最終仕上げ: テクスチャ解像度1024縮小・Draco圧縮・JPEG変換(同一パイプライン)。最終仕様: 117KB、8,220ポリゴン
- Blender簡易レンダーで確認(横長で扁平な形状のため、通常の正面/側面レンダーでは分かりにくく、上方斜めからの追加レンダーで肉球形状を確認)。水しぶきの粒の1つから細い線状の小さなメッシュノイズがあるが、単一画像生成でよくある軽微な副産物で実用上問題ないレベル
- **用途**: 中央広場タイルの中心に設置。花壇バージョンとの差し替え運用(景観デザイン案より、外周の円形石畳は維持し中央の花壇部分のみ噴水に差し替え)
- **このゲームモード自体はまだアイデア段階で実装未着手**、`docs/board3d.js`への組み込みも未実施。素材のみ準備完了の状態。まだcommit/pushしていない

## item-dice-plus1.glb 〜 item-trade-ticket.glb(おやつ集めモード・アイテムアイコン12種)

- 2026-08-11、当初「2Dのままで十分」と判断していたおやつ集めモードの残り素材(計47点と誤カウントしていたが、実際は33点。詳細は下記「3D化しなかった素材」参照)について、ユーザーの意向により順番に3Dモデル化する方針に変更。まずアイテムアイコン12種から着手
- 対象: `item-dice-plus1`(サイコロ+1)・`item-dice-plus2`(サイコロ+2)・`item-dice-plus3`(サイコロ+3)・`item-steal`(横取り袋)・`item-warp`(ワープ玉)・`item-pushback`(押し戻しの実)・`item-trap`(いたずらの実)・`item-scent-herb`(鼻きき草)・`item-aim-powder`(狙い目の粉)・`item-double-seed`(ダブルチャンスの種)・`item-charm-paw`(おまもり)・`item-trade-ticket`(場所交換チケット)
- 参考イラスト: `クロコとcodex受け渡し\素材受け渡し\02_Codex作成素材\アニマルライフ_おやつ集めモード_アイテム12種_2026-08-11\`(既存納品分)
- 生成: 既存の街灯/ベンチ/看板/マス目印アイコンと同じ簡易パイプライン(`ai_model: meshy-5`、単一画像、`enable_pbr: false`、`should_remesh: true`、`topology: triangle`、`target_polycount: 6000`)。12点を並行リクエスト
- 最終仕上げ: テクスチャ解像度1024縮小・Draco圧縮・JPEG変換(同一パイプライン)
- 最終ファイルサイズ: item-dice-plus1 108KB / item-dice-plus2 152KB / item-dice-plus3 162KB / item-steal 172KB / item-warp 118KB / item-pushback 129KB / item-trap 129KB / item-scent-herb 122KB / item-aim-powder 100KB / item-double-seed 101KB / item-charm-paw 157KB / item-trade-ticket 167KB
- Blender簡易レンダーで全12点の形状を確認(いずれも正面レンダーで意匠がはっきり分かる、問題なし)
- **このゲームモード自体はまだアイデア段階で実装未着手**、`docs/board3d.js`への組み込みも未実施。素材のみ準備完了の状態。まだcommit/pushしていない

## item-shop-kiosk.glb / placed-trap-marker.glb / snack-spawn-marker.glb / snack-spawn-pedestal.glb / warp-destination-tile.glb / winner-trophy.glb(おやつ集めモード・マップ追加素材6種)

- 2026-08-11、上記アイテムアイコンに続けて3Dモデル化。参考イラストは`アニマルライフ_おやつ集めモード_マップ追加素材6種_2026-08-11`(Codexが自主的に追加納品していた既存納品分)
- 生成: 同じ簡易パイプライン(`ai_model: meshy-5`、単一画像、`enable_pbr: false`、`should_remesh: true`、`topology: triangle`)。`target_polycount`はitem-shop-kiosk 10,000(建物寄りの構造のため他より多め)・placed-trap-marker 5,000・snack-spawn-marker 5,000・snack-spawn-pedestal 6,000・warp-destination-tile 5,000・winner-trophy 6,000
- 最終仕上げ: テクスチャ解像度1024縮小・Draco圧縮・JPEG変換(同一パイプライン)
- 最終ファイルサイズ: item-shop-kiosk 214KB / placed-trap-marker 125KB / snack-spawn-marker 172KB / snack-spawn-pedestal 124KB / warp-destination-tile 132KB / winner-trophy 124KB
- **扁平な形状のsnack-spawn-marker・warp-destination-tileは、prop-paw-fountainと同様に通常の正面/側面レンダーでは分かりにくいため、`render_top.py`(上方35度からの角度付きレンダー、このセッションで新設)で追加確認**。いずれも意匠(肉球+周回リング/渦巻き模様)がはっきり分かり問題なし
- **このゲームモード自体はまだアイデア段階で実装未着手**、`docs/board3d.js`への組み込みも未実施。素材のみ準備完了の状態。まだcommit/pushしていない

## current-turn-ring.glb / move-destination-marker.glb / item-pickup-box.glb(おやつ集めモード・操作演出素材のうち3点)

- 2026-08-11、「操作演出素材8種」フォルダのうち、実体のある3D空間内オブジェクトとして意味を持つ3点のみを3Dモデル化。**残り5点(`coin-acquire-effect`・`snack-spawn-effect`・`snack-acquire-trail`・`trap-activate-effect`・`warp-activate-effect`)は、拡大・回転・フェード等で完結する画面演出用の透過エフェクトテクスチャであり、Codexの説明書でも2D UIレイヤー/Sprite・Billboardでの使用が明記されているため、3Dモデル化の対象外と判断し2Dのまま維持**(既存の水面タイル・マップ土台と同じ考え方)
- 参考イラスト: `アニマルライフ_おやつ集めモード_操作演出素材8種_2026-08-11`(既存納品分)
- 生成: 同じ簡易パイプライン(`ai_model: meshy-5`、単一画像、`enable_pbr: false`、`should_remesh: true`、`topology: triangle`)。`target_polycount`はcurrent-turn-ring 4,000・move-destination-marker 4,000・item-pickup-box 6,000
- 最終仕上げ: テクスチャ解像度1024縮小・Draco圧縮・JPEG変換(同一パイプライン)
- 最終ファイルサイズ: current-turn-ring 103KB / move-destination-marker 117KB / item-pickup-box 157KB
- Blender簡易レンダーで3点とも形状確認済み、問題なし
- **このゲームモード自体はまだアイデア段階で実装未着手**、`docs/board3d.js`への組み込みも未実施。素材のみ準備完了の状態。まだcommit/pushしていない

## paw-coin-single.glb / paw-coin-stack.glb / paw-coin-bag.glb / road-block-barricade.glb / route-choice-signpost.glb / winners-podium.glb(おやつ集めモード・追加実用素材のうち6点)

- 2026-08-11、「追加実用素材7種」フォルダのうち、盤上・リザルト画面に置く実体オブジェクト6点を3Dモデル化。**残り1点(`snack-holder-badge.png`)は、Codexの説明書で「3D上では常にカメラを向くBillboardが適しています」と明記された頭上バッジ用素材のため、3Dモデル化の対象外と判断し2Dのまま維持**
- 参考イラスト: `アニマルライフ_おやつ集めモード_追加実用素材7種_2026-08-11`(既存納品分)
- 生成: 同じ簡易パイプライン(`ai_model: meshy-5`、単一画像、`enable_pbr: false`、`should_remesh: true`、`topology: triangle`)。`target_polycount`はpaw-coin-single 3,000・paw-coin-stack 5,000・paw-coin-bag 5,000・road-block-barricade 6,000・route-choice-signpost 6,000・winners-podium 8,000
- 最終仕上げ: テクスチャ解像度1024縮小・Draco圧縮・JPEG変換(同一パイプライン)
- 最終ファイルサイズ: paw-coin-single 120KB / paw-coin-stack 156KB / paw-coin-bag 188KB / road-block-barricade 140KB / route-choice-signpost 142KB / winners-podium 133KB
- Blender簡易レンダーで6点とも形状確認済み、問題なし
- **このゲームモード自体はまだアイデア段階で実装未着手**、`docs/board3d.js`への組み込みも未実施。素材のみ準備完了の状態。まだcommit/pushしていない

## おやつ集めモード: 3D化しなかった素材(2D平面のまま使用、2026-08-11確定)

上記27点の3Dモデル化により、「おやつ集めモード」向けに納品された素材のうち、3D空間内で実体を持つオブジェクトはすべて3Dモデル化が完了した。以下は構造上3D化に向かない(または3D化する意味がない)素材として、意図的に2Dのまま据え置く:

- `terrain-water-tile.png`(水面、繰り返し敷き詰めるシームレステクスチャ)
- `terrain-island-edge.png`(マップ外周の土台、マップ外形に合わせて伸縮させる断面パーツ)
- `coin-acquire-effect.png` / `snack-spawn-effect.png` / `snack-acquire-trail.png` / `trap-activate-effect.png` / `warp-activate-effect.png`(拡大・回転・フェード等の画面演出で完結する透過エフェクトテクスチャ、操作演出素材8種のうち5点)
- `snack-holder-badge.png`(常にカメラを向くBillboard用の頭上バッジ)

いずれもPlane/Sprite/Billboardとしてそのまま平面表示する前提の素材であり、3Dメッシュ化しても実用上の意味を持たない。

## docs/images/snack/*.png(おやつ集めモード・ポップアップ式UI刷新の2D素材12点)

- 2026-08-12、おやつ集めモードのUI・演出を「下部固定メニューバー」から「全画面3D+ポップアップ式」へ全面刷新する確定仕様書(Codex連携チャット作成)に伴い受け取った2D UI素材。3D空間内の実体オブジェクトではなくHTML/CSS側で重ねて使う画像のため、他の`.glb`素材とは異なり3Dモデル化の対象外
- 参考イラスト/納品元: `C:\Users\飯田\Documents\Codex\2026-08-09\codex-01-2026-08-09-md\output\アニマルライフ_ターン行動ポップアップUI_2026-08-12\`(11点: `action-dice`/`action-item`/`action-log`/`action-map`/`action-next`のアイコン5種、`popup-choice-frame`/`popup-choice-button`/`popup-result-frame`のポップアップ枠3種、`map-overview`/`map-zoom`/`map-pan-hint`のマップ確認UI3種)と`...アニマルライフ_プレイヤー情報HUD_2026-08-12\`(1点: `player-status-hud.png`、4隅HUDの背景)
- 軽量化: Python PIL(`Image.open(...).convert("RGBA").resize(...)`)でモバイル配信用に縮小(アイコン系は320px、フレーム系は800〜900px、いずれも最大辺基準)。納品時点の合計約11.6MBから約1.9MBまで削減(既存の`sky-backdrop.jpg`等と同じ軽量化方針を踏襲)
- 配置先: `docs/images/snack/`(`docs/images/items/`と同じ`docs/images/<用途別サブフォルダ>/`命名規則)
- 組み込み: `docs/ui.js`の`SNACK_ACTION_ICONS`(行動アイコン)、`renderSnackPopupChoice`/`renderSnackPopupResult`(border-image 9-sliceでポップアップ枠に使用)、`renderSnackHUD`(4隅HUD背景)、`renderSnackMapViewOverlay`(マップ全体/ズーム切替ボタン・初回パンヒント)から参照。プレイヤー交代テロップ(`PLAYER_INTRO`)・ラウンド切替テロップ(`ROUND_INTRO`)専用の枠素材は未納品のため、`popup-result-frame.png`を暫定枠として再利用している(仕様書内で指示された対応)

## docs/images/snack-spaces/*.png(おやつ集めモード・通常マス2.5D素材16点)

- 2026-08-13、上記UI統合納品フォルダに同梱されていた「通常マス2.5D実装仕様書」により正式採用。個別3Dモデル化ではなく、全マス共通のクリーム色シリンダー土台(Three.jsのプリミティブで生成、GLB無し)+種類別の透過PNGを貼ったカメラ追従インポスターの組み合わせで16種類を表現する2.5D方式
- 納品元: `C:\Users\飯田\Documents\Codex\2026-08-09\codex-01-2026-08-09-md\output\アニマルライフ_おやつ集めモード_UI演出統合納品_2026-08-12\06_通常マス2.5D\runtime\`(16枚、512×512、RGBA、同一余白・中央揃えへ正規化済み)。同梱の`space-visual-manifest.json`のSHA-256でコピー後に整合性確認済み(全16件一致)、リサイズ・トリミング等の加工は仕様書の指示により一切行っていない
- 配置先: `docs/images/snack-spaces/`
- 組み込み: `docs/snack-board3d.js`の`SPACE_VISUAL_MAP`(`branch→junction`・`item-box→item`・`start→normal`のマッピング含む、現行`snack-data.js`のnodeTypeのうち実際に使う12種のみ対応、残り5種`event`/`paidGate`/`warp`/`family`/`investment`は未使用の予備枠)経由で`buildSpaceGroups()`が読み込み、旧`loadSnackMasuBaseInstances`(masu-base.glbクローン+マテリアル色分けのみ)を置き換えた

## docs/images/snack/gaburion/*.png(おやつ集めモード・ガブリオンイベント素材20点)

- 2026-08-13、上記UI統合納品フォルダに同梱されていた「05_ガブリオンイベント確定仕様書」により正式採用。ガブリオンマスに止まると発生するルーレット形式のミニイベント(仕様書の8種類の結果・救済ルール・第8ラウンド開始時の盤面変化FINAL_THREE_TRANSFORMを含む)の2D UI素材。3D空間内の実体オブジェクトではなく画面全体を覆うオーバーレイ(`.gaburion-overlay`)として使うため3Dモデル化の対象外
- 納品元: `C:\Users\飯田\Documents\Codex\2026-08-09\codex-01-2026-08-09-md\output\アニマルライフ_おやつ集めモード_UI演出統合納品_2026-08-12\05_ガブリオンイベント\individual\`(20枚、いずれもRGBA透過、300〜700px程度)。同フォルダには一覧用シート・再編集用クロマキー素材も同梱されていたが、仕様書の指示通り`individual`のみを使用
- 軽量化: 納品時点で既に300〜700px程度とUI用途として十分小さいサイズだったため、追加のリサイズは行っていない(合計約5.4MB)
- 配置先: `docs/images/snack/gaburion/`
- 組み込み: `docs/ui.js`の`SNACK_GABURION_IMAGES`/`SNACK_GABURION_RESULT_ICONS`経由で、`GABURION_INTRO`/`GABURION_ROULETTE_READY`/`GABURION_ROULETTE_SPIN`/`GABURION_RESULT`/`GABURION_APPLY`/`FINAL_THREE_WARNING`/`FINAL_THREE_TRANSFORM`の各フェーズ専用render関数から参照。一覧用シート・クロマキー素材(`gaburion-character-sheet.png`等)は取り込んでいない

## space-normal.glb 〜 space-junction.glb(おやつ集めモード・通常マスの完全3Dモデル化 第2版、11種)

- 2026-08-14〜15、「マスが思ったのと違う」という指摘を受け、2026-08-13に実装したプリミティブ形状合成(コイン・矢印・箱等をThree.jsの基本図形で組み立てる方式)から、`docs/images/snack-spaces/*.png`(2026-08-13納品済みだが未使用のまま残っていたフェルトパック調2.5D素材16枚)をMeshyで画像→3D変換した本物のモデルへ差し替えた。実際にゲームで使う11種(normal/coin/income/expense/choice/item/job/payday/shop/rest/junction、残り5種`event`/`family`/`investment`/`paid-gate`/`warp`は未使用のため対象外)のみ変換
- 生成: 既存の街灯/ベンチ/看板/マス目印アイコンと同じ簡易パイプライン(Meshy AI API Image-to-3D、`ai_model: meshy-5`、単一画像、`enable_pbr: false`、`should_remesh: true`、`topology: triangle`、`target_polycount: 6000`)。11点を並行リクエスト
- 最終仕上げ: テクスチャ解像度1024縮小・Draco圧縮・JPEG変換(同一パイプライン)。最終ファイルサイズ96〜148KB
- **土台+アイコンの2層構成をやめ、1個の完成モデル(=フェルトパックそのもの)に統合**。scale/yOffsetはThree.js Box3実機実測から算出。item/job/payday/shopは単一画像からの立体復元でY方向(高さ)が誇張され、そのままだとキャラクターより高くなってしまったため、表示高さの上限(0.62)を超えないよう個別にscaleを絞った(それ以外はscale=0.5で統一)
- 組み込み・commit済み(`docs/snack-board3d.js`の`SNACK_SPACE_MODEL_ASSETS`/`SNACK_SPACE_MODEL_KEY_MAP`/`buildSpaceGroups()`)。ガブリオンマスは石碑+紫炎のプリミティブ形状(`createGaburionSymbol`)のまま、puckモデルの上に追加で重ねて表示する設計に変更(以前は完全に置き換えていた)
- 参考画像(切り出し前の元シート)は`docs/images/snack-spaces/`に残置。個別に切り出したものではなく直接そのままMeshyへ渡した

## road-straight.glb 〜 road-gate.glb / cluster-flowerbed-oval.glb 〜 cluster-shrub.glb(地面・道路のフェルト調改修用素材、12種)

- 2026-08-14、地面(単色平坦な緑地)・道路(薄茶色の平面帯)をフェルト調ミニチュアジオラマの質感に合わせる全面改修のため作成。飯田さんが別のCodexチャットで方向性確認用のプレビューシート4枚(道路パーツ6種・ground-clusters6種・地区別フェルト芝カラースワッチ・タイル可能な芝テクスチャ)を作成し`クロコ確認フォルダ/アプリ素材/`に配置、進行用チャット側で内容を確認・採用した
- 参考イラストの切り出し: プレビューシートはクロマキー背景(道路パーツ=緑、ground-clusters=ピンク)の一覧絵だったため、Python(PIL)で境界と連結した背景色領域のみをflood-fillで透明化(内部に似た色があっても穴を開けない手法)+アルファ収縮でエッジのフリンジ除去し、個別の透過PNGに切り出した。保存先: `docs/models/reference/road-pieces/`(6枚: straight/curve/t-junction/y-junction/cross/gate)・`docs/models/reference/ground-clusters/`(6枚: flowerbed-oval/flowerbed-crescent/flowerbed-ring/pond/paving/shrub-cluster)
- 生成: 既存の街灯/ベンチ/マス目印アイコンと同じ簡易パイプライン(Meshy AI API Image-to-3D、`ai_model: meshy-5`、単一画像、`enable_pbr: false`、`should_remesh: true`、`topology: triangle`)。`target_polycount`は道路パーツ8000〜10000(形状の複雑さに応じて個別設定)・ground-clusters6000〜8000
- 最終仕上げ: テクスチャ解像度1024縮小・Draco圧縮・JPEG変換(同一パイプライン)。最終ファイルサイズ102〜191KB。保存先: `docs/models/terrain/`
- 地区別フェルト芝カラースワッチ(Base/Station/Civic/Residential/Church/Park/Centralの7色)は画像から平均色をサンプリングしてhex値を抽出済み(いずれもオリーブ系の近似色、5〜10%程度の差)。Roughness/Normalのセルは単色のプレースホルダーだったため実際のテクスチャマップとしては使わず、既存踏襲の固定roughness値で対応する方針
- **このセッション時点では`docs/snack-board3d.js`への組み込みは未実施**。地面ジオメトリの高低差・フェルト芝適用・道路のroad-piece連結配置・ground-clustersの8〜12箇所配置は次回以降の作業
