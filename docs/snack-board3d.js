// アニマルライフ「おやつ集めモード」フェーズ1(試作)の3Dマップ。
// 既存board3d.js(直線・単一パス・整数indexの盤面)とはデータ構造が別物のため、
// 専用の描画コードとして新規に用意する(既存board3d.jsは変更しない)。
// キャラクターモデル定義(SPECIES_MODEL_MAP)は、試作段階では重複を許容してboard3d.jsから
// そのままコピーして開始する(plan通り。重複が問題になれば共通ファイルへ切り出す)。
import * as THREE from "three";
import { loadGLTFSceneCached } from "./gltf-cache.js";

const SKY_BACKDROP_URL = new URL("./images/sky-backdrop.jpg", import.meta.url).href;
// 2026-08-15、単色べったりの旧ground-grass.jpgから、Codex作成の繊維感・まだらのあるフェルト芝
// テクスチャへ差し替え(利用者仕様書「つや消しのフェルト芝へ変更、弱い繊維感・明暗のまだら」対応)。
// 2026-08-15(第2弾): Codex納品のPBRセット(BaseColor/Normal/Roughness/AO)へ差し替え。
// Codexの推奨する第一候補構成(地区別6枚は常時読み込まず、共通BaseColor+既存vertex colorの
// 地区色付けのまま)を採用し、Normal/Roughness/AOだけを追加する。Heightは頂点変位・当たり判定に
// 影響させない方針のため今回は未使用。地区別6枚(grass-felt-station.png等)は次段階で検討する。
const GROUND_BASECOLOR_URL = new URL("./images/grass-felt-basecolor.png", import.meta.url).href;
const GROUND_NORMAL_URL = new URL("./images/grass-felt-normal.png", import.meta.url).href;
const GROUND_ROUGHNESS_URL = new URL("./images/grass-felt-roughness.png", import.meta.url).href;
const GROUND_AO_URL = new URL("./images/grass-felt-ao.png", import.meta.url).href;
const ROAD_TEXTURE_URL = new URL("./images/road-path.jpg", import.meta.url).href;

// 2026-08-13(第3弾)、利用者仕様書「道路幅を現在の65〜75%程度へ縮小」に沿って0.9→0.65(72%)に変更。
const ROAD_HALF_WIDTH = 0.65;
// 2026-08-15、利用者から「移動が速すぎる、もう少しゆっくりぴょんぴょんしてる感じがいい」との
// 指摘を受け、弧の高さを上げ(0.5→0.62)、所要時間も伸ばした(HOP_STEP_DURATION_MS 260→360、
// app.jsのSNACK_HOP_STEP_MSも同じ値に合わせて変更、HOP_DURATION_MSも同じ比率で450→620)。
const HOP_HEIGHT = 0.62;
const HOP_DURATION_MS = 620; // syncPlayersが差分から直接1回ホップさせるフォールバック用
// 1マスずつの逐次ホップ(hopPath)専用の短めの時間。旧来の「移動元→移動先を1回で結ぶ」演出用
// のHOP_DURATION_MSのまま複数マスに使うと合計時間が長くなりすぎるため別定数にした(2026-08-12)。
const HOP_STEP_DURATION_MS = 360;
// カメラはすごろく本編(board3d.js)と同じ「静止時=ジオラマ風の見下ろし/移動中=進行方向の
// 真後ろから追う三人称視点」の2段構成にする(2026-08-11、ユーザー指示で本編と統一)。
// ループ型マップでも、追従先はあくまで現在の手番プレイヤー1人なので同じ値をそのまま使える。
const CAMERA_IDLE = { back: 6.0, up: 5.2, trail: 3.4 };
// lookAhead: 2026-08-13追加。移動中、注視点をキャラクターより少し進行方向へ先読みし、
// 次の経路が画面内に見えるようにする(Codexレビュー「移動中に次の2〜3マスが見える」対応)。
const CAMERA_MOVE = { up: 1.7, trail: 2.5, lookAhead: 2.1 };
const CAMERA_LERP = 0.08;

// カメラ⇔対象の間に建物・木等が入り込んだ場合の簡易遮蔽対策(2026-08-13新規)。
// このプロジェクトに既存のraycast実装が無いため、まずは「経路上に高さ0.5を超える
// 何かがあればカメラを一定量持ち上げる」という最小限のしきい値判定から始める
// (精密な形状回避や横方向への回避は未実装、将来の改善余地として残す)。
const snackOcclusionRaycaster = new THREE.Raycaster();
let lastOcclusionCheckTime = 0;
let lastOcclusionLift = 0;
function computeCameraOcclusionLift(cameraPos, targetPos) {
  if (!scene) return 0;
  const now = performance.now();
  if (now - lastOcclusionCheckTime < 150) return lastOcclusionLift;
  lastOcclusionCheckTime = now;
  const toTarget = targetPos.clone().sub(cameraPos);
  const dist = toTarget.length();
  if (dist < 0.6) {
    lastOcclusionLift = 0;
    return 0;
  }
  const dir = toTarget.clone().normalize();
  snackOcclusionRaycaster.set(cameraPos, dir);
  snackOcclusionRaycaster.near = 0.4;
  snackOcclusionRaycaster.far = Math.max(0.5, dist - 0.4);
  const hits = snackOcclusionRaycaster.intersectObjects(scene.children, true);
  const blocked = hits.some((h) => h.point.y > 0.5);
  lastOcclusionLift = blocked ? 1.4 : 0;
  return lastOcclusionLift;
}

// マリオパーティ風、頭上でサイコロが回転→ジャンプしながら着地して出目を確定させる演出用の定数。
const DICE_SIZE = 0.42;
const DICE_HEAD_HEIGHT = 1.15;
const DICE_SPIN_DURATION_MS = 700;
const DICE_SETTLE_DURATION_MS = 380;
const DICE_HOLD_DURATION_MS = 260;
// 行動順決め(orderLineup)で横一列に並べる際の間隔。
const ORDER_LINEUP_SPACING = 1.15;

// board3d.jsのSPECIES_MODEL_MAPと同一定義(2026-08-11時点)。動物種ごとの実3Dモデル。
const SPECIES_MODEL_MAP = {
  "species-chinchilla-gray": {
    url: new URL("./models/chinchilla-gray.glb", import.meta.url).href,
    scale: 0.606,
    yOffset: 0.445,
  },
  "species-chinchilla-white": {
    url: new URL("./models/chinchilla-white-pied.glb", import.meta.url).href,
    scale: 0.598,
    yOffset: 0.445,
  },
  "species-dog-frenchie-white": {
    url: new URL("./models/dog-frenchie-white.glb", import.meta.url).href,
    scale: 0.635,
    yOffset: 0.445,
  },
  "species-dog-frenchie-black": {
    url: new URL("./models/dog-frenchie-black.glb", import.meta.url).href,
    scale: 0.624,
    yOffset: 0.445,
  },
  "species-cat-calico": {
    url: new URL("./models/cat-calico.glb", import.meta.url).href,
    scale: 0.469,
    yOffset: 0.445,
  },
  "species-rabbit-white": {
    url: new URL("./models/rabbit-white.glb", import.meta.url).href,
    scale: 0.469,
    yOffset: 0.445,
  },
  "species-human-male": {
    url: new URL("./models/human-male.glb", import.meta.url).href,
    scale: 0.469,
    yOffset: 0.446,
  },
  "species-human-female": {
    url: new URL("./models/human-female.glb", import.meta.url).href,
    scale: 0.469,
    yOffset: 0.446,
  },
};

// フェーズ1で使う専用の景観素材6点。scale/yOffsetは_measure_snack_models.html(Playwright+Box3実測)
// で全モデルがx軸(またはz軸)基準でおよそ幅2に正規化されていることを確認し、狙いの実寸
// (下記コメントの目標値)になるよう逆算した(2026-08-11)。素材自体はCodex連携チャットが
// 3Dモデル化済み(docs/models/CREDITS.md参照)。
const SNACK_STAGE_MODELS = {
  // 就職センター(北エリアの建物)。目標高さ2.4
  jobCenter: {
    url: new URL("./models/building-job-center.glb", import.meta.url).href,
    scale: 1.24,
    yOffset: 1.2,
  },
  // おやつマスコット(出現地点に浮かべる収集物)。目標高さ0.55
  mascot: {
    url: new URL("./models/snack-mascot.glb", import.meta.url).href,
    scale: 0.314,
    yOffset: 0.275,
  },
  // 花壇(道沿いの装飾)。目標高さ0.35
  flowerbed: {
    url: new URL("./models/prop-flowerbed.glb", import.meta.url).href,
    scale: 0.718,
    yOffset: 0.175,
  },
  // 中央広場の円形タイル。目標直径3.0だったが、2026-08-13(第3弾)の利用者仕様書で
  // 「現状比2〜2.5倍を目安に主役化」と指定されたため2.2倍(目標直径6.6)へ拡大。
  // scale/yOffsetは同じ比率で拡大し、地面への接地位置がずれないようにする。
  plazaCircle: {
    url: new URL("./models/facility-plaza-circle.glb", import.meta.url).href,
    scale: 1.5 * 2.2,
    yOffset: 0.173 * 2.2,
  },
  // 遠景の丘(背景装飾)。目標幅6.0
  distantHill: {
    url: new URL("./models/scenery-distant-hill.glb", import.meta.url).href,
    scale: 3.0,
    yOffset: 0.381,
  },
  // 中央広場の肉球噴水(花壇部分と差し替え設置)。目標直径1.4だったが、plazaCircleと同じ理由・
  // 同じ倍率(2.2倍、目標直径3.08)で拡大。
  pawFountain: {
    url: new URL("./models/prop-paw-fountain.glb", import.meta.url).href,
    scale: 0.7 * 2.2,
    yOffset: 0.135 * 2.2,
  },
  // ショップの出店(shopノード脇)。目標高さ1.8
  shopKiosk: {
    url: new URL("./models/item-shop-kiosk.glb", import.meta.url).href,
    scale: 0.9,
    yOffset: 0.9,
  },
  // アイテム箱(item-boxノード脇)。目標高さ0.5
  itemBox: {
    url: new URL("./models/item-pickup-box.glb", import.meta.url).href,
    scale: 0.34,
    yOffset: 0.25,
  },
  // 発動中の「いたずらの実」の罠マーカー(node.activeTrapがある間だけ動的に表示)。目標高さ0.45
  trapMarker: {
    url: new URL("./models/placed-trap-marker.glb", import.meta.url).href,
    scale: 0.339,
    yOffset: 0.225,
  },
  // 分岐ノード脇の道しるべ。目標高さ1.3
  routeSignpost: {
    url: new URL("./models/route-choice-signpost.glb", import.meta.url).href,
    scale: 0.7,
    yOffset: 0.65,
  },
  // おやつマスコットの足元の台座。目標高さ0.4
  spawnPedestal: {
    url: new URL("./models/snack-spawn-pedestal.glb", import.meta.url).href,
    scale: 0.4,
    yOffset: 0.204,
  },
  // 現在の手番プレイヤーの足元に出すリング。モデルはXY平面の縦向きディスクのため
  // (Box3実測でz軸だけ薄いことを確認済み)、配置時にX軸-90°回転させて地面に寝かせる。
  turnRing: {
    url: new URL("./models/current-turn-ring.glb", import.meta.url).href,
    scale: 0.5,
  },
};

// 空き地装飾8種(2026-08-15、Meshy生成済みだった未組み込み素材6種+2026-08-16追加の低木・ベンチ)。
// いずれもThree.js Box3実測で水平寸法が約2.0に正規化されていたため(Meshy標準パイプラインの
// 既知の傾向)、目標最大寸法1.6を狙ってscale=0.8で統一し、yOffset = scale × |min.y| で接地位置を
// 算出した。prop-benchのみ本編と同じscale/yOffset(SNACK_ZONE_MODELS参照)をそのまま流用。
const SNACK_GROUND_CLUSTER_MODELS = {
  flowerbedOval: { url: new URL("./models/terrain/cluster-flowerbed-oval.glb", import.meta.url).href, scale: 0.8, yOffset: 0.132 },
  flowerbedCrescent: { url: new URL("./models/terrain/cluster-flowerbed-crescent.glb", import.meta.url).href, scale: 0.8, yOffset: 0.211 },
  flowerbedRing: { url: new URL("./models/terrain/cluster-flowerbed-ring.glb", import.meta.url).href, scale: 0.8, yOffset: 0.117 },
  pond: { url: new URL("./models/terrain/cluster-pond.glb", import.meta.url).href, scale: 0.8, yOffset: 0.263 },
  paving: { url: new URL("./models/terrain/cluster-paving.glb", import.meta.url).href, scale: 0.8, yOffset: 0.167 },
  shrub: { url: new URL("./models/terrain/cluster-shrub.glb", import.meta.url).href, scale: 0.8, yOffset: 0.213 },
  lowHedge: { url: new URL("./models/prop-low-hedge.glb", import.meta.url).href, scale: 0.8, yOffset: 0.19 },
  bench: { url: new URL("./models/prop-bench.glb", import.meta.url).href, scale: 0.55, yOffset: 0.42 },
  // 2026-08-16、見本(公園の見本画像)は道沿いに大きく茂った木・低木の群れと街灯が
  // 点在しており、それに比べて緑・街灯の密度が薄いという利用者指摘への対応で追加。
  // scale/yOffsetはSNACK_ZONE_MODELSの同モデルより一回り小さくし、背景寄りの控えめな
  // 存在感にした(手前の建物脇の同モデルと張り合わないように)。
  treeRound: { url: new URL("./models/tree-round.glb", import.meta.url).href, scale: 0.72, yOffset: 0.72 },
  treeConifer: { url: new URL("./models/tree-conifer.glb", import.meta.url).href, scale: 0.82, yOffset: 0.82 },
  streetlamp: { url: new URL("./models/prop-streetlamp.glb", import.meta.url).href, scale: 0.85, yOffset: 0.85 },
};
// 見本の「木・低木が多い」印象に近づけるため、緑系(shrub/木)と街灯を重み付けして
// 出現回数を増やす(単純なObject.keys()の均等巡回ではなく、明示的な重み付き配列にする)。
const SNACK_GROUND_CLUSTER_KEYS = [
  "shrub", "treeRound", "flowerbedOval", "shrub", "streetlamp", "treeConifer",
  "flowerbedCrescent", "bench", "shrub", "lowHedge", "treeRound", "flowerbedRing",
  "streetlamp", "pond", "treeConifer", "paving", "shrub", "bench",
];

// 地区ゾーン(見本の上=駅・商店・カフェ、右上〜右=役所・病院・学校、右下=住宅・庭・郵便局、
// 下=教会・結婚式広場、左=公園)の建物・小物。本編(board3d.js)で使用中の素材・scale/yOffsetを
// そのまま再利用する(2026-08-12、Box3実測をやり直さず本編の実測値を流用。値は board3d.js の
// STAGE_PROP_MODELS 参照)。ゾーン名(civic/residential等)は2026-08-13の32マス化・地区再編で
// station/office/school/church/parkから改名。
const SNACK_ZONE_MODELS = {
  "building-station": { url: new URL("./models/building-station.glb", import.meta.url).href, scale: 1.15, yOffset: 0.775 },
  "building-office": { url: new URL("./models/building-office.glb", import.meta.url).href, scale: 1.3, yOffset: 1.3 },
  "building-shop": { url: new URL("./models/building-shop.glb", import.meta.url).href, scale: 1.061, yOffset: 0.9 },
  "building-school": { url: new URL("./models/building-school.glb", import.meta.url).href, scale: 1.2, yOffset: 0.905 },
  "building-hospital": { url: new URL("./models/building-hospital.glb", import.meta.url).href, scale: 1.15, yOffset: 1.116 },
  "building-apartment": { url: new URL("./models/building-apartment.glb", import.meta.url).href, scale: 1.2, yOffset: 1.2 },
  "building-house": { url: new URL("./models/building-house.glb", import.meta.url).href, scale: 1.269, yOffset: 1.1 },
  "facility-church": { url: new URL("./models/facility-church.glb", import.meta.url).href, scale: 0.525, yOffset: 0.525 },
  "facility-park": { url: new URL("./models/facility-park.glb", import.meta.url).href, scale: 1.3, yOffset: 0.803 },
  "tree-round": { url: new URL("./models/tree-round.glb", import.meta.url).href, scale: 0.802, yOffset: 0.8 },
  "tree-conifer": { url: new URL("./models/tree-conifer.glb", import.meta.url).href, scale: 0.95, yOffset: 0.95 },
  "prop-streetlamp": { url: new URL("./models/prop-streetlamp.glb", import.meta.url).href, scale: 0.9, yOffset: 0.9 },
  "prop-bench": { url: new URL("./models/prop-bench.glb", import.meta.url).href, scale: 0.55, yOffset: 0.42 },
  "prop-signboard": { url: new URL("./models/prop-signboard.glb", import.meta.url).href, scale: 0.45, yOffset: 0.373 },
  "gate-start": { url: new URL("./models/gate-start.glb", import.meta.url).href, scale: 1.5, yOffset: 1.288 },
};
// ゾーンごとに巡回配置する建物候補(stationゾーンは駅を専用配置するため対象外)
const SNACK_ZONE_BUILDING_THEMES = {
  civic: ["building-office", "building-school", "building-hospital"],
  residential: ["building-house", "building-apartment", "building-shop"],
  church: ["facility-church", "building-house"],
  park: ["facility-park"],
};
const SNACK_TREE_MODEL_KEYS = ["tree-round", "tree-conifer"];
const SNACK_STREET_PROP_MODEL_KEYS = ["prop-streetlamp", "prop-bench", "prop-signboard"];
// ゾーン内の建物・木・小物同士が近すぎる場合に間引く最小距離(本編のSTAGE_PROP_MIN_CROSS_GAP_DISTと同じ考え方)
const SNACK_ZONE_PROP_MIN_GAP = 2.4;

const textureLoader = new THREE.TextureLoader();

// ==================== 通常マスの完全3D化 v2(2026-08-14、Meshy画像→3D変換版) ====================
// 2026-08-13(第3弾)にプリミティブ形状合成(コイン・矢印・箱等をThree.jsの基本図形で組み立てる方式)へ
// 一度置き換えたが、実機で見比べたところ他の建物・小道具(いずれもMeshyで作った本物の3Dモデル)と
// 比べて質感が単調に見えるという指摘を受け、2026-08-14にdocs/images/snack-spaces/の元画像(フェルト
// パック調、実ゲームでは未使用のまま残っていた2.5D素材)をMeshyで画像→3D変換した本物のモデルに
// 差し替えた。「共通の土台+その上に載る種類別アイコン」という2層構成をやめ、土台とアイコンが
// 一体になった1個の完成モデル(=フェルトパックそのもの)をノードごとに配置する方式にしている。
// nodeTypeごとに使うモデルのキー。マス目のロジック(nodeType、12種)はそのまま維持し、
// 表示だけ実際に用意した11種のモデルへ集約する(branch→junction・item-box→item・start→normalは
// 旧2.5D仕様書のSPACE_VISUAL_MAPと同じ対応。startは専用の絵柄が無く、実際のスタート演出は
// 別途配置されるgate-start.glbが担うため、マス自体は無地のnormalパックでよい)。
const SNACK_SPACE_MODEL_KEY_MAP = {
  start: "normal",
  coin: "coin",
  income: "income",
  expense: "expense",
  normal: "normal",
  choice: "choice",
  "item-box": "item",
  job: "job",
  payday: "payday",
  shop: "shop",
  rest: "rest",
  branch: "junction",
};

// scale/yOffsetはThree.js Box3実機実測(空中ではなくシーン読み込み後の実測値)から算出。
// 全モデルとも横幅(X)は正規化されて2.0に揃っていたため直径1.0相当のscale=0.5を基本にしつつ、
// item/job/payday/shopは単一画像からの立体復元で縦(Y)方向が誇張され、そのままだとキャラクターより
// 高くなってしまったため、表示高さの上限(0.62)を超えないよう個別にscaleを絞った(2026-08-14実測)。
// yOffsetは各モデルの中心Yで、旧・共通シリンダー土台の底面だった-0.47(SPACE_GROUND_Y=-0.31から
// baseHeight0.16ぶん下)に底面が揃うよう、-0.47+(高さ/2×scale)で算出。
const SNACK_SPACE_MODEL_ASSETS = {
  normal: { url: new URL("./models/space-normal.glb", import.meta.url).href, scale: 0.5, yOffset: -0.3 },
  coin: { url: new URL("./models/space-coin.glb", import.meta.url).href, scale: 0.5, yOffset: -0.332 },
  income: { url: new URL("./models/space-income.glb", import.meta.url).href, scale: 0.5, yOffset: -0.269 },
  expense: { url: new URL("./models/space-expense.glb", import.meta.url).href, scale: 0.5, yOffset: -0.198 },
  choice: { url: new URL("./models/space-choice.glb", import.meta.url).href, scale: 0.5, yOffset: -0.297 },
  // 2026-08-16、item/job/payday/shopの4種だけ、他7種と違いアイコン面がY(上)ではなくZ(横)を
  // 向いた状態でエクスポートされており、マスが横倒しの筒のように見え「マークが見えない」
  // 不具合があった(利用者指摘、実機screenshotで確認)。rotationX(-90°)でアイコン面を上へ
  // 向け直す。scaleは回転後の新しい高さ軸(旧Z幅、実測1.925〜1.995)を基準に、他と同じ
  // 「表示高さ上限0.62」を満たすよう再計算した(半分の高さは常に0.31になるよう揃えているため
  // yOffsetは-0.16のまま変更不要)。
  item: { url: new URL("./models/space-item.glb", import.meta.url).href, scale: 0.3149, yOffset: -0.16, rotationX: -Math.PI / 2 },
  job: { url: new URL("./models/space-job.glb", import.meta.url).href, scale: 0.3221, yOffset: -0.16, rotationX: -Math.PI / 2 },
  payday: { url: new URL("./models/space-payday.glb", import.meta.url).href, scale: 0.3108, yOffset: -0.16, rotationX: -Math.PI / 2 },
  shop: { url: new URL("./models/space-shop.glb", import.meta.url).href, scale: 0.3113, yOffset: -0.16, rotationX: -Math.PI / 2 },
  rest: { url: new URL("./models/space-rest.glb", import.meta.url).href, scale: 0.5, yOffset: -0.265 },
  junction: { url: new URL("./models/space-junction.glb", import.meta.url).href, scale: 0.5, yOffset: -0.255 },
};

function snackSpaceModelKeyForNode(node) {
  return SNACK_SPACE_MODEL_KEY_MAP[node.nodeType] || "normal";
}

function matteMaterial(color, opts) {
  return new THREE.MeshStandardMaterial(Object.assign({ color, roughness: 0.82, metalness: 0 }, opts || {}));
}

// ガブリオンマス用の爪痕の石碑+紫の小さな炎(唯一プリミティブ形状のまま残す装飾)。
// 通常のフェルトパックモデルの上に追加で重ねて表示する(仕様書10章「通常マスシンボルより上書き表示」)。
// 炎は常時演出(updateSnackSpaceSymbolsで脈動させる)。
function createGaburionSymbol() {
  const group = new THREE.Group();
  const tablet = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.18, 0.32, 6), matteMaterial(0x6b6b76, { roughness: 0.95 }));
  tablet.position.y = 0.16;
  group.add(tablet);
  const clawMat = matteMaterial(0x5a2a5e, { roughness: 0.7 });
  [-0.06, 0, 0.06].forEach((dx, i) => {
    const claw = new THREE.Mesh(new THREE.BoxGeometry(0.015, 0.2, 0.01), clawMat);
    claw.position.set(dx, 0.2, 0.16);
    claw.rotation.z = 0.15 * (i - 1);
    group.add(claw);
  });
  const flame = new THREE.Mesh(
    new THREE.ConeGeometry(0.06, 0.16, 8),
    new THREE.MeshStandardMaterial({ color: 0x9b51e0, emissive: 0x6a1b9a, emissiveIntensity: 0.6, roughness: 0.4 })
  );
  flame.position.y = 0.42;
  group.add(flame);
  group.userData.flame = flame;
  return group;
}

let spaceSymbols = []; // [{ nodeId, group, family, node }]
let lastSymbolLodCameraPos = new THREE.Vector3();
let symbolLodInitialized = false;

// 各ノードへ、種類別のフェルトパックモデル(SNACK_SPACE_MODEL_ASSETS、土台+アイコン一体型)を
// 配置する。ガブリオンマスにはさらに石碑+炎を重ねて追加する。モデル読み込みはloadDecorationModel
// (既存の建物・小道具と同じ、キャッシュ済みテンプレートをcloneして非同期に追加するパターン)を使う。
function buildSpaceGroups(nodes) {
  spaceSymbols = [];
  nodes.forEach((n) => {
    const pos = nodePositions.get(n.id);
    const group = new THREE.Group();
    group.position.set(pos.x, pos.y, pos.z);
    scene.add(group);
    loadDecorationModel(group, SNACK_SPACE_MODEL_ASSETS[snackSpaceModelKeyForNode(n)]);
    if (n.gaburion) {
      const tablet = createGaburionSymbol();
      group.add(tablet);
      group.userData.flame = tablet.userData.flame;
    }
    spaceSymbols.push({ nodeId: n.id, group, family: n.gaburion ? "gaburion" : "space-model", node: n });
  });
  symbolLodInitialized = false;
}

// LOD(距離段階に応じた見え方の調整)とガブリオンの常時演出。
// - 近距離: 等倍表示。中〜遠距離: 画面上で小さく潰れないよう緩やかに拡大する(仕様書9章の
//   「画面上のマス直径が18〜22px未満にならないよう補正」の簡易実装、正確なpx計測はせず
//   カメラ距離から連続的にスケールする近似)。
// - ガブリオンの炎は常時脈動(仕様書10章)。
const SNACK_SYMBOL_LOD_NEAR = 14;
const SNACK_SYMBOL_LOD_FAR = 40;
const SNACK_SYMBOL_LOD_MAX_SCALE = 1.8;

function updateSnackSpaceSymbols(now) {
  if (!camera || !spaceSymbols.length) return;
  const cameraMoved = !symbolLodInitialized || camera.position.distanceToSquared(lastSymbolLodCameraPos) > 0.04;
  if (cameraMoved) {
    lastSymbolLodCameraPos.copy(camera.position);
    symbolLodInitialized = true;
  }
  spaceSymbols.forEach(({ group, family }) => {
    if (cameraMoved) {
      const dist = camera.position.distanceTo(group.position);
      const t = THREE.MathUtils.clamp((dist - SNACK_SYMBOL_LOD_NEAR) / (SNACK_SYMBOL_LOD_FAR - SNACK_SYMBOL_LOD_NEAR), 0, 1);
      const scale = 1 + t * (SNACK_SYMBOL_LOD_MAX_SCALE - 1);
      group.scale.setScalar(scale);
    }
    if (family === "gaburion" && group.userData.flame) {
      const pulse = 0.75 + Math.sin(now / 260) * 0.25;
      group.userData.flame.scale.setScalar(pulse);
      group.userData.flame.material.emissiveIntensity = 0.45 + pulse * 0.3;
    }
  });
}

// P1〜P4固定色。snack-data.jsのSNACK_PLAYER_COLORSと値を一致させること。ES module(このファイル)
// はclassic script側の`const`宣言をグローバル経由で参照できないため(windowにも乗らない)、
// SPECIES_MODEL_MAP等と同様に値をそのまま複製している。
const SNACK_PLAYER_COLOR_HEX = [0x2f80ed, 0xeb5757, 0x9b51e0, 0x27ae60];
function snackPlayerColorHex(seatNumber) {
  return SNACK_PLAYER_COLOR_HEX[(seatNumber - 1 + SNACK_PLAYER_COLOR_HEX.length) % SNACK_PLAYER_COLOR_HEX.length];
}

let renderer = null;
let scene = null;
let camera = null;
let characters = new Map(); // playerId -> entry
let nodeMap = new Map(); // nodeId -> node
let nodePositions = new Map(); // nodeId -> THREE.Vector3
let mascotEntries = new Map(); // nodeId -> { group, model, baseY } (フェーズE: 同時出現数2以上化)
let focusPlayerId = null;
let isMoving = false; // 追従対象(focusPlayerId)が現在ホップ移動中かどうか
let animationFrameId = null;
let sceneGeneration = 0;
const cameraCurrentPos = new THREE.Vector3();
let trapMarkerEntries = new Map(); // nodeId -> THREE.Group(発動中の罠マーカー)
let playerRings = new Map(); // playerId -> { group, seatNumber }
let diceMesh = null;
let diceAnim = null; // { playerId, mesh, startTime, settled, resolve }
const diceFaceTextureCache = {};

// ---- マップ紹介フライスルー・全体表示・ズームで使うカメラモード ----
// "follow"(通常の駒追従、既定) | "intro"(開始時のマップ紹介、専用rAFループが直接カメラを操作) |
// "overview"(マップ全体固定俯瞰) | "zoom"(overview基準の拡大+ドラッグパン) |
// "diceFocus"(サイコロを振る手番プレイヤーへ寄る演出) | "branchOverview"(分岐マスの俯瞰) |
// "snackReveal"(おやつ地点を周回して見せる演出) | "orderLineup"(行動順決めサイコロで
// 対象プレイヤーを横一列に並べて正面から見せる演出)
let cameraMode = "follow";
// 行動順決め演出(enterOrderLineup)。orderLineupIdsは現在整列中の対象(カメラのフレーミング用、
// 同点再抽選時は再抽選対象のみに絞られる)。orderLineupAllIdsは一連の流れ(同点再抽選の再帰呼び出し
// を含む)で一度でも整列させた全員の累積で、exitOrderLineup時にまとめて元のノード位置へ戻すために使う
// (orderLineupIdsだけを見て戻すと、再抽選で対象から外れたプレイヤーが整列位置に置き去りになるため)。
let orderLineupIds = [];
let orderLineupAllIds = [];
let mapBounds = null; // { centerX, centerZ, halfX, halfZ }
// 浮島本体(地面+外周スカート)の実半径。ノード座標だけのmapBounds.halfX/halfZより一回り
// 大きい(建物・木・岩が浮島の縁付近まで並ぶため)。全体表示カメラの距離計算はノード座標では
// なくこちらを基準にする(2026-08-13、Codexレビュー「全体表示でも中央部分しか見えない」対応)。
let islandRadius = { x: 14, z: 10 };
// 浮島の中心(=マス群のバウンディングボックス中心、buildScene冒頭で設定)。terrainHeightAtが
// islandRadiusとあわせて参照する。
let islandCenter = { x: 0, z: 0 };

// ==================== 地形の高低差(2026-08-15、利用者仕様書「地面を完全な平面にせず、
// 中央を少し高く、外周をわずかに低く」対応) ====================
// あくまで見た目のY座標のみに使う値で、ゲームロジック(ノードのx,z座標・停止判定・当たり判定)には
// 一切使わない・影響させない。中心(t=0)ほど高く、外周(t=1)ほど低く、なめらかに変化する。
// 2026-08-15、一度は自作BufferGeometryのテクスチャ潰れ不具合により振幅0で無効化していたが、
// 同日中にcreateIslandGroundGeometryをTHREE.CircleGeometryベースの実装へ作り直して解決した
// (詳細はcreateIslandGroundGeometryのコメント参照)ため、振幅を戻して有効化した。
const TERRAIN_CENTER_LIFT = 0.3;
const TERRAIN_EDGE_DROP = 0.2;
function terrainHeightForT(t) {
  const tt = THREE.MathUtils.clamp(t, 0, 1);
  const s = tt * tt * (3 - 2 * tt); // smoothstep
  return THREE.MathUtils.lerp(TERRAIN_CENTER_LIFT, -TERRAIN_EDGE_DROP, s);
}
function terrainHeightAt(worldX, worldZ) {
  const nx = (worldX - islandCenter.x) / (islandRadius.x || 1);
  const nz = (worldZ - islandCenter.z) / (islandRadius.z || 1);
  return terrainHeightForT(Math.sqrt(nx * nx + nz * nz));
}

// ==================== 地区別の芝色ブレンド(2026-08-15) ====================
// 利用者仕様書「駅前・公共・住宅・教会・公園・中央庭園で、芝の色と整い方を5〜10%程度変える」対応。
// snack-data.jsのSNACK_OUTER_ZONES(角度レンジによる地区分け)と同じ考え方を、ES module側でも
// 使えるようそのまま複製している(SPECIES_MODEL_MAP等、他の値と同様の既存パターン)。
// 色はCodex作成の地区別カラースワッチ(クロコ確認フォルダのプレビューシート)から抽出した実測値。
const SNACK_TERRAIN_OUTER_COUNT = 18;
const SNACK_TERRAIN_ZONE_RANGES = [
  { name: "station", from: 16, to: 1 },
  { name: "civic", from: 2, to: 5 },
  { name: "residential", from: 6, to: 8 },
  { name: "church", from: 9, to: 12 },
  { name: "park", from: 13, to: 15 },
];
const SNACK_TERRAIN_ZONE_COLORS = {
  station: 0x949f33,
  civic: 0x869835,
  residential: 0x939e35,
  church: 0x829332,
  park: 0x879e32,
  central: 0x8c9b33,
};
const SNACK_TERRAIN_BASE_COLOR = 0x8e9932;
// 中央庭園エリアとみなす半径(0=中心,1=外周)のしきい値。中央広場(半径3.7程度)を覆う範囲。
const SNACK_TERRAIN_CENTRAL_RADIUS_T = 0.32;

// ground.rotation.x=-Math.PI/2の変換により、ジオメトリのローカルy(=通常マス配置の角度計算で
// いう「奥行き」)はワールドZ座標の符号反転にあたる(nodeVec3のワールドx,zにおける
// theta=-π/2+(i/18)*2πの定義と揃えるための補正)。
function terrainZoneColorForLocalXY(localX, localY, radiusX, radiusZ) {
  const nx = localX / (radiusX || 1);
  const nzForTheta = -localY / (radiusZ || 1);
  const t = Math.sqrt(nx * nx + nzForTheta * nzForTheta);
  if (t < SNACK_TERRAIN_CENTRAL_RADIUS_T) return SNACK_TERRAIN_ZONE_COLORS.central;
  const theta = Math.atan2(nzForTheta, nx);
  let i = Math.round(((theta + Math.PI / 2) / (Math.PI * 2)) * SNACK_TERRAIN_OUTER_COUNT);
  i = ((i % SNACK_TERRAIN_OUTER_COUNT) + SNACK_TERRAIN_OUTER_COUNT) % SNACK_TERRAIN_OUTER_COUNT;
  const zone = SNACK_TERRAIN_ZONE_RANGES.find((z) => (z.from <= z.to ? i >= z.from && i <= z.to : i >= z.from || i <= z.to));
  return zone ? SNACK_TERRAIN_ZONE_COLORS[zone.name] : SNACK_TERRAIN_BASE_COLOR;
}
const SNACK_FOG_FOLLOW = { near: 16, far: 40 };
// 全体表示・ズーム中は追従時より奥行きが必要なため霞を大幅に弱める(利用者仕様書11章)。
const SNACK_FOG_OVERVIEW = { near: 40, far: 140 };
let zoomState = { level: 1.9, panX: 0, panZ: 0 };
let zoomPointerActive = false;
let zoomLastX = 0;
let zoomLastY = 0;
let diceFocusPlayerId = null;
let branchOverviewNodeId = null;
let snackRevealNodeId = null;
let snackRevealStartTime = 0;
// おやつ地点と一緒に画面へ収める「現在地」の世界座標(通常はプレイヤーの現在地)。
// 2026-08-16、以前はおやつ地点だけを近距離で周回するだけで場所の把握がしづらいという
// 指摘を受け追加。空配列の場合は従来通りおやつ地点だけの近距離周回にフォールバックする。
let snackRevealContextPositions = [];

function computeMapBounds() {
  if (!nodePositions.size) return { centerX: 0, centerZ: 0, halfX: 10, halfZ: 10 };
  const xs = [...nodePositions.values()].map((v) => v.x);
  const zs = [...nodePositions.values()].map((v) => v.z);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minZ = Math.min(...zs);
  const maxZ = Math.max(...zs);
  return { centerX: (minX + maxX) / 2, centerZ: (minZ + maxZ) / 2, halfX: (maxX - minX) / 2 || 10, halfZ: (maxZ - minZ) / 2 || 10 };
}

function nodeVec3(node) {
  return new THREE.Vector3(node.position.x, terrainHeightAt(node.position.x, node.position.z), node.position.z);
}

function loadRepeatingTexture(url, width, depth, isColorData) {
  const texture = textureLoader.load(url);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(width / 3, depth / 3);
  // sRGBで読むのはBaseColorのみ(Normal/Roughness/AOはリニアのまま、Codex仕様書の合格条件通り)。
  if (isColorData) texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

// BaseColor(sRGB)+Normal/Roughness/AO(リニア)をまとめて読み込む。地区別6枚は常時読み込まず、
// 共通BaseColor1枚+既存vertex color(createIslandGroundGeometryのcolor属性)による地区色付けを
// 第一候補として採用(Codex回答2026-08-15、スマホのGPUメモリ・サンプリング負荷を優先)。
function loadGroundMaps(width, depth) {
  return {
    map: loadRepeatingTexture(GROUND_BASECOLOR_URL, width, depth, true),
    normalMap: loadRepeatingTexture(GROUND_NORMAL_URL, width, depth, false),
    roughnessMap: loadRepeatingTexture(GROUND_ROUGHNESS_URL, width, depth, false),
    aoMap: loadRepeatingTexture(GROUND_AO_URL, width, depth, false),
  };
}

// zoneNameのループを、startIdからnextNodeIds(同じzone側)を辿って順序復元する
// (id命名規則に依存せず、データが多少組み替わっても壊れないようにするため)。
// 外周・内周とも同じ手法で閉ループの点列を作れる(2026-08-12、内周も見本通りそれ自体が
// 閉じたループになったため、従来の「分岐→合流の一本道」専用関数から汎用化した)。
function computeLoopPoints(startId, zoneName) {
  const start = nodeMap.get(startId);
  const points = [];
  let cur = start;
  const seen = new Set();
  while (cur && !seen.has(cur.id)) {
    points.push(nodeVec3(cur));
    seen.add(cur.id);
    const nextId = cur.nextNodeIds.find((id) => nodeMap.get(id) && nodeMap.get(id).zone === zoneName);
    cur = nextId ? nodeMap.get(nextId) : null;
  }
  return points;
}

// 外周⇔接続⇔内周を結ぶ区間の両端点列を作る。zone(outer/connector/inner)をまたぐ
// nextNodeIdsの辺をすべて拾う汎用実装(2026-08-13、32マス化で接続マスが外周・内周とは
// 別の独立ノードになったため、「outerノードのzoneをまたぐ辺」という一般化した条件に変更。
// 特定のzone名を決め打ちしないため、将来zoneの種類が増えても変更不要)。
function computeConnectorSegments() {
  const segments = [];
  nodeMap.forEach((node) => {
    node.nextNodeIds.forEach((nextId) => {
      const next = nodeMap.get(nextId);
      if (next && next.zone !== node.zone) segments.push([nodeVec3(node), nodeVec3(next)]);
    });
  });
  return segments;
}

// nextNodeIdsの辺すべて(ゾーンをまたぐかどうかを問わない)を道の実際の線分として集める。
// 2026-08-16、分岐ノード付近では複数方向へ道が伸びるため、建物を「ノードの中心から外側へ」
// 単純に押し出すだけだと、その方向に別の道(接続マスへのスプール等)が通っていて建物が
// 道に食い込む不具合があった(利用者からの指摘で発覚、教会ゾーン等で実際に確認)。
// 建物候補位置がどの道の線分にも近すぎないかをこの一覧でチェックする。
function collectAllRoadSegments() {
  const segments = [];
  nodeMap.forEach((node) => {
    node.nextNodeIds.forEach((nextId) => {
      const next = nodeMap.get(nextId);
      if (next) segments.push([nodeVec3(node), nodeVec3(next)]);
    });
  });
  return segments;
}

// 点pointから線分a-bまでの最短距離(XZ平面、道は概ね平坦なのでYは無視する)。
function distanceToSegmentXZ(point, a, b) {
  const abx = b.x - a.x;
  const abz = b.z - a.z;
  const lenSq = abx * abx + abz * abz;
  let t = lenSq > 1e-9 ? ((point.x - a.x) * abx + (point.z - a.z) * abz) / lenSq : 0;
  t = Math.max(0, Math.min(1, t));
  const cx = a.x + abx * t;
  const cz = a.z + abz * t;
  const dx = point.x - cx;
  const dz = point.z - cz;
  return Math.sqrt(dx * dx + dz * dz);
}

function distanceToAnySegment(point, segments) {
  let min = Infinity;
  for (const [a, b] of segments) {
    const d = distanceToSegmentXZ(point, a, b);
    if (d < min) min = d;
  }
  return min;
}

// 道の中心(from)から建物の位置(to)まで、幅の狭い「私道」を1本敷く(2026-08-16、
// 「家から道じゃない見た目強化の道が伸びているか」という利用者からの指摘に対応)。
// buildRibbon(本編の道リボン)と同じ考え方だが、道幅は約1/3(0.22)に抑えて
// 「玄関先の小道」に見えるようにしている。
function buildDrivewayStub(from, to) {
  const dir = new THREE.Vector3(to.x - from.x, 0, to.z - from.z);
  if (dir.lengthSq() < 1e-6) return null;
  dir.normalize();
  const normal = new THREE.Vector3(-dir.z, 0, dir.x);
  const halfWidth = 0.22;
  const positions = [];
  const uvs = [];
  [from, to].forEach((p, i) => {
    const left = p.clone().addScaledVector(normal, halfWidth);
    const right = p.clone().addScaledVector(normal, -halfWidth);
    positions.push(left.x, p.y - 0.44, left.z, right.x, p.y - 0.44, right.z);
    uvs.push(0, i, 1, i);
  });
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex([0, 2, 1, 1, 2, 3]);
  geometry.computeVertexNormals();
  const texture = textureLoader.load(ROAD_TEXTURE_URL);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  const mesh = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ map: texture }));
  mesh.receiveShadow = true;
  return mesh;
}

// 外周ループを順序復元しつつ、分岐ノード(接続マスへの入口)がループの何%地点にあるかを返す。
// playMapIntroの「分岐点付近で速度を落とす」演出用(2026-08-13、32マス化でノード数・分岐位置が
// 変わったため、id命名規則やノード数を決め打ちしないId順序復元ベースの汎用実装に変更)。
function computeBranchSlowPoints() {
  const outerNodes = [...nodeMap.values()].filter((n) => n.zone === "outer");
  if (!outerNodes.length) return [];
  const start = outerNodes.find((n) => n.nodeType === "start") || outerNodes[0];
  const orderedIds = [];
  const seen = new Set();
  let cur = start;
  while (cur && !seen.has(cur.id)) {
    orderedIds.push(cur.id);
    seen.add(cur.id);
    const nextId = cur.nextNodeIds.find((id) => nodeMap.get(id) && nodeMap.get(id).zone === "outer");
    cur = nextId ? nodeMap.get(nextId) : null;
  }
  const total = orderedIds.length || 1;
  return orderedIds
    .map((id, idx) => (nodeMap.get(id).nodeType === "branch" ? idx / total : null))
    .filter((v) => v !== null);
}

// board3d.jsのcreateRoadRibbonと同じ考え方(接線の法線方向に道幅ぶん左右へ広げてリボン化)を
// 汎用の点配列向けに書き直したもの。closed=trueで最後の点から最初の点へ閉じたループにする。
function buildRibbon(points, closed) {
  const texture = textureLoader.load(ROAD_TEXTURE_URL);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.colorSpace = THREE.SRGBColorSpace;

  const n = points.length;
  const positions = [];
  const uvs = [];
  const indices = [];
  let uAccum = 0;
  for (let i = 0; i < n; i++) {
    const p = points[i];
    const prev = points[closed ? (i - 1 + n) % n : Math.max(0, i - 1)];
    const next = points[closed ? (i + 1) % n : Math.min(n - 1, i + 1)];
    const tangent = new THREE.Vector3(next.x - prev.x, 0, next.z - prev.z);
    if (tangent.lengthSq() < 1e-6) tangent.set(1, 0, 0);
    tangent.normalize();
    const normal = new THREE.Vector3(-tangent.z, 0, tangent.x);
    const left = p.clone().addScaledVector(normal, ROAD_HALF_WIDTH);
    const right = p.clone().addScaledVector(normal, -ROAD_HALF_WIDTH);
    // 2026-08-15、地形の高低差(terrainHeightAt)に追従するよう、固定の-0.45ではなく
    // 経路点pの実際のY(nodeVec3で地形高さ込み)を基準にする。
    positions.push(left.x, p.y - 0.45, left.z, right.x, p.y - 0.45, right.z);
    if (i > 0) uAccum += p.distanceTo(points[i - 1]) / (ROAD_HALF_WIDTH * 2);
    uvs.push(uAccum, 0, uAccum, 1);
  }
  const segCount = closed ? n : n - 1;
  for (let i = 0; i < segCount; i++) {
    const a = i * 2;
    const b = i * 2 + 1;
    const c = ((i + 1) % n) * 2;
    const d = ((i + 1) % n) * 2 + 1;
    indices.push(a, c, b, b, c, d);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  const mesh = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ map: texture }));
  mesh.receiveShadow = true;
  return mesh;
}

// 地面を矩形ではなく楕円形にし(見本の「フェルト製の島」らしい輪郭に近づける)。
// 2026-08-15、中央を高く外周を低くするドーム状ジオメトリを自作BufferGeometry(手動で
// position/uv/index配列を組み立てる同心リング方式)で試作したところ、テクスチャを貼ると
// 原因不明のまま白っぽく潰れる不具合が発生し解決できなかった(UV正規化・法線・頂点カラー
// 有無・repeat値などを広く切り分けたが再現条件を特定できず、一旦振幅0で無効化して見送った)。
// 同一セッションの再挑戦で、**THREE.CircleGeometry(単位円、texture付きで正常動作することを
// 既に確認済み)を土台にして頂点位置だけを書き換える方式**に変更したところ問題なく描画できた。
// 自作のindex/属性配列構築の何かに原因があったと推測されるが、根本原因はThree.js内部の
// CircleGeometryの構築方法をそのまま踏襲することで迂回した(index・法線もCircleGeometryの
// ものをベースにcomputeVertexNormals()で再計算するのみで、独自には組み立てない)。
function createIslandGroundGeometry(radiusX, radiusZ) {
  const segments = 64;
  const geometry = new THREE.CircleGeometry(1, segments);
  const pos = geometry.attributes.position;
  const uv = new Float32Array(pos.count * 2);
  const colors = new Float32Array(pos.count * 3);
  const tmpColor = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    // CircleGeometryの単位円ローカル座標(-1〜1)を落下前の楕円形ワールド寸法へ展開しつつ、
    // 中心からの距離tでterrainHeightForTを評価してZ(このメッシュはXY平面、後段でX軸-90°回転
    // されてYが上になる)へ高低差を焼き込む。UV・地区色もこのワールド寸法基準で計算し、
    // loadRepeatingTextureのrepeat.set(width/3,depth/3)と同じ/3係数で揃える。
    const nx = pos.getX(i);
    const ny = pos.getY(i);
    const t = Math.min(1, Math.sqrt(nx * nx + ny * ny));
    const worldX = nx * radiusX;
    const worldY = ny * radiusZ;
    pos.setXYZ(i, worldX, worldY, terrainHeightForT(t));
    uv[i * 2] = worldX / 3;
    uv[i * 2 + 1] = worldY / 3;
    tmpColor.setHex(terrainZoneColorForLocalXY(worldX, worldY, radiusX, radiusZ));
    colors[i * 3] = tmpColor.r;
    colors[i * 3 + 1] = tmpColor.g;
    colors[i * 3 + 2] = tmpColor.b;
  }
  pos.needsUpdate = true;
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  // aoMap(Three.jsの仕様でuv2が無いと適用されない)は専用のUV展開を持たないため、
  // 同じuvをuv2としても登録する(AOはリピートタイル柄の陰影付けなので流用で問題ない)。
  geometry.setAttribute("uv2", new THREE.Float32BufferAttribute(uv, 2));
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  geometry.computeVertexNormals();
  return geometry;
}

// 島の側面(台座)用の縦グラデーションテクスチャ(芝生の緑→クリーム→キャメル→こげ茶)。
// Codex連携チャットが用意していたterrain-island-edge.pngは実ファイルが見つからなかったため、
// createDiceFaceTextureと同じCanvas手続き生成で代替する(2026-08-12)。
// 2026-08-16、「島の縁が薄い板のように見える」という指摘を受け、単色グラデーションの帯に
// 岩の地層っぽいノイズ状の濃淡を重ねた(縦方向に不規則な明暗の横縞を焼き込むことで、
// 遠目にも「均質な板」ではなく「積み重なった岩肌」に見えるようにする狙い)。
function createIslandSkirtTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 16;
  canvas.height = 256;
  const ctx = canvas.getContext("2d");
  const gradient = ctx.createLinearGradient(0, 0, 0, 256);
  gradient.addColorStop(0, "#6fa84f");
  gradient.addColorStop(0.22, "#e7d9ad");
  gradient.addColorStop(0.55, "#c99a5b");
  gradient.addColorStop(1, "#5c3f24");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 16, 256);
  // 岩の地層ノイズ: 疑似乱数(seed固定)で横縞状の濃淡帯を重ね塗りする
  let seed = 42;
  const rand = () => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return (seed % 1000) / 1000;
  };
  for (let y = 40; y < 256; y += 1) {
    const band = Math.sin(y * 0.25) * 0.5 + rand() * 0.5;
    if (band > 0.72) {
      ctx.fillStyle = `rgba(60, 38, 20, ${0.1 + rand() * 0.12})`;
      ctx.fillRect(0, y, 16, 1 + Math.floor(rand() * 2));
    } else if (band < -0.55) {
      ctx.fillStyle = `rgba(255, 244, 214, ${0.08 + rand() * 0.1})`;
      ctx.fillRect(0, y, 16, 1);
    }
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapT = THREE.RepeatWrapping;
  return texture;
}

// 地面の楕円の縁から下方向・外方向へ傾斜する帯状メッシュ(buildRibbonと同じ考え方の
// リング状ジオメトリ)。マップ全体を「厚みのあるフェルト土台」に見せる。
// 2026-08-16、「縁が平たい板のように見える(浮島の説得力が弱い)」という指摘への対応。
// 従来は上端(地面と同じ完全な楕円)→下端(6%だけ外側に広がるだけ)の単純な1段帯だった
// ため、ほぼ垂直な板にしか見えなかった。①上端はそのまま(地面メッシュと縫い目なく
// 繋がる必要があるため半径は変更しない)、②中段リングを追加し外側へ大きく張り出させて
// 「岩がせり出した」ような厚みを出す、③下段リングは中心側へ絞り込んで浮島特有の
// 「下に向かって細くなる」シルエットにする、という3段構成に変更。角度ごとに複数の
// 正弦波を重ねた疑似ノイズで半径をわずかに揺らし、真円/真楕円に見えない不規則な
// 岩肌のシルエットにした(上端だけは地面との継ぎ目のため揺らさない)。
function createIslandEdgeSkirt(centerX, centerZ, radiusX, radiusZ, depth) {
  const segments = 64;
  // 地面リングの外周(t=1)の高さに合わせる(2026-08-15、外周を低くした地形と縁がずれないように)。
  const edgeY = -0.5 + terrainHeightForT(1);

  function edgeNoise(angle) {
    return (
      Math.sin(angle * 5) * 0.5 +
      Math.sin(angle * 11 + 1.7) * 0.3 +
      Math.sin(angle * 23 + 4.1) * 0.2
    );
  }

  const positions = [];
  const uvs = [];
  const indices = [];
  const ringCount = 3; // 上端(地面境界)・中段(張り出し)・下段(先細り)
  for (let i = 0; i <= segments; i++) {
    const angle = (i / segments) * Math.PI * 2;
    const noise = edgeNoise(angle);
    // 上端: 地面メッシュのちょうど縁(半径そのまま、揺らさない)
    positions.push(centerX + Math.cos(angle) * radiusX, edgeY, centerZ + Math.sin(angle) * radiusZ);
    uvs.push(0, 0);
    // 中段: 外側へ張り出す岩の縁(12〜20%外側、角度ごとに不規則)
    const midScale = 1.16 + noise * 0.04;
    positions.push(
      centerX + Math.cos(angle) * radiusX * midScale,
      edgeY - depth * 0.4,
      centerZ + Math.sin(angle) * radiusZ * midScale
    );
    uvs.push(0, 0.45);
    // 下段: 中心側へ絞り込む先細りの底(中段の68〜78%程度)
    const botScale = midScale * (0.73 + noise * 0.05);
    positions.push(
      centerX + Math.cos(angle) * radiusX * botScale,
      edgeY - depth,
      centerZ + Math.sin(angle) * radiusZ * botScale
    );
    uvs.push(0, 1);
  }
  for (let i = 0; i < segments; i++) {
    for (let ring = 0; ring < ringCount - 1; ring++) {
      const a = i * ringCount + ring;
      const b = i * ringCount + ring + 1;
      const c = (i + 1) * ringCount + ring;
      const d = (i + 1) * ringCount + ring + 1;
      indices.push(a, c, b, b, c, d);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  const mesh = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ map: createIslandSkirtTexture(), roughness: 1 }));
  mesh.receiveShadow = true;
  return mesh;
}

function loadDecorationModel(owner, config) {
  const generation = sceneGeneration;
  loadGLTFSceneCached(config.url)
    .then((template) => {
      if (generation !== sceneGeneration) return;
      const model = template.clone(true);
      model.scale.setScalar(config.scale);
      model.position.y = config.yOffset;
      if (config.rotationX) model.rotation.x = config.rotationX;
      model.traverse((node) => {
        if (node.isMesh) {
          node.castShadow = true;
          node.receiveShadow = true;
        }
      });
      owner.add(model);
    })
    .catch((err) => {
      console.warn("おやつ集めモード: 装飾モデルの読み込みに失敗", config.url, err);
    });
}

function placeStageDecorations(nodes, centerX, centerZ, halfX, halfZ) {
  const zonePropPositions = [];

  // 2026-08-16、分岐ノード付近では複数方向へ道が伸びているため、「ノード中心から外側へ
  // offsetぶん押し出す」だけの配置だと、その方向にたまたま別の道(接続マスへのスプール等)が
  // 通っていて建物が道に食い込む不具合があった(利用者指摘、実機で複数箇所確認)。
  // 候補位置がどの道の線分にも近すぎる場合、角度・距離をずらして再試行する
  // (押し出す方向がスプール道とほぼ平行なケースは距離を伸ばすだけでは避けられないため、
  // 角度も振る)。
  const roadSegments = collectAllRoadSegments();
  // 2026-08-16、当初は道の中心線から一律0.55の余白しか見ておらず、大きな建物モデル
  // (Meshy標準パイプラインで水平寸法が約2.0に正規化される慣例、config.scaleを掛けた分だけ
  // 実際の見た目の半幅がある)だと、アンカー座標は道から離れていても建物本体の手前側が
  // 道にめり込んで見える不具合が残っていた(実測デバッグで確認: building-house scale1.269は
  // 半幅約1.27あり、offset1.9でもほぼ道に接する計算になっていた)。config.scaleから建物本体の
  // 半幅を見積もり、道の半幅と合わせて必要な余白を建物ごとに動的に決める。
  function roadClearanceFor(config) {
    const footprintHalfWidth = (config && config.scale ? config.scale : 0.4) * 1.0;
    return ROAD_HALF_WIDTH + footprintHalfWidth + 0.5;
  }

  // 2026-08-16、押し出し先の座標でterrainHeightAtを再計算せず、元ノードの高さをそのまま
  // 使っていたため、この関数の押し出し方向(中心→外側、島の傾斜方向そのもの)と組み合わさって
  // 建物・木・ベンチが実際の地面より高い/低い位置に浮いて見える不具合があった(利用者指摘)。
  // 採用が決まった候補のx/zで地面の高さを取り直してから返す。
  function resolveClearOutwardPosition(pos, offset, config, opts) {
    const dir = new THREE.Vector3(pos.x - centerX, 0, pos.z - centerZ).normalize();
    // gate-start(道をまたぐアーチ)のように、意図的に道の真上へ配置する装飾は対象外にする。
    if (opts && opts.straddleRoad) {
      const worldPos = pos.clone().addScaledVector(dir, offset);
      worldPos.y = terrainHeightAt(worldPos.x, worldPos.z);
      return { worldPos, dir };
    }
    const clearance = roadClearanceFor(config);
    for (const angleDeg of [0, -18, 18, -34, 34]) {
      const angle = (angleDeg * Math.PI) / 180;
      const candidateDir = dir.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), angle);
      for (let extra = 0; extra <= 5; extra++) {
        const candidate = pos.clone().addScaledVector(candidateDir, offset + extra * 0.7);
        const conflict = zonePropPositions.some((p) => p.distanceTo(candidate) < SNACK_ZONE_PROP_MIN_GAP);
        const onRoad = distanceToAnySegment(candidate, roadSegments) < clearance;
        if (!conflict && !onRoad) {
          candidate.y = terrainHeightAt(candidate.x, candidate.z);
          return { worldPos: candidate, dir };
        }
      }
    }
    return null;
  }

  // ノードの位置を中心から外側へoffset分押し出した位置にownerを配置する共通ヘルパー
  // (中心を向く方角に応じてrotation.yも設定する。既存の各種装飾配置で繰り返していたパターン)。
  // opts.drivewayを立てると、ノード(道)から建物までの間に「見た目強化用の小道」を敷く
  // (2026-08-16、「家から道じゃない道が伸びているか」という利用者指摘への対応)。
  // opts.straddleRoadを立てると道回避を無効化する(スタートゲートのように道をまたぐ意図の装飾用)。
  function placeOutwardDecoration(pos, offset, config, opts) {
    const resolved = resolveClearOutwardPosition(pos, offset, config, opts);
    if (!resolved) return null;
    const { worldPos, dir } = resolved;
    const group = new THREE.Group();
    group.position.copy(worldPos);
    group.rotation.y = Math.atan2(-dir.x, -dir.z);
    scene.add(group);
    loadDecorationModel(group, config);
    if (opts && opts.driveway) {
      const stub = buildDrivewayStub(pos, worldPos);
      if (stub) scene.add(stub);
    }
    return worldPos;
  }

  function tryPlaceZoneProp(pos, offset, modelKey, opts) {
    const config = SNACK_ZONE_MODELS[modelKey];
    if (!config) return;
    const placed = placeOutwardDecoration(pos, offset, config, opts);
    if (placed) zonePropPositions.push(placed);
  }

  const jobNode = nodes.find((n) => n.nodeType === "job");
  if (jobNode) {
    const pos = nodePositions.get(jobNode.id);
    const placed = placeOutwardDecoration(pos, 1.7, SNACK_STAGE_MODELS.jobCenter, { driveway: true });
    if (placed) zonePropPositions.push(placed);
  }

  // 中央広場(円形タイル+肉球噴水)。CREDITS.mdの用途通り、マップの中心にまとめて設置する。
  // 2026-08-13(第3弾)、利用者仕様書に沿って2.2倍(SNACK_STAGE_MODELS側でscale調整済み)に
  // 拡大し、マップ全体の視線の中心として主役化。周囲に花壇・ベンチ・街灯をリング状に配置し、
  // 内周ルートから庭園がよく見えるよう高い建物は寄せない(周辺装飾は花壇・ベンチ・街灯のみ)。
  const centerGroundY = terrainHeightAt(centerX, centerZ);
  const plazaGroup = new THREE.Group();
  plazaGroup.position.set(centerX, centerGroundY, centerZ);
  scene.add(plazaGroup);
  loadDecorationModel(plazaGroup, SNACK_STAGE_MODELS.plazaCircle);
  const fountainGroup = new THREE.Group();
  fountainGroup.position.set(centerX, centerGroundY, centerZ);
  scene.add(fountainGroup);
  loadDecorationModel(fountainGroup, SNACK_STAGE_MODELS.pawFountain);

  const plazaRingRadius = 3.7; // 拡大後のplazaCircle(目標直径6.6)の外側に収まる半径
  const plazaRingCount = 6;
  for (let i = 0; i < plazaRingCount; i++) {
    const angle = (i / plazaRingCount) * Math.PI * 2 + Math.PI / plazaRingCount;
    const px = centerX + Math.cos(angle) * plazaRingRadius;
    const pz = centerZ + Math.sin(angle) * plazaRingRadius;
    const group = new THREE.Group();
    group.position.set(px, terrainHeightAt(px, pz), pz);
    group.rotation.y = angle;
    scene.add(group);
    // 花壇・ベンチ・街灯を交互に配置(低木の専用素材は無いため、既存の花壇素材で代替)
    const modelKey = i % 3 === 0 ? "prop-bench" : i % 3 === 1 ? "prop-streetlamp" : null;
    if (modelKey) loadDecorationModel(group, SNACK_ZONE_MODELS[modelKey]);
    else loadDecorationModel(group, SNACK_STAGE_MODELS.flowerbed);
    zonePropPositions.push(group.position);
  }

  // おやつ候補・ガブリオン等の重要マスは避け、それ以外の外周マス(通常/収入/支出/選択)を
  // 幅広く花壇候補にする(2026-08-13、32マス化で純粋な"normal"ノードが2箇所しかなく
  // 従来の絞り込みでは花壇がほぼ置けなくなっていたため対象種別を広げた)。
  // 2026-08-16、civic/residential/church/parkゾーンのノードは後段の地区別建物ループで
  // 同じノードのすぐ近く(offset1.3の花壇 vs offset1.6〜2.1の建物/木、差0.3〜0.8)に
  // 建物や木を配置するため、SNACK_ZONE_PROP_MIN_GAP(2.4)未満で衝突し、後から配置される
  // 建物側がサイレントに欠落するバグがあった(デバッグログで実測して確認、教会地区で
  // facility-church/building-houseが2棟ロストしていた)。地区の建物密度を優先し、
  // 花壇候補はゾーン建物と競合しないstation(建物なし)ノードのみに絞る。
  const flowerNodes = nodes
    .filter((n) => n.zone === "outer" && n.buildingZone === "station" && !n.snackSpawnCandidate && !n.gaburion && ["normal", "income", "expense", "choice"].includes(n.nodeType))
    .slice(0, 6);
  flowerNodes.forEach((n) => {
    const pos = nodePositions.get(n.id);
    const placed = placeOutwardDecoration(pos, 1.3, SNACK_STAGE_MODELS.flowerbed);
    if (placed) zonePropPositions.push(placed);
  });

  // 島の縁に沿って点在させる簡易な岩(専用GLBが無いため、低ポリの正二十面体を粗いグレー
  // マテリアルで手続き生成する。利用者仕様書4章「部分的な岩」への簡易対応)。
  const rockCount = 10;
  const rockGeo = new THREE.IcosahedronGeometry(0.4, 0);
  const rockMat = new THREE.MeshStandardMaterial({ color: 0x9c948a, roughness: 1, flatShading: true });
  for (let i = 0; i < rockCount; i++) {
    const angle = (i / rockCount) * Math.PI * 2 + 0.4;
    const rx = centerX + Math.cos(angle) * (halfX * 1.28 + 1.5);
    const rz = centerZ + Math.sin(angle) * (halfZ * 1.28 + 1.5);
    const rock = new THREE.Mesh(rockGeo, rockMat);
    const s = 0.35 + (i % 3) * 0.18;
    rock.scale.set(s, s * 0.7, s);
    rock.position.set(rx, -0.42 + terrainHeightAt(rx, rz), rz);
    rock.rotation.set(i * 0.7, i * 1.3, i * 0.4);
    rock.receiveShadow = true;
    rock.castShadow = true;
    scene.add(rock);
  }

  const hillCount = 6;
  for (let i = 0; i < hillCount; i++) {
    const angle = (i / hillCount) * Math.PI * 2;
    const hx = centerX + Math.cos(angle) * (halfX * 1.55 + 2);
    const hz = centerZ + Math.sin(angle) * (halfZ * 1.55 + 2);
    const group = new THREE.Group();
    group.position.set(hx, terrainHeightAt(hx, hz), hz);
    group.rotation.y = angle;
    scene.add(group);
    loadDecorationModel(group, SNACK_STAGE_MODELS.distantHill);
  }

  nodes
    .filter((n) => n.nodeType === "shop")
    .forEach((n) => {
      const pos = nodePositions.get(n.id);
      const placed = placeOutwardDecoration(pos, 1.6, SNACK_STAGE_MODELS.shopKiosk, { driveway: true });
      if (placed) zonePropPositions.push(placed);
    });

  nodes
    .filter((n) => n.nodeType === "branch")
    .forEach((n) => {
      const pos = nodePositions.get(n.id);
      const placed = placeOutwardDecoration(pos, 1.4, SNACK_STAGE_MODELS.routeSignpost);
      if (placed) zonePropPositions.push(placed);
    });

  nodes
    .filter((n) => n.nodeType === "item-box")
    .forEach((n) => {
      const pos = nodePositions.get(n.id);
      const placed = placeOutwardDecoration(pos, 1.0, SNACK_STAGE_MODELS.itemBox);
      if (placed) zonePropPositions.push(placed);
    });

  // 駅ゾーン(北西): 見本の「北西=駅、スタート地点」に合わせ、駅とスタートゲートを配置。
  const startNode = nodes.find((n) => n.nodeType === "start");
  if (startNode) {
    const pos = nodePositions.get(startNode.id);
    const stationPlaced = placeOutwardDecoration(pos, 2.4, SNACK_ZONE_MODELS["building-station"]);
    if (stationPlaced) zonePropPositions.push(stationPlaced);
    // ゲートは道をまたぐアーチとして意図的に道の真上へ置くため、道回避の対象から外す。
    const gatePlaced = placeOutwardDecoration(pos, 1.2, SNACK_ZONE_MODELS["gate-start"], { straddleRoad: true });
    if (gatePlaced) zonePropPositions.push(gatePlaced);
  }

  // 方角ゾーン別の建物・木・道沿いの小物を巡回配置する(見本の「北=オフィス/ショップ、
  // 東=学校/病院/集合住宅、南=教会/住宅、西=公園」というゾーン分けを再現)。
  // 既に専用装飾を置いたノード(job/shop/branch/item-box/start)は対象から外す。
  const themeCounters = {};
  const decoratedTypes = new Set(["job", "shop", "branch", "item-box", "start"]);
  const zoneEligibleNodes = nodes.filter((n) => n.zone === "outer" && !decoratedTypes.has(n.nodeType));

  zoneEligibleNodes.forEach((n, idx) => {
    const pos = nodePositions.get(n.id);
    const zoneName = n.buildingZone;
    if (zoneName === "park") {
      // 公園ゾーンは施設1つ+木を多めに配置し、緑豊かな見た目にする。2026-08-16、
      // 見本(公園の見本画像)は木・低木が茂みとして複数まとまっているのに対し、
      // 1ノード1本では寂しいという指摘を受け2本に増やした。同じoffsetで2回試行すると
      // resolveClearOutwardPositionの衝突回避が自動的に別角度へ振ってくれるため、
      // 不自然に重ならず「同じ場所に生えた木立ち」のような自然なばらけ方になる。
      if (idx % 3 === 0) tryPlaceZoneProp(pos, 2.1, "facility-park", { driveway: true });
      tryPlaceZoneProp(pos, 1.6, SNACK_TREE_MODEL_KEYS[idx % SNACK_TREE_MODEL_KEYS.length]);
      tryPlaceZoneProp(pos, 1.6, SNACK_TREE_MODEL_KEYS[(idx + 1) % SNACK_TREE_MODEL_KEYS.length]);
    } else if (zoneName === "station") {
      // 駅・ゲートは上で個別配置済みのため、街灯等の小物のみ巡回配置する
    } else {
      // 2026-08-13(第3弾)、32マス化で1地区あたりのノード数が3〜4個と少なくなったため、
      // 従来の「半分だけ配置」ではまばらすぎる。地区ごとに小さな街としてまとまって見えるよう、
      // 対象ノード全てに建物を配置する(利用者仕様書3章「地区ごとに小さな街としてまとめる」)。
      const themeModels = SNACK_ZONE_BUILDING_THEMES[zoneName];
      if (themeModels) {
        const used = themeCounters[zoneName] || 0;
        themeCounters[zoneName] = used + 1;
        tryPlaceZoneProp(pos, 1.9, themeModels[used % themeModels.length], { driveway: true });
      }
    }
    const streetKey = SNACK_STREET_PROP_MODEL_KEYS[idx % SNACK_STREET_PROP_MODEL_KEYS.length];
    tryPlaceZoneProp(pos, 0.7, streetKey);
  });

  // 空き地装飾(2026-08-15、Meshy生成済みだった未組み込み素材6種+2026-08-16、低木・ベンチ・
  // 木・街灯を追加し密度も倍増。利用者から「全体的に質素」「花壇・四角い植木・ベンチで
  // 公園らしさを」「見本ほど木・街灯が多くない」との指摘を受けた対応)。外周(半径比1.0)と
  // 内周(半径比0.4)の中間の帯(0.52〜0.86、従来の0.6〜0.78より内外に広げて空き地全体を
  // カバー)に候補点をばら撒き、既存の全ノード・全装飾(zonePropPositions、この時点までの
  // 建物・木・小物すべてを含む)と最小距離を保てる候補だけを採用する(マス・キャラクター
  // 移動の妨げにならないことを優先する設計)。候補数・目標数は種類が8→11に増えた分、
  // 1種あたりの出現数が薄まりすぎないよう18→26に引き上げた。
  const clusterCandidateCount = 60;
  const clusterMinGap = SNACK_ZONE_PROP_MIN_GAP + 0.6;
  const clusterTargetCount = 26;
  const allNodeWorldPositions = nodes.map((n) => nodePositions.get(n.id));
  let clusterPlaced = 0;
  for (let i = 0; i < clusterCandidateCount && clusterPlaced < clusterTargetCount; i++) {
    const angle = (i / clusterCandidateCount) * Math.PI * 2 + 0.31;
    const radiusT = 0.52 + ((i * 37) % 23) / 23 * 0.34; // 0.52〜0.86の範囲で疑似ランダムに散らす
    const cx = centerX + Math.cos(angle) * halfX * radiusT;
    const cz = centerZ + Math.sin(angle) * halfZ * radiusT;
    const candidate = new THREE.Vector3(cx, 0, cz);
    const conflictsDecoration = zonePropPositions.some((p) => p.distanceTo(candidate) < clusterMinGap);
    const conflictsNode = allNodeWorldPositions.some((p) => p.distanceTo(candidate) < clusterMinGap);
    if (conflictsDecoration || conflictsNode) continue;
    const modelKey = SNACK_GROUND_CLUSTER_KEYS[clusterPlaced % SNACK_GROUND_CLUSTER_KEYS.length];
    const group = new THREE.Group();
    group.position.set(cx, terrainHeightAt(cx, cz), cz);
    group.rotation.y = angle * 1.7; // 放射状に揃いすぎないよう、配置角とは別の値で向きだけずらす
    scene.add(group);
    loadDecorationModel(group, SNACK_GROUND_CLUSTER_MODELS[modelKey]);
    zonePropPositions.push(candidate);
    clusterPlaced += 1;
  }
}

// 発動中の罠(node.activeTrap)を持つノードにだけplaced-trap-marker.glbを表示する。
// nodeMapはmount()時にnodesの参照をそのまま格納しているため(deep cloneしていない)、
// snack-engine.jsが直接ミューテートするactiveTrapの最新値をここで読める。
function syncTrapMarkers() {
  if (!scene) return;
  const activeIds = new Set();
  nodeMap.forEach((node, id) => {
    if (node.activeTrap) activeIds.add(id);
  });
  trapMarkerEntries.forEach((group, id) => {
    if (!activeIds.has(id)) {
      scene.remove(group);
      trapMarkerEntries.delete(id);
    }
  });
  activeIds.forEach((id) => {
    if (trapMarkerEntries.has(id)) return;
    const pos = nodePositions.get(id);
    if (!pos) return;
    const group = new THREE.Group();
    group.position.set(pos.x, pos.y, pos.z);
    scene.add(group);
    loadDecorationModel(group, SNACK_STAGE_MODELS.trapMarker);
    trapMarkerEntries.set(id, group);
  });
}

// プレイヤーごとの足元リング。従来は「現在の手番プレイヤーだけ」に1個だけ表示していたが、
// 2026-08-12(統合仕様書対応)、マップ全体表示・ズーム確認で「実物の3Dキャラ+足元リング色」を
// そのままマーカー代わりに使う設計にしたため、全プレイヤー分を常時(控えめに)表示し、
// 現在の手番プレイヤーだけ大きく強調する方式に変更した。色はP1〜P4固定色(座席番号ベース)。
function ensurePlayerRing(playerId, seatNumber) {
  if (playerRings.has(playerId)) return playerRings.get(playerId);
  const group = new THREE.Group();
  scene.add(group);
  const record = { group, seatNumber };
  playerRings.set(playerId, record);
  const generation = sceneGeneration;
  const colorHex = snackPlayerColorHex(seatNumber);
  loadGLTFSceneCached(SNACK_STAGE_MODELS.turnRing.url)
    .then((template) => {
      if (generation !== sceneGeneration) return;
      const model = template.clone(true);
      model.scale.setScalar(SNACK_STAGE_MODELS.turnRing.scale);
      model.rotation.x = -Math.PI / 2;
      model.position.y = 0.03;
      model.traverse((node) => {
        if (node.isMesh) {
          node.receiveShadow = true;
          node.material = node.material.clone();
          node.material.color.setHex(colorHex);
          node.material.emissive = new THREE.Color(colorHex);
          node.material.emissiveIntensity = 0.15;
        }
      });
      group.add(model);
    })
    .catch((err) => {
      console.warn("プレイヤーリングモデルの読み込みに失敗", err);
    });
  return record;
}

function updatePlayerRings() {
  if (!scene) return;
  characters.forEach((entry, playerId) => {
    const record = ensurePlayerRing(playerId, entry.seatNumber);
    // entry.group.position.yはホップ中の弧の高さを含むため使わず、x/zから地形高さを再計算する。
    const ringY = terrainHeightAt(entry.group.position.x, entry.group.position.z) + 0.02;
    record.group.position.set(entry.group.position.x, ringY, entry.group.position.z);
    const isActive = playerId === focusPlayerId;
    const targetScale = isActive ? 1.35 : 0.95;
    const targetEmissive = isActive ? 0.55 : 0.15;
    record.group.scale.setScalar(record.group.scale.x + (targetScale - record.group.scale.x) * 0.15);
    record.group.traverse((node) => {
      if (node.isMesh && node.material) node.material.emissiveIntensity = targetEmissive;
    });
  });
}

// 同じマスに複数プレイヤーが止まっている場合、行動中(focusPlayerId)以外を少し脇へ
// ずらして「マスから降りている」ように見せる(重なって表示が潰れるのを防ぐ、2026-08-15追加)。
const SAME_NODE_OFFSET_RADIUS = 0.68;

// characters(playerId -> entry)を同じcurrentNodeIdごとにグループ化し、行動中プレイヤー
// (いなければ座席番号が一番若い1人)を中心に残したまま、残りへ円状のオフセットを割り当てる。
// ホップ移動中(entry.hop有り)のプレイヤーはここでは対象にしない(演出中の座標を横取りしないため)。
function computeSameNodeOffsets() {
  const byNode = new Map();
  characters.forEach((entry) => {
    if (entry.hop) return;
    if (!byNode.has(entry.currentNodeId)) byNode.set(entry.currentNodeId, []);
    byNode.get(entry.currentNodeId).push(entry);
  });
  const offsets = new Map();
  byNode.forEach((entries) => {
    if (entries.length < 2) return;
    const sorted = entries.slice().sort((a, b) => (a.seatNumber || 0) - (b.seatNumber || 0));
    const primary = sorted.find((entry) => entry.playerId === focusPlayerId) || sorted[0];
    const others = sorted.filter((entry) => entry !== primary);
    others.forEach((entry, i) => {
      const angle = (i / others.length) * Math.PI * 2 + Math.PI / 5;
      offsets.set(entry.playerId, {
        x: Math.cos(angle) * SAME_NODE_OFFSET_RADIUS,
        z: Math.sin(angle) * SAME_NODE_OFFSET_RADIUS,
      });
    });
  });
  return offsets;
}

// 上記オフセットへ毎フレーム緩やかに寄せる(瞬間移動させず、マスへ歩いてきてから
// すっと脇へ避けるように見せる)。ホップ中のentryはupdateHopForEntry側が座標を握っているため
// ここでは触らない。
function applySameNodeLayout() {
  if (!nodePositions.size) return;
  const offsets = computeSameNodeOffsets();
  characters.forEach((entry) => {
    if (entry.hop) return;
    const basePos = nodePositions.get(entry.currentNodeId);
    if (!basePos) return;
    const off = offsets.get(entry.playerId);
    const targetX = basePos.x + (off ? off.x : 0);
    const targetZ = basePos.z + (off ? off.z : 0);
    const targetY = terrainHeightAt(targetX, targetZ);
    entry.group.position.x += (targetX - entry.group.position.x) * 0.15;
    entry.group.position.z += (targetZ - entry.group.position.z) * 0.15;
    entry.group.position.y += (targetY - entry.group.position.y) * 0.15;
  });
}

function createMascotEntry(nodeId) {
  if (!nodeId || mascotEntries.has(nodeId)) return;
  const pos = nodePositions.get(nodeId);
  if (!pos) return;
  const group = new THREE.Group();
  group.position.set(pos.x, pos.y, pos.z);
  scene.add(group);
  const entry = { group, model: null, baseY: SNACK_STAGE_MODELS.mascot.yOffset };
  mascotEntries.set(nodeId, entry);
  // 台座はgroup直下の別要素として追加する(マスコット本体だけを上下バウンドさせるため、
  // マスコットのモデル読み込み完了後にentry.modelへ参照を残し、groupごと動かさないようにする)。
  loadDecorationModel(group, SNACK_STAGE_MODELS.spawnPedestal);
  const generation = sceneGeneration;
  loadGLTFSceneCached(SNACK_STAGE_MODELS.mascot.url)
    .then((template) => {
      if (generation !== sceneGeneration || mascotEntries.get(nodeId) !== entry) return;
      const model = template.clone(true);
      model.scale.setScalar(SNACK_STAGE_MODELS.mascot.scale);
      model.position.y = SNACK_STAGE_MODELS.mascot.yOffset;
      model.traverse((node) => {
        if (node.isMesh) node.castShadow = true;
      });
      group.add(model);
      entry.model = model;
    })
    .catch((err) => {
      console.warn("おやつマスコットモデルの読み込みに失敗", err);
    });
}

// activeSnackNodeIds: 現在おやつが出現しているノードIdの配列(フェーズE、同時出現数2以上化)。
// もう出現していないノードのマスコットは破棄し、新しく出現したノードには新規作成する。
function syncMascots(activeSnackNodeIds) {
  if (!activeSnackNodeIds) return;
  const activeSet = new Set(activeSnackNodeIds);
  mascotEntries.forEach((entry, nodeId) => {
    if (activeSet.has(nodeId)) return;
    scene.remove(entry.group);
    mascotEntries.delete(nodeId);
  });
  activeSnackNodeIds.forEach((nodeId) => createMascotEntry(nodeId));
}

function createCharacterPlaceholder(color) {
  const mesh = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.26, 0.32, 4, 8),
    new THREE.MeshStandardMaterial({ color: color || 0xe4572e })
  );
  mesh.position.y = 0.42;
  mesh.castShadow = true;
  return mesh;
}

function loadSnackCharacterModel(entry, speciesId) {
  const config = SPECIES_MODEL_MAP[speciesId];
  if (!config) return;
  const generation = sceneGeneration;
  loadGLTFSceneCached(config.url)
    .then((template) => {
      if (generation !== sceneGeneration) return;
      entry.group.remove(entry.placeholder);
      const model = template.clone(true);
      model.scale.setScalar(config.scale);
      model.position.y = config.yOffset;
      model.traverse((node) => {
        if (node.isMesh) node.castShadow = true;
      });
      entry.group.add(model);
    })
    .catch((err) => {
      console.warn(`おやつ集めモード動物モデル(speciesId="${speciesId}")の読み込みに失敗`, err);
    });
}

function createCharacterEntry(player) {
  const group = new THREE.Group();
  const pos = nodePositions.get(player.currentNodeId) || new THREE.Vector3();
  group.position.set(pos.x, pos.y, pos.z);
  scene.add(group);
  const visual = player.avatar || {};
  const placeholder = createCharacterPlaceholder(visual.color);
  group.add(placeholder);
  const entry = { group, placeholder, hop: null, currentNodeId: player.currentNodeId, playerId: player.id, seatNumber: player.seatNumber || 1 };
  characters.set(player.id, entry);
  loadSnackCharacterModel(entry, visual.speciesId);
  return entry;
}

// 移動方向を向かせる(board3d.jsのfaceDirectionと同じ考え方)。カメラの「移動中は進行方向の
// 真後ろから追う」演出にはこのrotation.yを使う。
function faceDirection(entry, fromPos, toPos) {
  const dx = toPos.x - fromPos.x;
  const dz = toPos.z - fromPos.z;
  if (Math.abs(dx) < 1e-6 && Math.abs(dz) < 1e-6) return;
  entry.group.rotation.y = Math.atan2(dx, dz);
}

// 移動元→移動先ノードのワールド座標を直線+放物線アーチで結ぶホップ演出。
// hop.onDoneがあれば完了時にそれを呼ぶ(hopPathが1マスずつ連結するのに使う)。
// onDoneが無い場合(syncPlayersが差分から直接1回ホップさせるフォールバック経路)は、
// ここで従来通りisMovingを片付ける。
function updateHopForEntry(entry, now) {
  if (!entry.hop) return;
  const hop = entry.hop;
  const t = Math.min(1, (now - hop.startTime) / hop.durationMs);
  entry.group.position.x = hop.from.x + (hop.to.x - hop.from.x) * t;
  entry.group.position.z = hop.from.z + (hop.to.z - hop.from.z) * t;
  const arc = Math.sin(t * Math.PI);
  // 2026-08-15、地形の高低差に追従するよう、移動元/移動先ノードの実際のY(terrainHeightAt込み)を
  // 補間した上でホップの弧を足す(以前は常にy=0基準で、地形が平坦だった頃の名残)。
  const groundY = hop.from.y + (hop.to.y - hop.from.y) * t;
  entry.group.position.y = groundY + arc * HOP_HEIGHT;
  const stretch = 1 + arc * 0.08;
  entry.group.scale.set(1 / Math.sqrt(stretch), stretch, 1 / Math.sqrt(stretch));
  if (t >= 1) {
    entry.currentNodeId = hop.toNodeId;
    entry.group.position.y = hop.to.y;
    entry.group.scale.set(1, 1, 1);
    const onDone = hop.onDone;
    entry.hop = null;
    if (onDone) {
      onDone();
    } else if (entry.playerId === focusPlayerId) {
      isMoving = false;
    }
  }
}

function hopToNode(entry, fromPos, toPos, toNodeId, durationMs) {
  return new Promise((resolve) => {
    faceDirection(entry, fromPos, toPos);
    entry.hop = { from: fromPos, to: toPos, toNodeId, startTime: performance.now(), durationMs, onDone: resolve };
  });
}

// 停止マス間を見た目上何分割して歩かせるか(2026-08-13、32マス化でマス間隔が2倍近くに
// なったため導入。中間ウェイポイントはこの関数内の見た目補間だけで完結し、snack-engine.js側の
// 停止判定・イベント・所持金増減には一切関わらない(利用者仕様書どおり)。
const HOP_WAYPOINT_SUBSTEPS = 2;

// snack-engine.jsの移動結果に含まれるpath(通過したノードIdの配列)を1マスずつ順番に
// ホップさせる(本編board3d.jsのhopStepsと同じ考え方、2026-08-12追加)。
// pathが空(分岐選択のみ等で移動が発生しなかった手番)なら何もしない。
// options.stepDurationMs: 演出速度設定(標準/はやい/最速)に応じた1マスあたりの所要時間。
// options.onStep(stepsDone, total): 1マス着地するたびに呼ばれる(残り歩数表示の更新用)。
async function hopPath(playerId, pathNodeIds, options) {
  const entry = characters.get(playerId);
  if (!entry || !pathNodeIds || !pathNodeIds.length) return;
  const opts = options || {};
  const stepDurationMs = opts.stepDurationMs || HOP_STEP_DURATION_MS;
  const isFocus = playerId === focusPlayerId;
  if (isFocus) isMoving = true;
  // 同じマスで脇へ避けていた場合、その位置から歩き出させる(nodePositionsの中心へ瞬間移動させない)。
  let fromPos = entry.group.position.clone();
  for (let i = 0; i < pathNodeIds.length; i++) {
    const nodeId = pathNodeIds[i];
    const toPos = nodePositions.get(nodeId);
    if (!toPos) break;
    const subDurationMs = Math.max(60, stepDurationMs / HOP_WAYPOINT_SUBSTEPS);
    let subFrom = fromPos;
    for (let s = 1; s <= HOP_WAYPOINT_SUBSTEPS; s++) {
      const isLastSub = s === HOP_WAYPOINT_SUBSTEPS;
      const subTo = isLastSub ? toPos : fromPos.clone().lerp(toPos, s / HOP_WAYPOINT_SUBSTEPS);
      // 中間サブステップではtoNodeIdを実ノードidに進めず、最後のサブステップでのみ
      // entry.currentNodeIdが本当の到着先へ更新されるようにする(updateHopForEntryが
      // t>=1でentry.currentNodeId=hop.toNodeIdを設定するため)。
      await hopToNode(entry, subFrom, subTo, isLastSub ? nodeId : entry.currentNodeId, subDurationMs);
      subFrom = subTo;
    }
    fromPos = toPos;
    if (opts.onStep) opts.onStep(i + 1, pathNodeIds.length);
  }
  if (isFocus) isMoving = false;
}

function syncPlayers(players, activeSnackNodeIds) {
  if (!scene) return;
  (players || []).forEach((p) => {
    let entry = characters.get(p.id);
    if (!entry) {
      createCharacterEntry(p);
      return;
    }
    if (!entry.hop && entry.currentNodeId !== p.currentNodeId) {
      const fromPos = entry.group.position.clone();
      const toPos = nodePositions.get(p.currentNodeId);
      if (toPos) {
        faceDirection(entry, fromPos, toPos);
        if (p.id === focusPlayerId) isMoving = true;
        entry.hop = { from: fromPos, to: toPos, toNodeId: p.currentNodeId, startTime: performance.now(), durationMs: HOP_DURATION_MS };
      } else {
        entry.currentNodeId = p.currentNodeId;
      }
    }
  });
  syncMascots(activeSnackNodeIds);
  syncTrapMarkers();
}

function focusCamera(playerId) {
  if (playerId) focusPlayerId = playerId;
}

// マップ全体を収める固定俯瞰の目標位置を計算する。zoomLevelが大きいほど寄る
// (1=全体表示相当、最大3倍)。panX/panZはズーム時のドラッグパン量(ワールド座標オフセット)。
// 見下ろし俯角は08_全体マップ再現指針の「42〜52度」を目安に、中間の48度付近
// (atan(0.67/0.6)≈48.2度)へ調整した(2026-08-13、旧値0.85は約54.8度でやや急すぎた)。
// 2026-08-13(第3弾)、距離の基準をノード座標(mapBounds)ではなく浮島本体の実半径
// (islandRadius、建物・木・岩を含む本当の見た目の広さ)に変更し、外周に5〜8%の
// 余白が残るようマージン係数を掛けた(Codexレビュー「全体表示で島の輪郭が切れる」対応)。
function overviewCameraTarget(zoomLevel, panX, panZ) {
  const b = mapBounds || computeMapBounds();
  const margin = 1.07; // 外周に約7%の余白
  const radius = Math.max(islandRadius.x, islandRadius.z) * margin;
  const baseDist = radius * 1.6 + 4;
  const dist = baseDist / (zoomLevel || 1);
  const cx = b.centerX + panX;
  const cz = b.centerZ + panZ;
  return {
    pos: new THREE.Vector3(cx, dist * 0.67, cz + dist * 0.6),
    lookAt: new THREE.Vector3(cx, 0, cz),
  };
}

function updateOverviewCamera() {
  const { pos, lookAt } = overviewCameraTarget(cameraMode === "zoom" ? zoomState.level : 1, zoomState.panX, zoomState.panZ);
  cameraCurrentPos.lerp(pos, 0.12);
  camera.position.copy(cameraCurrentPos);
  camera.lookAt(lookAt.x, lookAt.y, lookAt.z);
}

// すごろく本編(board3d.js)と同じ「静止時=ジオラマ風の見下ろし固定角度/移動中=進行方向の
// 真後ろから追う三人称視点」の2段構成(2026-08-11、ユーザー指示で本編と統一)。
// 2026-08-12: マップ全体表示・ズーム・マップ紹介フライスルー用にcameraModeで分岐する形に拡張。
// "intro"は専用のrAFループ(playMapIntro)が毎フレーム直接camera.position/lookAtを操作するため、
// ここでは何もしない(二重に動かすと競合するため)。
function updateCamera() {
  if (!camera) return;
  if (cameraMode === "intro") return;
  if (cameraMode === "overview" || cameraMode === "zoom") {
    updateOverviewCamera();
    return;
  }
  if (cameraMode === "diceFocus") {
    updateDiceFocusCamera();
    return;
  }
  if (cameraMode === "branchOverview") {
    updateBranchOverviewCamera();
    return;
  }
  if (cameraMode === "snackReveal") {
    updateSnackRevealCamera();
    return;
  }
  if (cameraMode === "orderLineup") {
    updateOrderLineupCamera();
    return;
  }
  const entry = focusPlayerId ? characters.get(focusPlayerId) : null;
  if (!entry) return;
  const focusGroup = entry.group;
  let desired;
  let lookAtPos;
  if (isMoving) {
    const forward = new THREE.Vector3(Math.sin(focusGroup.rotation.y), 0, Math.cos(focusGroup.rotation.y));
    desired = focusGroup.position
      .clone()
      .addScaledVector(forward, -CAMERA_MOVE.trail)
      .add(new THREE.Vector3(0, CAMERA_MOVE.up, 0));
    // 注視点を進行方向へ先読みし、次の経路が画面内に見えるようにする。
    lookAtPos = focusGroup.position.clone().addScaledVector(forward, CAMERA_MOVE.lookAhead).add(new THREE.Vector3(0, 0.5, 0));
  } else {
    desired = new THREE.Vector3(
      focusGroup.position.x - CAMERA_IDLE.trail,
      CAMERA_IDLE.up,
      focusGroup.position.z + CAMERA_IDLE.back
    );
    lookAtPos = new THREE.Vector3(focusGroup.position.x, 0.5, focusGroup.position.z);
  }
  const lift = computeCameraOcclusionLift(cameraCurrentPos, lookAtPos);
  desired = desired.clone().add(new THREE.Vector3(0, lift, 0));
  cameraCurrentPos.lerp(desired, CAMERA_LERP);
  camera.position.copy(cameraCurrentPos);
  camera.lookAt(lookAtPos.x, lookAtPos.y, lookAtPos.z);
}

// サイコロを振る手番プレイヤーへ少し寄って見下ろす演出用カメラ。対象が見つからない場合は
// 全体俯瞰にフォールバックする(演出中に手番プレイヤー情報が欠けても画面が固まらないように)。
function updateDiceFocusCamera() {
  const entry = diceFocusPlayerId ? characters.get(diceFocusPlayerId) : null;
  if (!entry) {
    updateOverviewCamera();
    return;
  }
  const p = entry.group.position;
  // 2026-08-13、Codexレビュー(サイコロが画面上端で切れる)対応で少し引いて画面幅20〜28%目安に収める。
  const desired = new THREE.Vector3(p.x - 1.5, 2.55, p.z + 2.05);
  const lift = computeCameraOcclusionLift(cameraCurrentPos, new THREE.Vector3(p.x, 0.9, p.z));
  desired.y += lift;
  cameraCurrentPos.lerp(desired, CAMERA_LERP * 1.6);
  camera.position.copy(cameraCurrentPos);
  camera.lookAt(p.x, 0.9, p.z);
}

// 分岐マスで両方のルートが見えるよう、やや高い位置から見下ろす演出用カメラ。
function updateBranchOverviewCamera() {
  const pos = branchOverviewNodeId ? nodePositions.get(branchOverviewNodeId) : null;
  if (!pos) {
    updateOverviewCamera();
    return;
  }
  const desired = new THREE.Vector3(pos.x - 2.2, 5.4, pos.z + 3.6);
  cameraCurrentPos.lerp(desired, CAMERA_LERP);
  camera.position.copy(cameraCurrentPos);
  camera.lookAt(pos.x, 0.4, pos.z);
}

function enterDiceFocus(playerId) {
  if (!playerId || !camera) return;
  diceFocusPlayerId = playerId;
  cameraMode = "diceFocus";
}

function exitDiceFocus() {
  if (cameraMode === "diceFocus") cameraMode = "follow";
  diceFocusPlayerId = null;
}

function enterBranchOverview(nodeId) {
  if (!nodeId || !camera) return;
  branchOverviewNodeId = nodeId;
  cameraMode = "branchOverview";
}

function exitBranchOverview() {
  if (cameraMode === "branchOverview") cameraMode = "follow";
  branchOverviewNodeId = null;
}

// おやつ地点を見せる紹介演出用カメラ(仕様書14章SNACK_REVEALの「おやつを回転させる」を、
// 素材側にモデルを回すギミックが無いためカメラ側の周回で代替する簡略版)。
// 2026-08-16、以前はおやつ地点だけを近距離(radius2.6)で周回するのみで、地図上のどこなのか・
// 現在地からどれくらい離れているかが伝わらないという指摘を受け、snackRevealContextPositions
// (通常はプレイヤーの現在地)が渡されている場合はそれも画面に収める俯瞰フレーミングに変更した。
// contextが無い場合(ガブリオンイベント演出での流用等)は従来通りの近距離周回のまま。
function updateSnackRevealCamera() {
  const pos = snackRevealNodeId ? nodePositions.get(snackRevealNodeId) : null;
  if (!pos) {
    updateOverviewCamera();
    return;
  }
  const elapsed = (performance.now() - snackRevealStartTime) / 1000;
  if (!snackRevealContextPositions.length) {
    const angle = elapsed * 0.5;
    const radius = 2.6;
    const desired = new THREE.Vector3(pos.x + Math.cos(angle) * radius, 1.9, pos.z + Math.sin(angle) * radius);
    cameraCurrentPos.lerp(desired, CAMERA_LERP * 1.4);
    camera.position.copy(cameraCurrentPos);
    camera.lookAt(pos.x, 0.5, pos.z);
    return;
  }
  const points = [pos, ...snackRevealContextPositions];
  const minX = Math.min(...points.map((p) => p.x));
  const maxX = Math.max(...points.map((p) => p.x));
  const minZ = Math.min(...points.map((p) => p.z));
  const maxZ = Math.max(...points.map((p) => p.z));
  const centerX = (minX + maxX) / 2;
  const centerZ = (minZ + maxZ) / 2;
  // 距離が近すぎる場合(隣のマスに再出現した等)でも最低限の見下ろし距離を確保する。
  const spread = Math.max(maxX - minX, maxZ - minZ, 3);
  const dist = spread * 1.15 + 3.5;
  // ゆっくり回り込んで奥行きが分かるようにする(静止画的にならないように)。
  const angle = 0.5 + elapsed * 0.12;
  const desired = new THREE.Vector3(centerX + Math.cos(angle) * dist * 0.6, dist * 0.62, centerZ + Math.sin(angle) * dist * 0.6);
  cameraCurrentPos.lerp(desired, CAMERA_LERP * 1.3);
  camera.position.copy(cameraCurrentPos);
  camera.lookAt(centerX, 0.6, centerZ);
}

// contextPlayerIds: 一緒に画面へ収めたいプレイヤーId配列(省略時は従来通りの近距離周回)。
function enterSnackReveal(nodeId, contextPlayerIds) {
  if (!nodeId || !camera) return;
  snackRevealNodeId = nodeId;
  snackRevealStartTime = performance.now();
  cameraMode = "snackReveal";
  snackRevealContextPositions = (contextPlayerIds || [])
    .map((pid) => {
      const entry = characters.get(pid);
      return entry ? entry.group.position.clone() : null;
    })
    .filter(Boolean);
}

function exitSnackReveal() {
  if (cameraMode === "snackReveal") cameraMode = "follow";
  snackRevealNodeId = null;
  snackRevealContextPositions = [];
}

// 行動順決めサイコロ(ORDER_ROLL/ORDER_TIE_ROLL)の演出。対象プレイヤーを横一列に並べ、
// 全員をカメラの正面(+Z方向)へ向けて整列させる。同点再抽選(isTie)では対象が絞られるため、
// 同じ関数を再度呼べば残ったプレイヤーだけで自動的に並び直す(スポットライトが絞られる形になる)。
// 各プレイヤーの頭上のサイコロ演出自体は既存のplayDiceRoll()をそのまま流用する。
function enterOrderLineup(playerIds) {
  if (!camera || !scene || !playerIds || !playerIds.length) return;
  orderLineupIds = playerIds.slice();
  playerIds.forEach((pid) => {
    if (!orderLineupAllIds.includes(pid)) orderLineupAllIds.push(pid);
  });
  cameraMode = "orderLineup";
  const points = playerIds.map((pid) => {
    const entry = characters.get(pid);
    return entry ? entry.group.position.clone() : new THREE.Vector3();
  });
  const centerX = points.reduce((s, p) => s + p.x, 0) / points.length;
  const centerZ = points.reduce((s, p) => s + p.z, 0) / points.length;
  const n = playerIds.length;
  playerIds.forEach((pid, i) => {
    const entry = characters.get(pid);
    if (!entry) return;
    entry.hop = null; // 直前まで移動演出が残っていた場合に備えて止める
    const offsetX = (i - (n - 1) / 2) * ORDER_LINEUP_SPACING;
    entry.group.position.set(centerX + offsetX, points[i].y, centerZ);
    entry.group.rotation.y = 0; // +Z(カメラ側)を向く。faceDirectionと同じ回転規約(dx,dz)=(0,1)→0
  });
}

function exitOrderLineup() {
  if (cameraMode === "orderLineup") cameraMode = "follow";
  // currentNodeId自体は変わっていないためsyncPlayersでは戻せない。実際のノード位置へ戻す
  // (同じマスに複数人いる場合の円形オフセットは、以後は毎フレームのapplySameNodeLayoutが処理する)。
  // 同点再抽選で対象から外れたプレイヤーも整列位置に置き去りにならないよう、累積リストで戻す。
  orderLineupAllIds.forEach((pid) => {
    const entry = characters.get(pid);
    if (!entry) return;
    const pos = nodePositions.get(entry.currentNodeId);
    if (pos) entry.group.position.set(pos.x, pos.y, pos.z);
  });
  orderLineupIds = [];
  orderLineupAllIds = [];
}

// 2026-08-16、以前は距離(dist)を定数で計算していたため、スマホ縦画面(横FOVが縦FOVより
// かなり狭い)で4人プレイ時に列の両端が画面外へはみ出す不具合があった。camera.fov/aspectから
// 実際の横方向の見える角度を逆算し、「横一列が余白込みで確実に収まる距離」を優先して使う
// (通常時の見下ろし距離との大きい方を採用)。また、行動選択メニュー(画面下側の固定ポップアップ)に
// 頭上のサイコロ演出が隠れないよう、注視点を頭の高さより上へ持ち上げてキャラクター全体を画面下寄りに
// 表示する(持ち上げ量はdistに比例させ、人数が増えて距離が伸びても比率が変わらないようにする)。
const ORDER_LINEUP_LOOKAT_RATIO = 2.2 / 4.67; // 2人時の実測(dist=4.67, lookAtY=2.2)から算出
const ORDER_LINEUP_HEIGHT_RATIO = 0.4;

function updateOrderLineupCamera() {
  const entries = orderLineupIds.map((pid) => characters.get(pid)).filter(Boolean);
  if (!entries.length) {
    updateOverviewCamera();
    return;
  }
  const points = entries.map((e) => e.group.position);
  const centerX = points.reduce((s, p) => s + p.x, 0) / points.length;
  const centerZ = points.reduce((s, p) => s + p.z, 0) / points.length;
  const spread = Math.max((entries.length - 1) * ORDER_LINEUP_SPACING, 1.4);
  const vFovRad = THREE.MathUtils.degToRad(camera.fov || 55);
  const aspect = camera.aspect || 0.5;
  const hFovRad = 2 * Math.atan(Math.tan(vFovRad / 2) * aspect);
  const halfWidthNeeded = spread / 2 + 0.7; // 列の両端に余白を残す
  const distForWidth = halfWidthNeeded / Math.tan(hFovRad / 2);
  const dist = Math.max(distForWidth, spread * 1.05 + 3.2);
  const desired = new THREE.Vector3(centerX, dist * ORDER_LINEUP_HEIGHT_RATIO, centerZ + dist);
  cameraCurrentPos.lerp(desired, CAMERA_LERP * 1.3);
  camera.position.copy(cameraCurrentPos);
  camera.lookAt(centerX, dist * ORDER_LINEUP_LOOKAT_RATIO, centerZ);
}

// ==================== マップ全体表示・ズーム・ドラッグパン ====================

function panZoomBy(dx, dz) {
  const b = mapBounds || computeMapBounds();
  const panScale = 0.02 / (zoomState.level || 1);
  zoomState.panX -= dx * panScale;
  zoomState.panZ -= dz * panScale;
  const limX = b.halfX * 0.7;
  const limZ = b.halfZ * 0.7;
  zoomState.panX = Math.max(-limX, Math.min(limX, zoomState.panX));
  zoomState.panZ = Math.max(-limZ, Math.min(limZ, zoomState.panZ));
}

function setZoomDelta(delta) {
  zoomState.level = Math.max(1, Math.min(3, zoomState.level + delta));
}

function onZoomPointerDown(e) {
  zoomPointerActive = true;
  zoomLastX = e.clientX;
  zoomLastY = e.clientY;
}

function onZoomPointerMove(e) {
  if (!zoomPointerActive) return;
  const dx = e.clientX - zoomLastX;
  const dy = e.clientY - zoomLastY;
  zoomLastX = e.clientX;
  zoomLastY = e.clientY;
  panZoomBy(dx, dy);
}

function onZoomPointerUp() {
  zoomPointerActive = false;
}

function onZoomWheel(e) {
  e.preventDefault();
  setZoomDelta(-e.deltaY * 0.001);
}

function attachZoomPointerHandlers() {
  if (!renderer) return;
  const el = renderer.domElement;
  el.addEventListener("pointerdown", onZoomPointerDown);
  el.addEventListener("pointermove", onZoomPointerMove);
  window.addEventListener("pointerup", onZoomPointerUp);
  el.addEventListener("wheel", onZoomWheel, { passive: false });
}

function detachZoomPointerHandlers() {
  zoomPointerActive = false;
  if (!renderer) return;
  const el = renderer.domElement;
  el.removeEventListener("pointerdown", onZoomPointerDown);
  el.removeEventListener("pointermove", onZoomPointerMove);
  window.removeEventListener("pointerup", onZoomPointerUp);
  el.removeEventListener("wheel", onZoomWheel);
}

// 全体表示・ズーム中だけ霞を弱め、通常プレイに戻ると元の近距離用の霞に戻す。
function applySnackFogForMode(mode) {
  if (!scene || !scene.fog) return;
  const target = mode === "overview" || mode === "zoom" ? SNACK_FOG_OVERVIEW : SNACK_FOG_FOLLOW;
  scene.fog.near = target.near;
  scene.fog.far = target.far;
}

function enterOverview() {
  detachZoomPointerHandlers();
  cameraMode = "overview";
  applySnackFogForMode("overview");
}

function enterZoom() {
  zoomState = { level: 1.9, panX: zoomState.panX || 0, panZ: zoomState.panZ || 0 };
  cameraMode = "zoom";
  attachZoomPointerHandlers();
  applySnackFogForMode("zoom");
}

function exitMapView() {
  detachZoomPointerHandlers();
  cameraMode = "follow";
  zoomState = { level: 1.9, panX: 0, panZ: 0 };
  applySnackFogForMode("follow");
}

// ==================== マップ紹介フライスルー ====================
// ゲーム開始直後、外周ルートに沿ってマップを1周(分岐・ショップ付近では少し速度を落とす)→
// 上空へ引いて全景を約1秒静止→スタート地点の通常カメラへ滑らかに戻る。合計約8〜12秒。
// スキップ時も最終の全景だけは約0.5秒見せてから戻す(仕様書5章の指示通り)。
function playMapIntro() {
  let resolveFinished;
  const finished = new Promise((resolve) => {
    resolveFinished = resolve;
  });
  if (!camera || !scene) {
    resolveFinished();
    return { finished, requestSkip: () => {} };
  }
  cameraMode = "intro";
  const b = mapBounds || computeMapBounds();
  const orbitRadius = Math.max(b.halfX, b.halfZ) * 1.15 + 3;
  const orbitHeight = Math.max(b.halfX, b.halfZ) * 0.55 + 3;
  const overviewHeight = Math.max(b.halfX, b.halfZ) * 1.4 + 8;
  const ellipseSquash = b.halfZ / Math.max(b.halfX, 1);
  const startAngle = -Math.PI / 2; // snack-data.jsのouter0の角度と揃える
  const ORBIT_MS = 7000;
  const OVERVIEW_HOLD_MS = 1200;
  const RETURN_MS = 1400;
  const TOTAL_MS = ORBIT_MS + OVERVIEW_HOLD_MS + RETURN_MS;
  // 分岐点(外周4箇所、周回に対する割合)付近で少し速度を落とす(仕様書5章)。
  // 2026-08-13、32マス化に伴いcomputeBranchSlowPointsで動的算出する形に変更(旧実装は
  // 48ノード前提の比率をハードコードしており、ノード数が変わると分岐位置とズレていた)。
  const slowPoints = computeBranchSlowPoints();
  function angularSpeedFactor(progress) {
    let factor = 1;
    slowPoints.forEach((p) => {
      const d = Math.min(Math.abs(progress - p), 1 - Math.abs(progress - p));
      if (d < 0.06) factor *= 0.4;
    });
    return factor;
  }
  const startNode = [...nodeMap.values()].find((n) => n.nodeType === "start") || [...nodeMap.values()][0];
  const startNodePos = (startNode && nodePositions.get(startNode.id)) || new THREE.Vector3(b.centerX, 0, b.centerZ);
  let startTime = performance.now();
  let orbitProgress = 0;
  let lastT = 0;
  function tick() {
    if (cameraMode !== "intro" || !camera) {
      resolveFinished();
      return;
    }
    const now = performance.now();
    const elapsed = now - startTime;
    if (elapsed < ORBIT_MS) {
      const t = elapsed / ORBIT_MS;
      const dt = Math.max(0, t - lastT);
      lastT = t;
      orbitProgress += dt * angularSpeedFactor(orbitProgress);
      const angle = startAngle - orbitProgress * Math.PI * 2;
      const cx = b.centerX + Math.cos(angle) * orbitRadius;
      const cz = b.centerZ + Math.sin(angle) * orbitRadius * ellipseSquash;
      camera.position.set(cx, orbitHeight, cz);
      camera.lookAt(b.centerX, 1, b.centerZ);
    } else if (elapsed < ORBIT_MS + OVERVIEW_HOLD_MS) {
      const t = Math.min(1, (elapsed - ORBIT_MS) / (OVERVIEW_HOLD_MS * 0.4));
      const y = orbitHeight + (overviewHeight - orbitHeight) * t;
      camera.position.set(b.centerX, y, b.centerZ + overviewHeight * 0.5);
      camera.lookAt(b.centerX, 0, b.centerZ);
    } else if (elapsed < TOTAL_MS) {
      const t = (elapsed - ORBIT_MS - OVERVIEW_HOLD_MS) / RETURN_MS;
      const ease = t * t * (3 - 2 * t);
      const from = new THREE.Vector3(b.centerX, overviewHeight, b.centerZ + overviewHeight * 0.5);
      const to = new THREE.Vector3(startNodePos.x - CAMERA_IDLE.trail, CAMERA_IDLE.up, startNodePos.z + CAMERA_IDLE.back);
      camera.position.lerpVectors(from, to, ease);
      camera.lookAt(startNodePos.x, 0.5, startNodePos.z);
    } else {
      cameraCurrentPos.set(startNodePos.x - CAMERA_IDLE.trail, CAMERA_IDLE.up, startNodePos.z + CAMERA_IDLE.back);
      cameraMode = "follow";
      resolveFinished();
      return;
    }
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
  return {
    finished,
    requestSkip: () => {
      const targetElapsed = ORBIT_MS + OVERVIEW_HOLD_MS - 500;
      const forcedStart = performance.now() - targetElapsed;
      if (forcedStart < startTime) startTime = forcedStart;
    },
  };
}

function resize() {
  if (!renderer || !camera) return;
  const canvas = renderer.domElement;
  const width = canvas.clientWidth || 1;
  const height = canvas.clientHeight || 1;
  renderer.setSize(width, height, false);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
}

function buildScene(nodes, players, activeSnackNodeIds) {
  scene = new THREE.Scene();
  trapMarkerEntries = new Map();
  playerRings = new Map();
  diceMesh = null;
  scene.fog = new THREE.Fog(0xbfe3da, 16, 40);
  const bgTexture = textureLoader.load(SKY_BACKDROP_URL);
  bgTexture.colorSpace = THREE.SRGBColorSpace;
  scene.background = bgTexture;

  const xs = nodes.map((n) => n.position.x);
  const zs = nodes.map((n) => n.position.z);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minZ = Math.min(...zs);
  const maxZ = Math.max(...zs);
  const centerX = (minX + maxX) / 2;
  const centerZ = (minZ + maxZ) / 2;
  const halfX = (maxX - minX) / 2;
  const halfZ = (maxZ - minZ) / 2;

  const groundRadiusX = halfX * 1.35 + 4;
  const groundRadiusZ = halfZ * 1.35 + 4;
  // 全体表示カメラの距離計算(overviewCameraTarget)が参照する実際の浮島半径を記録する。
  islandRadius = { x: groundRadiusX, z: groundRadiusZ };
  // terrainHeightAtが参照する浮島の中心。nodeVec3(この後の道リボン生成で使う)より先に
  // 設定しておく必要がある。mount()側でも一度nodePositionsを構築しているが、その時点では
  // islandCenter/islandRadiusがまだ既定値(前回マップ or 初期値)のままなので、ここで正しい
  // 中心・半径が確定した後にもう一度作り直す(マス・キャラクター・装飾の高さがずれないように)。
  islandCenter = { x: centerX, z: centerZ };
  nodePositions = new Map(nodes.map((n) => [n.id, nodeVec3(n)]));
  const ground = new THREE.Mesh(
    createIslandGroundGeometry(groundRadiusX, groundRadiusZ),
    // vertexColors:trueで地区ごとの色(createIslandGroundGeometryのcolor属性)をテクスチャに
    // 乗算ブレンドする(利用者仕様書「地区ごとに5〜10%程度色を変える」対応)。
    new THREE.MeshStandardMaterial({
      ...loadGroundMaps(groundRadiusX * 2, groundRadiusZ * 2),
      // Normalは弱く(Codex合格条件「0.15〜0.25程度に抑える」道路・マス・キャラクターの視認性優先)。
      normalScale: new THREE.Vector2(0.2, 0.2),
      vertexColors: true,
    })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(centerX, -0.5, centerZ);
  ground.receiveShadow = true;
  scene.add(ground);
  scene.add(createIslandEdgeSkirt(centerX, centerZ, groundRadiusX, groundRadiusZ, 3.2));
  const groundWidth = groundRadiusX * 2;
  const groundDepth = groundRadiusZ * 2;

  const startNode = nodes.find((n) => n.nodeType === "start") || nodes[0];
  const outerPoints = computeLoopPoints(startNode.id, "outer");
  scene.add(buildRibbon(outerPoints, true));
  const firstInnerNode = nodes.find((n) => n.zone === "inner");
  if (firstInnerNode) {
    const innerPoints = computeLoopPoints(firstInnerNode.id, "inner");
    scene.add(buildRibbon(innerPoints, true));
  }
  computeConnectorSegments().forEach((segment) => scene.add(buildRibbon(segment, false)));

  buildSpaceGroups(nodes);

  placeStageDecorations(nodes, centerX, centerZ, halfX, halfZ);
  mascotEntries = new Map();
  (activeSnackNodeIds || []).forEach((nodeId) => createMascotEntry(nodeId));

  characters = new Map();
  (players || []).forEach((p) => createCharacterEntry(p));

  const light = new THREE.DirectionalLight(0xffffff, 1.8);
  light.position.set(4, 8, 5);
  light.castShadow = true;
  light.shadow.mapSize.set(1024, 1024);
  const shadowExtent = Math.max(groundWidth, groundDepth);
  light.shadow.camera.left = -shadowExtent * 0.5;
  light.shadow.camera.right = shadowExtent * 0.5;
  light.shadow.camera.top = shadowExtent * 0.5;
  light.shadow.camera.bottom = -shadowExtent * 0.5;
  scene.add(light);
  scene.add(new THREE.AmbientLight(0xffffff, 0.55));
}

// 1〜6の目を白い角丸カードに黒(赤)の目玉で描いたテクスチャをCanvasで生成する。
// GLB素材(item-dice-plus1.glb等)は「+1」等の専用アイコンで汎用の目玉表現には使えないため、
// マリオパーティ風のサイコロ演出専用に軽量な手続き生成テクスチャで用意する。
function createDiceFaceTexture(value) {
  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#fbfaf5";
  ctx.beginPath();
  const r = 20;
  ctx.moveTo(r, 4);
  ctx.arcTo(124, 4, 124, 124, r);
  ctx.arcTo(124, 124, 4, 124, r);
  ctx.arcTo(4, 124, 4, 4, r);
  ctx.arcTo(4, 4, 124, 4, r);
  ctx.closePath();
  ctx.fill();
  ctx.lineWidth = 4;
  ctx.strokeStyle = "#c9a15a";
  ctx.stroke();
  ctx.fillStyle = "#d8442c";
  const pipLayout = {
    1: [[64, 64]],
    2: [[40, 40], [88, 88]],
    3: [[40, 40], [64, 64], [88, 88]],
    4: [[40, 40], [88, 40], [40, 88], [88, 88]],
    5: [[40, 40], [88, 40], [64, 64], [40, 88], [88, 88]],
    6: [[40, 34], [88, 34], [40, 64], [88, 64], [40, 94], [88, 94]],
  }[value] || [];
  pipLayout.forEach(([x, y]) => {
    ctx.beginPath();
    ctx.arc(x, y, 11, 0, Math.PI * 2);
    ctx.fill();
  });
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function getDiceFaceTexture(value) {
  if (!diceFaceTextureCache[value]) diceFaceTextureCache[value] = createDiceFaceTexture(value);
  return diceFaceTextureCache[value];
}

function ensureDiceMesh() {
  if (diceMesh) return diceMesh;
  const geometry = new THREE.BoxGeometry(DICE_SIZE, DICE_SIZE, DICE_SIZE);
  const materials = [0, 1, 2, 3, 4, 5].map(() => new THREE.MeshStandardMaterial({ color: 0xffffff }));
  diceMesh = new THREE.Mesh(geometry, materials);
  diceMesh.visible = false;
  diceMesh.castShadow = true;
  return diceMesh;
}

// 2026-08-15、以前は6面すべてに結果(value)と同じテクスチャを貼っていたため、
// 回転演出中もずっと結果の数字しか見えない不具合があった(利用者指摘)。着地時の
// mesh.rotation.set(0,0,0)で正面を向くのは主にBoxGeometryの material[2](+Y、上面)と
// material[4](+Z、正面)のため、この2面にだけvalueを割り当てて「静止時は必ず正しい
// 出目が見える」ことを保証しつつ、残り4面(左右・下・背面)には他の目を割り振ることで、
// 回転中はいろいろな目が切り替わって見えるようにした。
function setDiceFaceValue(mesh, value) {
  const others = [1, 2, 3, 4, 5, 6].filter((v) => v !== value);
  // material配列順序: [+X, -X, +Y, -Y, +Z, -Z](右/左/上/下/正面/背面)
  const faceValues = [others[0], others[1], value, others[2], value, others[3]];
  mesh.material.forEach((mat, i) => {
    mat.map = getDiceFaceTexture(faceValues[i]);
    mat.needsUpdate = true;
  });
}

// マリオパーティ風、頭上でサイコロが高速回転→終盤にジャンプしながら減速して止まる演出。
// snack-engine.jsは移動を同期的に一括処理するため出目(value)は既に確定済みの値を渡す
// (この演出はあくまで見た目で、ゲームロジックの結果には影響しない)。戻り値のPromiseは
// 演出(回転+着地+一瞬の静止)が完了したタイミングでresolveする。
// speedScale: 演出速度設定に応じた倍率(1=標準、大きいほど速く見える)。
function playDiceRoll(playerId, value, speedScale) {
  return new Promise((resolve) => {
    const entry = characters.get(playerId);
    if (!entry || !scene) {
      resolve();
      return;
    }
    const mesh = ensureDiceMesh();
    if (!mesh.parent) scene.add(mesh);
    setDiceFaceValue(mesh, value);
    mesh.visible = true;
    mesh.rotation.set(0, 0, 0);
    diceAnim = { playerId, mesh, startTime: performance.now(), settled: false, resolve, speedScale: speedScale || 1 };
  });
}

function finishDiceAnim() {
  if (!diceAnim) return;
  const anim = diceAnim;
  diceAnim = null;
  if (anim.mesh) anim.mesh.visible = false;
  anim.resolve();
}

function updateDiceAnim(now) {
  if (!diceAnim) return;
  const entry = characters.get(diceAnim.playerId);
  if (!entry) {
    finishDiceAnim();
    return;
  }
  const mesh = diceAnim.mesh;
  const pos = entry.group.position;
  const elapsed = (now - diceAnim.startTime) * (diceAnim.speedScale || 1);
  if (elapsed < DICE_SPIN_DURATION_MS) {
    const t = elapsed / DICE_SPIN_DURATION_MS;
    mesh.position.set(pos.x, pos.y + DICE_HEAD_HEIGHT + Math.sin(t * Math.PI * 3) * 0.18 + 0.15, pos.z);
    mesh.rotation.x += 0.35;
    mesh.rotation.y += 0.28;
    mesh.rotation.z += 0.18;
  } else if (elapsed < DICE_SPIN_DURATION_MS + DICE_SETTLE_DURATION_MS) {
    const t = (elapsed - DICE_SPIN_DURATION_MS) / DICE_SETTLE_DURATION_MS;
    const bounce = Math.sin(t * Math.PI);
    mesh.rotation.x *= 0.8;
    mesh.rotation.y *= 0.8;
    mesh.rotation.z *= 0.8;
    mesh.position.set(pos.x, pos.y + DICE_HEAD_HEIGHT + bounce * 0.22, pos.z);
  } else if (!diceAnim.settled) {
    diceAnim.settled = true;
    mesh.rotation.set(0, 0, 0);
    mesh.position.set(pos.x, pos.y + DICE_HEAD_HEIGHT, pos.z);
    setTimeout(finishDiceAnim, DICE_HOLD_DURATION_MS);
  } else {
    mesh.position.set(pos.x, pos.y + DICE_HEAD_HEIGHT, pos.z);
  }
}

function animate() {
  animationFrameId = requestAnimationFrame(animate);
  const now = performance.now();
  characters.forEach((entry) => updateHopForEntry(entry, now));
  applySameNodeLayout();
  mascotEntries.forEach((entry) => {
    if (entry.model) entry.model.position.y = entry.baseY + Math.sin(now / 500) * 0.08;
  });
  updatePlayerRings();
  updateDiceAnim(now);
  updateCamera();
  updateSnackSpaceSymbols(now);
  renderer.render(scene, camera);
}

// canvasEl: マウント先の<canvas>。options.nodes: SNACK_STAGE_NODES(snack-data.js)。
// options.players: state.players([{id, currentNodeId, avatar:{color,speciesId,...}}, ...])。
// options.currentTurnIndex: 初期カメラの追従対象。options.activeSnackNodeIds: おやつ出現地点(配列)。
function mount(canvasEl, options) {
  if (renderer) dispose();
  sceneGeneration += 1;
  const opts = options || {};
  const nodes = opts.nodes || [];
  nodeMap = new Map(nodes.map((n) => [n.id, n]));
  nodePositions = new Map(nodes.map((n) => [n.id, nodeVec3(n)]));
  mapBounds = computeMapBounds();
  cameraMode = "follow";
  zoomState = { level: 1.9, panX: 0, panZ: 0 };

  renderer = new THREE.WebGLRenderer({ canvas: canvasEl, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  camera = new THREE.PerspectiveCamera(55, 1, 0.1, 200);

  const players = opts.players || [];
  const turnPlayer = typeof opts.currentTurnIndex === "number" ? players[opts.currentTurnIndex] : null;
  focusPlayerId = (turnPlayer && turnPlayer.id) || (players[0] && players[0].id) || null;
  isMoving = false;
  const focusStartPos =
    (turnPlayer && nodePositions.get(turnPlayer.currentNodeId)) ||
    (players[0] && nodePositions.get(players[0].currentNodeId)) ||
    new THREE.Vector3();
  cameraCurrentPos.set(focusStartPos.x - CAMERA_IDLE.trail, CAMERA_IDLE.up, focusStartPos.z + CAMERA_IDLE.back);
  camera.position.copy(cameraCurrentPos);

  buildScene(nodes, players, opts.activeSnackNodeIds);

  resize();
  window.addEventListener("resize", resize);
  animate();
}

function dispose() {
  if (animationFrameId) cancelAnimationFrame(animationFrameId);
  animationFrameId = null;
  window.removeEventListener("resize", resize);
  detachZoomPointerHandlers();
  if (diceAnim) finishDiceAnim();
  if (renderer) renderer.dispose();
  renderer = null;
  scene = null;
  camera = null;
  characters = new Map();
  spaceSymbols = [];
  symbolLodInitialized = false;
  mascotEntries = new Map();
  trapMarkerEntries = new Map();
  playerRings = new Map();
  diceMesh = null;
  cameraMode = "follow";
  mapBounds = null;
  diceFocusPlayerId = null;
  branchOverviewNodeId = null;
  snackRevealNodeId = null;
  orderLineupIds = [];
  orderLineupAllIds = [];
}

window.LifeRoadSnackBoard3D = {
  mount,
  dispose,
  syncPlayers,
  focusCamera,
  playDiceRoll,
  hopPath,
  playMapIntro,
  enterOverview,
  enterZoom,
  exitMapView,
  enterDiceFocus,
  exitDiceFocus,
  enterBranchOverview,
  exitBranchOverview,
  enterSnackReveal,
  exitSnackReveal,
  enterOrderLineup,
  exitOrderLineup,
};
