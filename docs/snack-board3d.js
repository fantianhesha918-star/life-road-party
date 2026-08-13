// アニマルライフ「おやつ集めモード」フェーズ1(試作)の3Dマップ。
// 既存board3d.js(直線・単一パス・整数indexの盤面)とはデータ構造が別物のため、
// 専用の描画コードとして新規に用意する(既存board3d.jsは変更しない)。
// キャラクターモデル定義(SPECIES_MODEL_MAP)は、試作段階では重複を許容してboard3d.jsから
// そのままコピーして開始する(plan通り。重複が問題になれば共通ファイルへ切り出す)。
import * as THREE from "three";
import { loadGLTFSceneCached } from "./gltf-cache.js";

const SKY_BACKDROP_URL = new URL("./images/sky-backdrop.jpg", import.meta.url).href;
const GROUND_TEXTURE_URL = new URL("./images/ground-grass.jpg", import.meta.url).href;
const ROAD_TEXTURE_URL = new URL("./images/road-path.jpg", import.meta.url).href;

const ROAD_HALF_WIDTH = 0.9;
const HOP_HEIGHT = 0.5;
const HOP_DURATION_MS = 450; // syncPlayersが差分から直接1回ホップさせるフォールバック用
// 1マスずつの逐次ホップ(hopPath)専用の短めの時間。旧来の「移動元→移動先を1回で結ぶ」演出用
// のHOP_DURATION_MSのまま複数マスに使うと合計時間が長くなりすぎるため別定数にした(2026-08-12)。
const HOP_STEP_DURATION_MS = 260;
// カメラはすごろく本編(board3d.js)と同じ「静止時=ジオラマ風の見下ろし/移動中=進行方向の
// 真後ろから追う三人称視点」の2段構成にする(2026-08-11、ユーザー指示で本編と統一)。
// ループ型マップでも、追従先はあくまで現在の手番プレイヤー1人なので同じ値をそのまま使える。
const CAMERA_IDLE = { back: 6.0, up: 5.2, trail: 3.4 };
const CAMERA_MOVE = { up: 1.7, trail: 2.5 };
const CAMERA_LERP = 0.08;

// マリオパーティ風、頭上でサイコロが回転→ジャンプしながら着地して出目を確定させる演出用の定数。
const DICE_SIZE = 0.42;
const DICE_HEAD_HEIGHT = 1.15;
const DICE_SPIN_DURATION_MS = 700;
const DICE_SETTLE_DURATION_MS = 380;
const DICE_HOLD_DURATION_MS = 260;

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
  // 中央広場の円形タイル。目標直径3.0
  plazaCircle: {
    url: new URL("./models/facility-plaza-circle.glb", import.meta.url).href,
    scale: 1.5,
    yOffset: 0.173,
  },
  // 遠景の丘(背景装飾)。目標幅6.0
  distantHill: {
    url: new URL("./models/scenery-distant-hill.glb", import.meta.url).href,
    scale: 3.0,
    yOffset: 0.381,
  },
  // 中央広場の肉球噴水(花壇部分と差し替え設置)。目標直径1.4
  pawFountain: {
    url: new URL("./models/prop-paw-fountain.glb", import.meta.url).href,
    scale: 0.7,
    yOffset: 0.135,
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

// 方角ゾーン(見本の北西=駅、北=オフィス、東=学校/病院/集合住宅、南=教会/住宅、西=公園)の
// 建物・小物。本編(board3d.js)で使用中の素材・scale/yOffsetをそのまま再利用する
// (2026-08-12、Box3実測をやり直さず本編の実測値を流用。値は board3d.js の STAGE_PROP_MODELS 参照)。
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
  office: ["building-office", "building-shop"],
  school: ["building-school", "building-hospital", "building-apartment"],
  church: ["facility-church", "building-house"],
  park: ["facility-park"],
};
const SNACK_TREE_MODEL_KEYS = ["tree-round", "tree-conifer"];
const SNACK_STREET_PROP_MODEL_KEYS = ["prop-streetlamp", "prop-bench", "prop-signboard"];
// ゾーン内の建物・木・小物同士が近すぎる場合に間引く最小距離(本編のSTAGE_PROP_MIN_CROSS_GAP_DISTと同じ考え方)
const SNACK_ZONE_PROP_MIN_GAP = 2.4;

const textureLoader = new THREE.TextureLoader();

// ==================== 通常マス2.5D(共通シリンダー土台+種類別PNGインポスター) ====================
// 2026-08-13、Codexの「通常マス2.5D実装仕様書」により正式採用。個別3Dモデル化やマテリアル色分け
// (旧SNACK_NODE_TYPE_COLORS)ではなく、全マス共通のクリーム色シリンダー土台(InstancedMesh、
// 1ジオメトリ・1マテリアルを共有)+種類別の透過PNGを貼ったカメラ追従インポスターで16種類を表現する。
const SPACE_METRICS = {
  diameter: 1.0,
  baseHeight: 0.16,
  visualWidth: 1.12,
  visualLift: 0.015,
};
// 旧プレースホルダー円柱(高さ0.14、中心y=-0.38)の上面(-0.31)を踏襲し、キャラクター(y=0基準)
// との相対位置が変わらないようにする土台上面の基準高さ。実機確認の上で微調整すること。
const SPACE_GROUND_Y = -0.31;

// ロジック側のnodeType(snack-data.js)と表示用PNGファイル名を直結させないための対応表
// (仕様書11章)。snack-data.jsで実際に使われているnodeTypeは12種のみ(仕様書側は16種、
// event/paidGate/warp/family/investmentは現行データに存在しない予備枠)。branchは「分岐」の
// 意味でjunction画像、item-boxはitem画像、startは既存のgate-start.glbで既に区別済みのため
// normal画像へフォールバックする。
const SPACE_VISUAL_MAP = {
  start: "space-normal.png",
  normal: "space-normal.png",
  job: "space-job.png",
  coin: "space-coin.png",
  payday: "space-payday.png",
  shop: "space-shop.png",
  branch: "space-junction.png",
  income: "space-income.png",
  choice: "space-choice.png",
  rest: "space-rest.png",
  expense: "space-expense.png",
  "item-box": "space-item.png",
};
const SPACE_IMAGE_BASE = new URL("./images/snack-spaces/", import.meta.url).href;
const spaceTextureCache = new Map(); // ファイル名 -> Promise<Texture>(同じ種類のマスでTexture/Materialを共有する)

function loadSpaceTexture(fileName) {
  if (spaceTextureCache.has(fileName)) return spaceTextureCache.get(fileName);
  const promise = new Promise((resolve, reject) => {
    textureLoader.load(
      SPACE_IMAGE_BASE + fileName,
      (tex) => {
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.minFilter = THREE.LinearMipmapLinearFilter;
        tex.anisotropy = 4;
        resolve(tex);
      },
      undefined,
      reject
    );
  });
  spaceTextureCache.set(fileName, promise);
  return promise;
}

let spaceBaseMesh = null; // 全マス共通のクリーム色シリンダー土台(InstancedMesh)
let spaceImpostors = []; // [{ nodeId, mesh }]
let lastImpostorCameraPos = new THREE.Vector3();
let impostorsInitialized = false;

// 各ノードへ、共通シリンダー土台(1個のInstancedMeshをノード数ぶんインスタンス化)と、
// 種類別PNGを貼ったカメラ追従インポスター(仕様書5章のupdateSpaceImpostor例に準拠、
// 水平回転はカメラ方位へ追従・垂直角度は固定)を生成する。PNG読込失敗時は通常マスへ
// フォールバックし進行を止めない(仕様書9章)。
function buildSpaceGroups(nodes) {
  const geometry = new THREE.CylinderGeometry(SPACE_METRICS.diameter / 2, SPACE_METRICS.diameter / 2, SPACE_METRICS.baseHeight, 24);
  const material = new THREE.MeshStandardMaterial({ color: 0xead7b6, roughness: 0.88, metalness: 0 });
  spaceBaseMesh = new THREE.InstancedMesh(geometry, material, nodes.length);
  spaceBaseMesh.receiveShadow = true;
  spaceBaseMesh.castShadow = false;
  const dummy = new THREE.Object3D();
  nodes.forEach((n, i) => {
    const pos = nodePositions.get(n.id);
    dummy.position.set(pos.x, SPACE_GROUND_Y - SPACE_METRICS.baseHeight / 2, pos.z);
    dummy.updateMatrix();
    spaceBaseMesh.setMatrixAt(i, dummy.matrix);
  });
  spaceBaseMesh.instanceMatrix.needsUpdate = true;
  scene.add(spaceBaseMesh);

  spaceImpostors = [];
  const planeGeo = new THREE.PlaneGeometry(SPACE_METRICS.visualWidth, SPACE_METRICS.visualWidth);
  nodes.forEach((n) => {
    const fileName = SPACE_VISUAL_MAP[n.nodeType] || "space-normal.png";
    const impostorMaterial = new THREE.MeshBasicMaterial({
      transparent: true,
      alphaTest: 0.03,
      depthTest: true,
      depthWrite: true,
      polygonOffset: true,
      polygonOffsetFactor: -1,
    });
    const mesh = new THREE.Mesh(planeGeo, impostorMaterial);
    const pos = nodePositions.get(n.id);
    mesh.position.set(pos.x, SPACE_GROUND_Y + SPACE_METRICS.visualLift, pos.z);
    mesh.rotation.set(-Math.PI * 0.34, 0, 0);
    scene.add(mesh);
    spaceImpostors.push({ nodeId: n.id, mesh });
    loadSpaceTexture(fileName)
      .then((tex) => {
        impostorMaterial.map = tex;
        impostorMaterial.needsUpdate = true;
      })
      .catch((err) => {
        console.warn("おやつ集めモード: マス表示画像の読み込みに失敗、種類なしのまま続行します", fileName, err);
      });
  });
  impostorsInitialized = false;
}

// カメラが一定量動いた時だけ全マスのインポスター向きを再計算する(仕様書9章、標準プレイ中は
// 毎フレーム全マス一括更新しない、という指示に対応)。
function updateSpaceImpostors() {
  if (!camera || !spaceImpostors.length) return;
  if (impostorsInitialized && camera.position.distanceToSquared(lastImpostorCameraPos) < 0.01) return;
  lastImpostorCameraPos.copy(camera.position);
  impostorsInitialized = true;
  spaceImpostors.forEach(({ mesh }) => {
    const cameraYaw = Math.atan2(camera.position.x - mesh.position.x, camera.position.z - mesh.position.z);
    mesh.rotation.set(-Math.PI * 0.34, cameraYaw, 0);
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
let mascotState = null; // { nodeId, entry: { group, model, baseY } }
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
// "snackReveal"(おやつ地点を周回して見せる演出)
let cameraMode = "follow";
let mapBounds = null; // { centerX, centerZ, halfX, halfZ }
let zoomState = { level: 1.9, panX: 0, panZ: 0 };
let zoomPointerActive = false;
let zoomLastX = 0;
let zoomLastY = 0;
let diceFocusPlayerId = null;
let branchOverviewNodeId = null;
let snackRevealNodeId = null;
let snackRevealStartTime = 0;

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
  return new THREE.Vector3(node.position.x, 0, node.position.z);
}

function loadGroundTexture(width, depth) {
  const texture = textureLoader.load(GROUND_TEXTURE_URL);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(width / 3, depth / 3);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
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

// 外周⇔内周を結ぶ接続区間(4方向の入口+4方向の出口、計8本)の両端点列を作る。
// 入口: 外周の分岐ノード→対応する内周ノード(有料)。出口: 内周ノード→合流する外周ノード(無料)。
function computeConnectorSegments() {
  const segments = [];
  nodeMap.forEach((node) => {
    if (node.zone !== "outer") return;
    const innerNextId = node.nextNodeIds.find((id) => nodeMap.get(id) && nodeMap.get(id).zone === "inner");
    if (innerNextId) segments.push([nodeVec3(node), nodeVec3(nodeMap.get(innerNextId))]);
  });
  nodeMap.forEach((node) => {
    if (node.zone !== "inner") return;
    const outerNextId = node.nextNodeIds.find((id) => nodeMap.get(id) && nodeMap.get(id).zone === "outer");
    if (outerNextId) segments.push([nodeVec3(node), nodeVec3(nodeMap.get(outerNextId))]);
  });
  return segments;
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
    positions.push(left.x, -0.45, left.z, right.x, -0.45, right.z);
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

// 地面を矩形ではなく楕円形にし(見本の「フェルト製の島」らしい輪郭に近づける)、
// テクスチャが正しくタイル表示されるよう、ShapeGeometryの既定UV(0〜1に正規化)ではなく
// ワールド座標ベースのUVを手動で割り当てる(loadGroundTextureのrepeat.set(width/3,depth/3)と
// 揃えるため、同じ/3の係数を使う)。
function createIslandGroundGeometry(radiusX, radiusZ) {
  const shape = new THREE.Shape();
  const segments = 64;
  for (let i = 0; i <= segments; i++) {
    const angle = (i / segments) * Math.PI * 2;
    const x = Math.cos(angle) * radiusX;
    const y = Math.sin(angle) * radiusZ;
    if (i === 0) shape.moveTo(x, y);
    else shape.lineTo(x, y);
  }
  const geometry = new THREE.ShapeGeometry(shape, segments);
  const pos = geometry.attributes.position;
  const uv = new Float32Array(pos.count * 2);
  for (let i = 0; i < pos.count; i++) {
    uv[i * 2] = pos.getX(i) / 3;
    uv[i * 2 + 1] = pos.getY(i) / 3;
  }
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  return geometry;
}

// 島の側面(台座)用の縦グラデーションテクスチャ(芝生の緑→クリーム→キャメル→こげ茶)。
// Codex連携チャットが用意していたterrain-island-edge.pngは実ファイルが見つからなかったため、
// createDiceFaceTextureと同じCanvas手続き生成で代替する(2026-08-12)。
function createIslandSkirtTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 8;
  canvas.height = 128;
  const ctx = canvas.getContext("2d");
  const gradient = ctx.createLinearGradient(0, 0, 0, 128);
  gradient.addColorStop(0, "#6fa84f");
  gradient.addColorStop(0.28, "#e7d9ad");
  gradient.addColorStop(0.62, "#c99a5b");
  gradient.addColorStop(1, "#6b4a2c");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 8, 128);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

// 地面の楕円の縁から下方向・外方向へ傾斜する帯状メッシュ(buildRibbonと同じ考え方の
// リング状ジオメトリ)。マップ全体を「厚みのあるフェルト土台」に見せる。
function createIslandEdgeSkirt(centerX, centerZ, radiusX, radiusZ, depth) {
  const segments = 64;
  const outerScale = 1.06;
  const positions = [];
  const uvs = [];
  const indices = [];
  for (let i = 0; i <= segments; i++) {
    const angle = (i / segments) * Math.PI * 2;
    const topX = centerX + Math.cos(angle) * radiusX;
    const topZ = centerZ + Math.sin(angle) * radiusZ;
    const botX = centerX + Math.cos(angle) * radiusX * outerScale;
    const botZ = centerZ + Math.sin(angle) * radiusZ * outerScale;
    positions.push(topX, -0.5, topZ, botX, -0.5 - depth, botZ);
    uvs.push(0, 0, 0, 1);
  }
  for (let i = 0; i < segments; i++) {
    const a = i * 2;
    const b = i * 2 + 1;
    const c = (i + 1) * 2;
    const d = (i + 1) * 2 + 1;
    indices.push(a, c, b, b, c, d);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  const mesh = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ map: createIslandSkirtTexture() }));
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

// ノードの位置を中心から外側へoffset分押し出した位置にownerを配置する共通ヘルパー
// (中心を向く方角に応じてrotation.yも設定する。既存の各種装飾配置で繰り返していたパターン)。
function placeOutwardDecoration(pos, centerX, centerZ, offset, config) {
  const dir = new THREE.Vector3(pos.x - centerX, 0, pos.z - centerZ).normalize();
  const group = new THREE.Group();
  group.position.set(pos.x + dir.x * offset, 0, pos.z + dir.z * offset);
  group.rotation.y = Math.atan2(-dir.x, -dir.z);
  scene.add(group);
  loadDecorationModel(group, config);
  return group.position;
}

function placeStageDecorations(nodes, centerX, centerZ, halfX, halfZ) {
  const jobNode = nodes.find((n) => n.nodeType === "job");
  const zonePropPositions = [];
  if (jobNode) {
    const pos = nodePositions.get(jobNode.id);
    zonePropPositions.push(placeOutwardDecoration(pos, centerX, centerZ, 1.7, SNACK_STAGE_MODELS.jobCenter));
  }

  // 中央広場(円形タイル+肉球噴水)。CREDITS.mdの用途通り、マップの中心にまとめて設置する。
  const plazaGroup = new THREE.Group();
  plazaGroup.position.set(centerX, 0, centerZ);
  scene.add(plazaGroup);
  loadDecorationModel(plazaGroup, SNACK_STAGE_MODELS.plazaCircle);
  const fountainGroup = new THREE.Group();
  fountainGroup.position.set(centerX, 0, centerZ);
  scene.add(fountainGroup);
  loadDecorationModel(fountainGroup, SNACK_STAGE_MODELS.pawFountain);

  const flowerNodes = nodes
    .filter((n) => n.zone === "outer" && n.nodeType === "normal" && !n.snackSpawnCandidate)
    .slice(0, 6);
  flowerNodes.forEach((n) => {
    const pos = nodePositions.get(n.id);
    zonePropPositions.push(placeOutwardDecoration(pos, centerX, centerZ, 1.3, SNACK_STAGE_MODELS.flowerbed));
  });

  const hillCount = 6;
  for (let i = 0; i < hillCount; i++) {
    const angle = (i / hillCount) * Math.PI * 2;
    const hx = centerX + Math.cos(angle) * (halfX * 1.55 + 2);
    const hz = centerZ + Math.sin(angle) * (halfZ * 1.55 + 2);
    const group = new THREE.Group();
    group.position.set(hx, 0, hz);
    group.rotation.y = angle;
    scene.add(group);
    loadDecorationModel(group, SNACK_STAGE_MODELS.distantHill);
  }

  nodes
    .filter((n) => n.nodeType === "shop")
    .forEach((n) => {
      const pos = nodePositions.get(n.id);
      zonePropPositions.push(placeOutwardDecoration(pos, centerX, centerZ, 1.6, SNACK_STAGE_MODELS.shopKiosk));
    });

  nodes
    .filter((n) => n.nodeType === "branch")
    .forEach((n) => {
      const pos = nodePositions.get(n.id);
      zonePropPositions.push(placeOutwardDecoration(pos, centerX, centerZ, 1.4, SNACK_STAGE_MODELS.routeSignpost));
    });

  nodes
    .filter((n) => n.nodeType === "item-box")
    .forEach((n) => {
      const pos = nodePositions.get(n.id);
      zonePropPositions.push(placeOutwardDecoration(pos, centerX, centerZ, 1.0, SNACK_STAGE_MODELS.itemBox));
    });

  // 駅ゾーン(北西): 見本の「北西=駅、スタート地点」に合わせ、駅とスタートゲートを配置。
  const startNode = nodes.find((n) => n.nodeType === "start");
  if (startNode) {
    const pos = nodePositions.get(startNode.id);
    zonePropPositions.push(placeOutwardDecoration(pos, centerX, centerZ, 2.4, SNACK_ZONE_MODELS["building-station"]));
    zonePropPositions.push(placeOutwardDecoration(pos, centerX, centerZ, 1.2, SNACK_ZONE_MODELS["gate-start"]));
  }

  // 方角ゾーン別の建物・木・道沿いの小物を巡回配置する(見本の「北=オフィス/ショップ、
  // 東=学校/病院/集合住宅、南=教会/住宅、西=公園」というゾーン分けを再現)。
  // 既に専用装飾を置いたノード(job/shop/branch/item-box/start)は対象から外す。
  const themeCounters = {};
  const decoratedTypes = new Set(["job", "shop", "branch", "item-box", "start"]);
  const zoneEligibleNodes = nodes.filter((n) => n.zone === "outer" && !decoratedTypes.has(n.nodeType));

  function tryPlaceZoneProp(pos, offset, modelKey) {
    const config = SNACK_ZONE_MODELS[modelKey];
    if (!config) return;
    const dir = new THREE.Vector3(pos.x - centerX, 0, pos.z - centerZ).normalize();
    const worldPos = pos.clone().addScaledVector(dir, offset);
    const conflict = zonePropPositions.some((p) => p.distanceTo(worldPos) < SNACK_ZONE_PROP_MIN_GAP);
    if (conflict) return;
    const group = new THREE.Group();
    group.position.copy(worldPos);
    group.rotation.y = Math.atan2(-dir.x, -dir.z);
    scene.add(group);
    loadDecorationModel(group, config);
    zonePropPositions.push(worldPos);
  }

  zoneEligibleNodes.forEach((n, idx) => {
    const pos = nodePositions.get(n.id);
    const zoneName = n.buildingZone;
    if (zoneName === "park") {
      // 公園ゾーンは施設1つ+木を多めに配置し、緑豊かな見た目にする
      if (idx % 3 === 0) tryPlaceZoneProp(pos, 2.1, "facility-park");
      tryPlaceZoneProp(pos, 1.6, SNACK_TREE_MODEL_KEYS[idx % SNACK_TREE_MODEL_KEYS.length]);
    } else if (zoneName === "station") {
      // 駅・ゲートは上で個別配置済みのため、街灯等の小物のみ巡回配置する
    } else if (idx % 2 === 0) {
      const themeModels = SNACK_ZONE_BUILDING_THEMES[zoneName];
      if (themeModels) {
        const used = themeCounters[zoneName] || 0;
        themeCounters[zoneName] = used + 1;
        tryPlaceZoneProp(pos, 1.9, themeModels[used % themeModels.length]);
      }
    }
    const streetKey = SNACK_STREET_PROP_MODEL_KEYS[idx % SNACK_STREET_PROP_MODEL_KEYS.length];
    tryPlaceZoneProp(pos, 0.7, streetKey);
  });
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
    group.position.set(pos.x, 0, pos.z);
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
    record.group.position.set(entry.group.position.x, 0.02, entry.group.position.z);
    const isActive = playerId === focusPlayerId;
    const targetScale = isActive ? 1.35 : 0.95;
    const targetEmissive = isActive ? 0.55 : 0.15;
    record.group.scale.setScalar(record.group.scale.x + (targetScale - record.group.scale.x) * 0.15);
    record.group.traverse((node) => {
      if (node.isMesh && node.material) node.material.emissiveIntensity = targetEmissive;
    });
  });
}

function createMascotEntry(nodeId) {
  if (!nodeId) return;
  const pos = nodePositions.get(nodeId);
  if (!pos) return;
  const group = new THREE.Group();
  group.position.set(pos.x, 0, pos.z);
  scene.add(group);
  mascotState = { nodeId, entry: { group, model: null, baseY: SNACK_STAGE_MODELS.mascot.yOffset } };
  // 台座はgroup直下の別要素として追加する(マスコット本体だけを上下バウンドさせるため、
  // マスコットのモデル読み込み完了後にentry.modelへ参照を残し、groupごと動かさないようにする)。
  loadDecorationModel(group, SNACK_STAGE_MODELS.spawnPedestal);
  const generation = sceneGeneration;
  loadGLTFSceneCached(SNACK_STAGE_MODELS.mascot.url)
    .then((template) => {
      if (generation !== sceneGeneration) return;
      const model = template.clone(true);
      model.scale.setScalar(SNACK_STAGE_MODELS.mascot.scale);
      model.position.y = SNACK_STAGE_MODELS.mascot.yOffset;
      model.traverse((node) => {
        if (node.isMesh) node.castShadow = true;
      });
      group.add(model);
      mascotState.entry.model = model;
    })
    .catch((err) => {
      console.warn("おやつマスコットモデルの読み込みに失敗", err);
    });
}

function syncMascot(activeSnackNodeId) {
  if (!activeSnackNodeId || !mascotState) return;
  if (mascotState.nodeId === activeSnackNodeId) return;
  const pos = nodePositions.get(activeSnackNodeId);
  if (!pos) return;
  mascotState.nodeId = activeSnackNodeId;
  mascotState.entry.group.position.x = pos.x;
  mascotState.entry.group.position.z = pos.z;
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
  group.position.set(pos.x, 0, pos.z);
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
  entry.group.position.y = arc * HOP_HEIGHT;
  const stretch = 1 + arc * 0.08;
  entry.group.scale.set(1 / Math.sqrt(stretch), stretch, 1 / Math.sqrt(stretch));
  if (t >= 1) {
    entry.currentNodeId = hop.toNodeId;
    entry.group.position.y = 0;
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
  let fromPos = nodePositions.get(entry.currentNodeId) || entry.group.position.clone();
  for (let i = 0; i < pathNodeIds.length; i++) {
    const nodeId = pathNodeIds[i];
    const toPos = nodePositions.get(nodeId);
    if (!toPos) break;
    await hopToNode(entry, fromPos, toPos, nodeId, stepDurationMs);
    fromPos = toPos;
    if (opts.onStep) opts.onStep(i + 1, pathNodeIds.length);
  }
  if (isFocus) isMoving = false;
}

function syncPlayers(players, activeSnackNodeId) {
  if (!scene) return;
  (players || []).forEach((p) => {
    let entry = characters.get(p.id);
    if (!entry) {
      createCharacterEntry(p);
      return;
    }
    if (!entry.hop && entry.currentNodeId !== p.currentNodeId) {
      const fromPos = nodePositions.get(entry.currentNodeId) || entry.group.position.clone();
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
  syncMascot(activeSnackNodeId);
  syncTrapMarkers();
}

function focusCamera(playerId) {
  if (playerId) focusPlayerId = playerId;
}

// マップ全体を収める固定俯瞰の目標位置を計算する。zoomLevelが大きいほど寄る
// (1=全体表示相当、最大3倍)。panX/panZはズーム時のドラッグパン量(ワールド座標オフセット)。
function overviewCameraTarget(zoomLevel, panX, panZ) {
  const b = mapBounds || computeMapBounds();
  const baseDist = Math.max(b.halfX, b.halfZ) * 1.6 + 6;
  const dist = baseDist / (zoomLevel || 1);
  const cx = b.centerX + panX;
  const cz = b.centerZ + panZ;
  return {
    pos: new THREE.Vector3(cx, dist * 0.85, cz + dist * 0.6),
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
  const entry = focusPlayerId ? characters.get(focusPlayerId) : null;
  if (!entry) return;
  const focusGroup = entry.group;
  let desired;
  if (isMoving) {
    const forward = new THREE.Vector3(Math.sin(focusGroup.rotation.y), 0, Math.cos(focusGroup.rotation.y));
    desired = focusGroup.position
      .clone()
      .addScaledVector(forward, -CAMERA_MOVE.trail)
      .add(new THREE.Vector3(0, CAMERA_MOVE.up, 0));
  } else {
    desired = new THREE.Vector3(
      focusGroup.position.x - CAMERA_IDLE.trail,
      CAMERA_IDLE.up,
      focusGroup.position.z + CAMERA_IDLE.back
    );
  }
  cameraCurrentPos.lerp(desired, CAMERA_LERP);
  camera.position.copy(cameraCurrentPos);
  camera.lookAt(focusGroup.position.x, 0.5, focusGroup.position.z);
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
  const desired = new THREE.Vector3(p.x - 1.15, 2.15, p.z + 1.65);
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

// おやつ地点をゆっくり周回しながら見せる紹介演出用カメラ(仕様書14章SNACK_REVEALの
// 「おやつを回転させる」を、素材側にモデルを回すギミックが無いためカメラ側の周回で代替する簡略版)。
function updateSnackRevealCamera() {
  const pos = snackRevealNodeId ? nodePositions.get(snackRevealNodeId) : null;
  if (!pos) {
    updateOverviewCamera();
    return;
  }
  const elapsed = (performance.now() - snackRevealStartTime) / 1000;
  const angle = elapsed * 0.5;
  const radius = 2.6;
  const desired = new THREE.Vector3(pos.x + Math.cos(angle) * radius, 1.9, pos.z + Math.sin(angle) * radius);
  cameraCurrentPos.lerp(desired, CAMERA_LERP * 1.4);
  camera.position.copy(cameraCurrentPos);
  camera.lookAt(pos.x, 0.5, pos.z);
}

function enterSnackReveal(nodeId) {
  if (!nodeId || !camera) return;
  snackRevealNodeId = nodeId;
  snackRevealStartTime = performance.now();
  cameraMode = "snackReveal";
}

function exitSnackReveal() {
  if (cameraMode === "snackReveal") cameraMode = "follow";
  snackRevealNodeId = null;
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

function enterOverview() {
  detachZoomPointerHandlers();
  cameraMode = "overview";
}

function enterZoom() {
  zoomState = { level: 1.9, panX: zoomState.panX || 0, panZ: zoomState.panZ || 0 };
  cameraMode = "zoom";
  attachZoomPointerHandlers();
}

function exitMapView() {
  detachZoomPointerHandlers();
  cameraMode = "follow";
  zoomState = { level: 1.9, panX: 0, panZ: 0 };
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
  const slowPoints = [0.125, 0.375, 0.625, 0.875];
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

function buildScene(nodes, players, activeSnackNodeId) {
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
  const ground = new THREE.Mesh(
    createIslandGroundGeometry(groundRadiusX, groundRadiusZ),
    new THREE.MeshStandardMaterial({ map: loadGroundTexture(groundRadiusX * 2, groundRadiusZ * 2) })
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
  createMascotEntry(activeSnackNodeId);

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

function setDiceFaceValue(mesh, value) {
  const texture = getDiceFaceTexture(value);
  mesh.material.forEach((mat) => {
    mat.map = texture;
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
    mesh.position.set(pos.x, DICE_HEAD_HEIGHT + Math.sin(t * Math.PI * 3) * 0.18 + 0.15, pos.z);
    mesh.rotation.x += 0.35;
    mesh.rotation.y += 0.28;
    mesh.rotation.z += 0.18;
  } else if (elapsed < DICE_SPIN_DURATION_MS + DICE_SETTLE_DURATION_MS) {
    const t = (elapsed - DICE_SPIN_DURATION_MS) / DICE_SETTLE_DURATION_MS;
    const bounce = Math.sin(t * Math.PI);
    mesh.rotation.x *= 0.8;
    mesh.rotation.y *= 0.8;
    mesh.rotation.z *= 0.8;
    mesh.position.set(pos.x, DICE_HEAD_HEIGHT + bounce * 0.22, pos.z);
  } else if (!diceAnim.settled) {
    diceAnim.settled = true;
    mesh.rotation.set(0, 0, 0);
    mesh.position.set(pos.x, DICE_HEAD_HEIGHT, pos.z);
    setTimeout(finishDiceAnim, DICE_HOLD_DURATION_MS);
  } else {
    mesh.position.set(pos.x, DICE_HEAD_HEIGHT, pos.z);
  }
}

function animate() {
  animationFrameId = requestAnimationFrame(animate);
  const now = performance.now();
  characters.forEach((entry) => updateHopForEntry(entry, now));
  if (mascotState && mascotState.entry && mascotState.entry.model) {
    mascotState.entry.model.position.y = mascotState.entry.baseY + Math.sin(now / 500) * 0.08;
  }
  updatePlayerRings();
  updateDiceAnim(now);
  updateCamera();
  updateSpaceImpostors();
  renderer.render(scene, camera);
}

// canvasEl: マウント先の<canvas>。options.nodes: SNACK_STAGE_NODES(snack-data.js)。
// options.players: state.players([{id, currentNodeId, avatar:{color,speciesId,...}}, ...])。
// options.currentTurnIndex: 初期カメラの追従対象。options.activeSnackNodeId: おやつ出現地点。
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

  buildScene(nodes, players, opts.activeSnackNodeId);

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
  spaceBaseMesh = null;
  spaceImpostors = [];
  impostorsInitialized = false;
  mascotState = null;
  trapMarkerEntries = new Map();
  playerRings = new Map();
  diceMesh = null;
  cameraMode = "follow";
  mapBounds = null;
  diceFocusPlayerId = null;
  branchOverviewNodeId = null;
  snackRevealNodeId = null;
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
};
