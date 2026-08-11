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
const HOP_DURATION_MS = 450;
const CAMERA_LERP = 0.06;

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
};

// snack-data.jsのnodeType別の色分け(2D版のイメージに寄せた簡易配色)
const SNACK_NODE_TYPE_COLORS = {
  start: 0xfff3cd,
  normal: 0xf9f1dc,
  job: 0xe8f0fe,
  coin: 0xfff0b3,
  payday: 0xe6f4ea,
  shop: 0xffe0b3,
  branch: 0xd9a066,
  income: 0xd7f5df,
  choice: 0xfff0e0,
  rest: 0xffffff,
  expense: 0xfdeaea,
  "item-box": 0xe0d7fb,
};

const textureLoader = new THREE.TextureLoader();

let renderer = null;
let scene = null;
let camera = null;
let characters = new Map(); // playerId -> entry
let nodeMap = new Map(); // nodeId -> node
let nodePositions = new Map(); // nodeId -> THREE.Vector3
let nodeMarkers = [];
let mascotState = null; // { nodeId, entry: { group } }
let focusPlayerId = null;
let animationFrameId = null;
let sceneGeneration = 0;
const cameraTarget = new THREE.Vector3();

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

// 外周ループを"start"ノードからnextNodeIds(outer側)を辿って順序復元する
// (id命名規則に依存せず、データが多少組み替わっても壊れないようにするため)。
function computeOuterLoopPoints(startId) {
  const start = nodeMap.get(startId);
  const points = [];
  let cur = start;
  const seen = new Set();
  while (cur && !seen.has(cur.id)) {
    points.push(nodeVec3(cur));
    seen.add(cur.id);
    const nextOuterId = cur.nextNodeIds.find((id) => nodeMap.get(id) && nodeMap.get(id).zone === "outer");
    cur = nextOuterId ? nodeMap.get(nextOuterId) : null;
  }
  return points;
}

// 分岐ノード(外周→内周)からnextNodeIdsを辿り、内周を通って外周へ合流するまでの点列を作る。
function computeInnerShortcutPoints() {
  const branchNode = [...nodeMap.values()].find(
    (n) => n.zone === "outer" && n.nextNodeIds.some((id) => nodeMap.get(id) && nodeMap.get(id).zone === "inner")
  );
  if (!branchNode) return null;
  const firstInnerId = branchNode.nextNodeIds.find((id) => nodeMap.get(id) && nodeMap.get(id).zone === "inner");
  const points = [nodeVec3(branchNode)];
  let cur = nodeMap.get(firstInnerId);
  let mergeNode = null;
  while (cur) {
    points.push(nodeVec3(cur));
    const next = nodeMap.get(cur.nextNodeIds[0]);
    if (!next || next.zone !== "inner") {
      mergeNode = next;
      break;
    }
    cur = next;
  }
  if (mergeNode) points.push(nodeVec3(mergeNode));
  return points;
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

function placeStageDecorations(nodes, centerX, centerZ, halfX, halfZ) {
  const jobNode = nodes.find((n) => n.nodeType === "job");
  if (jobNode) {
    const pos = nodePositions.get(jobNode.id);
    const dir = new THREE.Vector3(pos.x - centerX, 0, pos.z - centerZ).normalize();
    const group = new THREE.Group();
    group.position.set(pos.x + dir.x * 1.7, 0, pos.z + dir.z * 1.7);
    group.rotation.y = Math.atan2(-dir.x, -dir.z);
    scene.add(group);
    loadDecorationModel(group, SNACK_STAGE_MODELS.jobCenter);
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
    .slice(0, 3);
  flowerNodes.forEach((n) => {
    const pos = nodePositions.get(n.id);
    const dir = new THREE.Vector3(pos.x - centerX, 0, pos.z - centerZ).normalize();
    const group = new THREE.Group();
    group.position.set(pos.x + dir.x * 1.3, 0, pos.z + dir.z * 1.3);
    group.rotation.y = Math.atan2(-dir.x, -dir.z);
    scene.add(group);
    loadDecorationModel(group, SNACK_STAGE_MODELS.flowerbed);
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
}

function createMascotEntry(nodeId) {
  if (!nodeId) return;
  const pos = nodePositions.get(nodeId);
  if (!pos) return;
  const group = new THREE.Group();
  group.position.set(pos.x, 0, pos.z);
  scene.add(group);
  mascotState = { nodeId, entry: { group } };
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
  const entry = { group, placeholder, hop: null, currentNodeId: player.currentNodeId };
  characters.set(player.id, entry);
  loadSnackCharacterModel(entry, visual.speciesId);
  return entry;
}

// 移動元→移動先ノードのワールド座標を直線+放物線アーチで結ぶ簡易ホップ演出。
// (snack-engine.jsは1手番の移動を同期的に一括処理し、途中で通ったノードの列を
// 外部へ公開していないため、board3d.jsのようなマスごとの逐次ホップは行わず、
// 最終的な移動先だけを1回のホップで表現する簡易版にしている)
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
    entry.hop = null;
  }
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
        entry.hop = { from: fromPos, to: toPos, toNodeId: p.currentNodeId, startTime: performance.now(), durationMs: HOP_DURATION_MS };
      } else {
        entry.currentNodeId = p.currentNodeId;
      }
    }
  });
  syncMascot(activeSnackNodeId);
}

function focusCamera(playerId) {
  if (playerId) focusPlayerId = playerId;
}

function updateCamera() {
  if (!camera) return;
  const entry = focusPlayerId ? characters.get(focusPlayerId) : null;
  const focusPos = entry ? entry.group.position : cameraTarget;
  // ループ全体を常に見渡せる固定の俯瞰視点を基本にしつつ、注視点だけを現在の手番プレイヤー側へ
  // ごくわずかに寄せる(中心からの距離を1/3程度に抑え、ループ全体が視界から外れないようにする)。
  const desiredTarget = new THREE.Vector3(focusPos.x * 0.35, 0.4, focusPos.z * 0.35);
  cameraTarget.lerp(desiredTarget, CAMERA_LERP);
  camera.lookAt(cameraTarget);
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

  const groundWidth = halfX * 2 * 1.9 + 8;
  const groundDepth = halfZ * 2 * 1.9 + 8;
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(groundWidth, groundDepth),
    new THREE.MeshStandardMaterial({ map: loadGroundTexture(groundWidth, groundDepth) })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(centerX, -0.5, centerZ);
  ground.receiveShadow = true;
  scene.add(ground);

  const startNode = nodes.find((n) => n.nodeType === "start") || nodes[0];
  const outerPoints = computeOuterLoopPoints(startNode.id);
  scene.add(buildRibbon(outerPoints, true));
  const innerPoints = computeInnerShortcutPoints();
  if (innerPoints) scene.add(buildRibbon(innerPoints, false));

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

  const overviewBack = halfZ * 1.9 + 6;
  const overviewUp = Math.max(halfX, halfZ) * 1.7 + 6;
  camera.position.set(centerX, overviewUp, centerZ + overviewBack);
  cameraTarget.set(centerX, 0.4, centerZ);
  camera.lookAt(cameraTarget);
}

function animate() {
  animationFrameId = requestAnimationFrame(animate);
  const now = performance.now();
  characters.forEach((entry) => updateHopForEntry(entry, now));
  if (mascotState && mascotState.entry) {
    mascotState.entry.group.position.y = 0.15 + Math.sin(now / 500) * 0.08;
  }
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

  buildScene(nodes, opts.players, opts.activeSnackNodeId);

  const players = opts.players || [];
  const turnPlayer = typeof opts.currentTurnIndex === "number" ? players[opts.currentTurnIndex] : null;
  focusPlayerId = (turnPlayer && turnPlayer.id) || (players[0] && players[0].id) || null;

  resize();
  window.addEventListener("resize", resize);
  animate();
}

function dispose() {
  if (animationFrameId) cancelAnimationFrame(animationFrameId);
  animationFrameId = null;
  window.removeEventListener("resize", resize);
  if (renderer) renderer.dispose();
  renderer = null;
  scene = null;
  camera = null;
  characters = new Map();
  nodeMarkers = [];
  mascotState = null;
}

window.LifeRoadSnackBoard3D = { mount, dispose, syncPlayers, focusCamera };
