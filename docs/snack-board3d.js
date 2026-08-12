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

// マス土台モデル(masu-base.glb)。本編(board3d.js)と全く同じ無地モデル・scale・yOffsetを
// 再利用し、マテリアル色だけマスの種類ごとに上書きする(2026-08-12、平らな色付き円盤の
// プレースホルダーから本編と同じ3D土台へ差し替え。マス間隔が本編のSQUARE_SPACING=2.2相当に
// なるよう合わせたこととあわせて、見た目のクオリティを本編と揃える狙い)。
const SNACK_MASU_BASE_MODEL = {
  url: new URL("./models/masu-base.glb", import.meta.url).href,
  scale: 0.85,
  yOffset: -0.14,
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

// snack-data.jsのnodeType別の色分け。2026-08-12、ユーザー要望により「お金が増える=青・
// 減る=赤・特殊な選択/イベント=緑」の3系統がひと目で分かる配色に変更(coin/payday/incomeは
// 収入系で青、expenseは支出系で赤、job/branch/choiceは特殊な分岐・選択系で緑に統一。
// start/rest/shop/item-boxはお金の増減系ではないため、用途が分かる独立した色を維持)。
const SNACK_NODE_TYPE_COLORS = {
  start: 0xfff3cd,
  normal: 0xf3ede0,
  job: 0xbdeecb,
  coin: 0xbfe0fb,
  payday: 0xbfe0fb,
  shop: 0xffd9a6,
  branch: 0xbdeecb,
  income: 0xbfe0fb,
  choice: 0xbdeecb,
  rest: 0xffffff,
  expense: 0xf7b8b8,
  "item-box": 0xdcc9f7,
};

const textureLoader = new THREE.TextureLoader();

let renderer = null;
let scene = null;
let camera = null;
let characters = new Map(); // playerId -> entry
let nodeMap = new Map(); // nodeId -> node
let nodePositions = new Map(); // nodeId -> THREE.Vector3
let nodeMarkers = [];
let mascotState = null; // { nodeId, entry: { group, model, baseY } }
let focusPlayerId = null;
let isMoving = false; // 追従対象(focusPlayerId)が現在ホップ移動中かどうか
let animationFrameId = null;
let sceneGeneration = 0;
const cameraCurrentPos = new THREE.Vector3();
let trapMarkerEntries = new Map(); // nodeId -> THREE.Group(発動中の罠マーカー)
let turnRingGroup = null;
let diceMesh = null;
let diceAnim = null; // { playerId, mesh, startTime, settled, resolve }
const diceFaceTextureCache = {};

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

// masu-base.glbは全ノード共通の形状なので1回だけ読み込み、ノードの数だけクローンして
// マテリアル色だけノードの種類ごとに変える(本編board3d.jsのloadMasuBaseInstancesと同じ手法)。
// 読み込み完了後、buildScene側が用意した仮のプレースホルダー(nodeMarkers)を実モデルに差し替える。
function loadSnackMasuBaseInstances(nodes) {
  const generation = sceneGeneration;
  loadGLTFSceneCached(SNACK_MASU_BASE_MODEL.url)
    .then((template) => {
      if (generation !== sceneGeneration) return;
      nodes.forEach((n, i) => {
        if (nodeMarkers[i]) scene.remove(nodeMarkers[i]);
        const instance = template.clone(true);
        instance.traverse((node) => {
          if (node.isMesh) {
            node.material = node.material.clone();
            node.material.color.setHex(SNACK_NODE_TYPE_COLORS[n.nodeType] ?? 0xf9f1dc);
            node.receiveShadow = true;
          }
        });
        instance.scale.setScalar(SNACK_MASU_BASE_MODEL.scale);
        const pos = nodePositions.get(n.id);
        instance.position.set(pos.x, SNACK_MASU_BASE_MODEL.yOffset, pos.z);
        scene.add(instance);
        nodeMarkers[i] = instance;
      });
    })
    .catch((err) => {
      console.warn("おやつ集めモード: マス土台モデルの読み込みに失敗、プレースホルダーのまま続行します", err);
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

// 現在の手番プレイヤーの足元に表示するリング。モデルが縦向き(Y軸方向に厚い円盤)のため
// X軸-90°回転させて地面に寝かせる(loadDecorationModelの共通ロジックは使わず専用に実装)。
function ensureTurnRing() {
  if (turnRingGroup) return turnRingGroup;
  turnRingGroup = new THREE.Group();
  scene.add(turnRingGroup);
  const generation = sceneGeneration;
  loadGLTFSceneCached(SNACK_STAGE_MODELS.turnRing.url)
    .then((template) => {
      if (generation !== sceneGeneration) return;
      const model = template.clone(true);
      model.scale.setScalar(SNACK_STAGE_MODELS.turnRing.scale);
      model.rotation.x = -Math.PI / 2;
      model.position.y = 0.03;
      model.traverse((node) => {
        if (node.isMesh) node.receiveShadow = true;
      });
      turnRingGroup.add(model);
    })
    .catch((err) => {
      console.warn("現在の手番リングモデルの読み込みに失敗", err);
    });
  return turnRingGroup;
}

function updateTurnRing() {
  if (!scene) return;
  const entry = focusPlayerId ? characters.get(focusPlayerId) : null;
  if (!entry) return;
  const ring = ensureTurnRing();
  ring.position.set(entry.group.position.x, 0.02, entry.group.position.z);
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
  const entry = { group, placeholder, hop: null, currentNodeId: player.currentNodeId, playerId: player.id };
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
async function hopPath(playerId, pathNodeIds) {
  const entry = characters.get(playerId);
  if (!entry || !pathNodeIds || !pathNodeIds.length) return;
  const isFocus = playerId === focusPlayerId;
  if (isFocus) isMoving = true;
  let fromPos = nodePositions.get(entry.currentNodeId) || entry.group.position.clone();
  for (const nodeId of pathNodeIds) {
    const toPos = nodePositions.get(nodeId);
    if (!toPos) break;
    await hopToNode(entry, fromPos, toPos, nodeId, HOP_STEP_DURATION_MS);
    fromPos = toPos;
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

// すごろく本編(board3d.js)と同じ「静止時=ジオラマ風の見下ろし固定角度/移動中=進行方向の
// 真後ろから追う三人称視点」の2段構成(2026-08-11、ユーザー指示で本編と統一)。
function updateCamera() {
  if (!camera) return;
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
  turnRingGroup = null;
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

  // masu-base.glb読み込み完了までの間だけ見せる仮のプレースホルダー(本編board3d.jsと同じ手法)。
  nodeMarkers = [];
  nodes.forEach((n) => {
    const marker = new THREE.Mesh(
      new THREE.CylinderGeometry(0.42, 0.42, 0.14, 16),
      new THREE.MeshStandardMaterial({ color: SNACK_NODE_TYPE_COLORS[n.nodeType] ?? 0xf9f1dc })
    );
    const pos = nodePositions.get(n.id);
    marker.position.set(pos.x, -0.38, pos.z);
    marker.receiveShadow = true;
    scene.add(marker);
    nodeMarkers.push(marker);
  });
  loadSnackMasuBaseInstances(nodes);

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
function playDiceRoll(playerId, value) {
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
    diceAnim = { playerId, mesh, startTime: performance.now(), settled: false, resolve };
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
  const elapsed = now - diceAnim.startTime;
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
  updateTurnRing();
  updateDiceAnim(now);
  updateCamera();
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
  if (diceAnim) finishDiceAnim();
  if (renderer) renderer.dispose();
  renderer = null;
  scene = null;
  camera = null;
  characters = new Map();
  nodeMarkers = [];
  mascotState = null;
  trapMarkerEntries = new Map();
  turnRingGroup = null;
  diceMesh = null;
}

window.LifeRoadSnackBoard3D = { mount, dispose, syncPlayers, focusCamera, playDiceRoll, hopPath };
