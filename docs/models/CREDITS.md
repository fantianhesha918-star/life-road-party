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

- **2026-08-09にクオリティ向上のため作り直し済み(v3)**。ユーザーから「しっぽの質感・顔の可愛さをホワイトパイド相当に近づけたい」との要望を受け、参考イラストは変えずMeshy AIでの3D変換のみ再実行。旧バージョン(v2)は`chinchilla-gray_v2_backup.glb`、さらに旧v1は`chinchilla-gray_v1_backup.glb`として同フォルダに残してある(不要になれば削除可、ユーザー確認の上で)
- 経緯: 同一参考イラスト・同一設定のままMeshyで2回再生成して比較。1回目(v3候補)はしっぽに意図しない縞模様アーティファクトが出たため不採用、2回目(採用版)でしっぽの毛量・ボリュームともに改善しアーティファクトも無かったため採用
- 生成元(v3): Meshy AI API、Multi-Image to 3D(`ai_model: meshy-6`、`enable_pbr: true`、`texture_resolution: 4k`、`should_remesh: true`、`topology: triangle`、`target_polycount: 15000`)。参考イラストはGeminiで生成した正面・側面・背面の3枚(`docs/models/reference/chinchilla-gray/`、変更なし)を使用。比較のための1回を含め計60クレジット消費
- ライセンス: Meshy Premiumプランでの生成物のため、有料プランの利用規約に基づき完全所有・クレジット表記不要
- 最終仕上げ: Blenderでテクスチャ解像度を1024に縮小・Draco圧縮・JPEG変換(従来と同じパイプライン)
- 最終仕様(v3): 15,637ポリゴン・346KB、バウンディングボックスY幅1.899(旧バージョンとほぼ一致、CHARACTER_SCALE等の変更は不要な見込み)
- **旧v1の経緯(参考)**: 最初はMeshy無料プランのWeb UI(Image-to-3D、Meshy 5、正面画像のみ)で生成し689,686ポリゴン・33MBと過大だった。単純なBlender Decimateでは、Meshyのテクスチャが「複数視点写真を継ぎ接ぎしたアトラス画像」形式であることが原因でUV対応が崩れノイズが出る問題があり、Meshy公式の「Remesh」機能(Web UI、5クレジット)で解決した経緯がある。API化後はこの手動手順が不要になった
- **`docs/board3d.js`などへの反映は進行用チャット側の作業待ち**(まだcommit/pushしていない)。テクスチャ・見た目のみの差し替えのためscale/yOffsetの変更は不要な見込みだが、念のため実機確認を推奨

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
- **`docs/board3d.js`・`shop-data.js`(SPECIES_ITEMSへの追加)への組み込みは未実施**、進行用チャット側での対応待ち。まだcommit/pushしていない

## costume-kimono_chinchilla-gray.glb

- 2026-08-09、コスチューム(全身衣装)システムの試作第一弾。「チンチラ(グレー)が着物を着た状態」を丸ごと1体のモデルとして作成(頭・体を分離せず、着せ替え時はモデルまるごと差し替える方式で確定済み)
- 参考イラスト: 既存の`chinchilla-gray`参考イラスト(3方向)をCodexに渡し、**全く同じポーズ・カメラ距離・体型のまま着物(紺地に和柄、赤茶の帯)を着せた**3方向イラストを作成してもらった(`クロコとcodex受け渡し\素材受け渡し\02_Codex作成素材\アニマルライフ_コスチューム試作_着物チンチラ_2026-08-09\`)。素のchinchilla-gray.glbを実際にBlenderでレンダリングして元イラストと見比べ、プロポーション・尻尾の位置に乖離がないことを事前確認した上で依頼した
- 生成: 他キャラクターと同じMeshy AI API Multi-Image to 3D(`ai_model: meshy-6`、`enable_pbr: true`、`texture_resolution: 4k`、`should_remesh: true`、`target_polycount: 15000`)
- 最終仕上げ: テクスチャ解像度1024縮小・Draco圧縮・JPEG変換(同一パイプライン)
- 最終仕様: 約15,467ポリゴン(46,401indices)・460KB
- バウンディングボックス: X幅0.88/Y幅1.90/Z幅1.42(素のchinchilla-gray.glbとY幅がほぼ一致、CHARACTER_SCALE等を流用しやすい可能性が高い)
- **今後の展開**: このコスチューム(着物)を残り5種(チンチラ白パイド・フレンチブルドッグ2色・三毛猫・うさぎ)に展開する場合、同じ手順(各動物の素の参考イラスト+同ポーズで着物を着せる)を踏襲する。コスチューム1種類につき動物種の数だけ個別モデルが必要になる(頭部アイテムのような使い回しはできない)。
- **`docs/board3d.js`(コスチューム装備時のモデル差し替えロジック)への組み込みは未実施**、進行用チャット側での対応待ち。まだcommit/pushしていない
