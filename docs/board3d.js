// アニマルライフ 盤面3D化・フェーズA/B検証
// 目的: DOM UIとWebGL canvasの共存、滑らかなホップ移動、カメラのズーム追従が
// 実現できるかを検証するための最小構成。
// キャラクターはMeshy AIで生成したチンチラモデル(docs/models/chinchilla-gray.glb、
// 出典はdocs/models/CREDITS.md参照)を読み込む。ボーンアニメーションを持たない
// 静止フィギュア形状のため、動きはすべて位置・拡縮の変形(updateHopの放物線+
// スクワッシュ&ストレッチ)で表現している。
// "three"はindex.htmlのimportmapで解決される(GLTFLoader.js内部が bare specifier "three" を
// importしているため、importmapが無いとGLTFLoaderの読み込みごと失敗する)
import * as THREE from "three";
import { GLTFLoader } from "https://unpkg.com/three@0.169.0/examples/jsm/loaders/GLTFLoader.js";
import { DRACOLoader } from "https://unpkg.com/three@0.169.0/examples/jsm/loaders/DRACOLoader.js";

// chinchilla-gray.glbはBlenderでDraco圧縮して書き出しているため、GLTFLoaderに
// DRACOLoaderを明示的に渡さないと読み込みに失敗する(失敗時は仮カプセル表示のまま無言で続行してしまう)。
const dracoLoader = new DRACOLoader();
dracoLoader.setDecoderPath("https://unpkg.com/three@0.169.0/examples/jsm/libs/draco/");

const SQUARE_COUNT = 10;
const SQUARE_SPACING = 2.2;
const HOP_HEIGHT = 0.6;
// 道をゆるやかに蛇行させるsin波のパラメータ。10マス(index0〜9)で index*FREQUENCY が
// 0〜約π(半周期)になり、S字カーブ1回分になる。
const PATH_CURVE_AMPLITUDE = 1.8;
const PATH_CURVE_FREQUENCY = 0.35;
// ステージ装飾(建造物・木)をマスの間の隙間(gapIndex)ごとに配置する設定。
// 将来Codex→Meshyで実際のGLBモデルが揃ったら、このidをキーにプレースホルダーを
// 実モデルへ差し替える想定(loadCharacterModelと同じプレースホルダー→実体パターン)。
const STAGE_PROP_SIDE_OFFSET = 2.8;
const STAGE_PROP_LAYOUT = [
  { id: "building-house-1", kind: "building", model: "building-house", gapIndex: 0, side: "north" },
  { id: "tree-1", kind: "tree", gapIndex: 0, side: "south" },
  { id: "building-shop-1", kind: "building", model: "building-shop", gapIndex: 1, side: "south" },
  { id: "tree-2", kind: "tree", gapIndex: 1, side: "north" },
  { id: "facility-park-1", kind: "building", model: "facility-park", gapIndex: 2, side: "north" },
  { id: "tree-3", kind: "tree", gapIndex: 2, side: "south" },
  { id: "building-office-1", kind: "building", model: "building-office", gapIndex: 3, side: "north" },
  { id: "building-apartment-1", kind: "building", model: "building-apartment", gapIndex: 3, side: "south" },
  { id: "facility-amusement-park-1", kind: "building", model: "facility-amusement-park", gapIndex: 4, side: "north" },
  { id: "tree-4", kind: "tree", gapIndex: 4, side: "south" },
  { id: "building-restaurant-1", kind: "building", model: "building-restaurant", gapIndex: 5, side: "north" },
  { id: "building-station-1", kind: "building", model: "building-station", gapIndex: 5, side: "south" },
  { id: "facility-aquarium-1", kind: "building", model: "facility-aquarium", gapIndex: 6, side: "north" },
  { id: "tree-5", kind: "tree", gapIndex: 6, side: "south" },
  { id: "building-school-1", kind: "building", model: "building-school", gapIndex: 7, side: "north" },
  { id: "building-hospital-1", kind: "building", model: "building-hospital", gapIndex: 7, side: "south" },
  { id: "facility-zoo-1", kind: "building", model: "facility-zoo", gapIndex: 8, side: "north" },
  { id: "facility-farm-1", kind: "building", model: "facility-farm", gapIndex: 8, side: "south" },
];
// 木は「丸い葉(round)」「とんがり葉(conifer)」の2種をランダムに混ぜて配置する
const TREE_VARIANTS = ["round", "conifer"];
// Codex参考イラスト→Meshy 5(単一画像・should_remesh)→Blender軽量化(1024/Draco/JPEG)で
// 作成した実モデル。scale/yOffsetはBlenderで実測したバウンディングボックス(原点が中心)から、
// characterと同じ考え方(半径×scale=地面に接地させるための底上げ量)で逆算した値。
const STAGE_PROP_MODELS = {
  "building-house": {
    url: new URL("./models/building-house.glb", import.meta.url).href,
    scale: 1.269,
    yOffset: 1.1,
  },
  "building-shop": {
    url: new URL("./models/building-shop.glb", import.meta.url).href,
    scale: 1.061,
    yOffset: 0.9,
  },
  "tree-round": {
    url: new URL("./models/tree-round.glb", import.meta.url).href,
    scale: 0.802,
    yOffset: 0.8,
  },
  "tree-conifer": {
    url: new URL("./models/tree-conifer.glb", import.meta.url).href,
    scale: 0.95,
    yOffset: 0.95,
  },
  "building-office": {
    url: new URL("./models/building-office.glb", import.meta.url).href,
    scale: 1.3,
    yOffset: 1.3,
  },
  "building-apartment": {
    url: new URL("./models/building-apartment.glb", import.meta.url).href,
    scale: 1.2,
    yOffset: 1.2,
  },
  "building-restaurant": {
    url: new URL("./models/building-restaurant.glb", import.meta.url).href,
    scale: 1.05,
    yOffset: 0.751,
  },
  "building-station": {
    url: new URL("./models/building-station.glb", import.meta.url).href,
    scale: 1.15,
    yOffset: 0.775,
  },
  "building-school": {
    url: new URL("./models/building-school.glb", import.meta.url).href,
    scale: 1.2,
    yOffset: 0.905,
  },
  "building-hospital": {
    url: new URL("./models/building-hospital.glb", import.meta.url).href,
    scale: 1.15,
    yOffset: 1.116,
  },
  "facility-park": {
    url: new URL("./models/facility-park.glb", import.meta.url).href,
    scale: 1.3,
    yOffset: 0.803,
  },
  "facility-amusement-park": {
    url: new URL("./models/facility-amusement-park.glb", import.meta.url).href,
    scale: 1.503,
    yOffset: 1.399,
  },
  "facility-aquarium": {
    url: new URL("./models/facility-aquarium.glb", import.meta.url).href,
    scale: 1.15,
    yOffset: 0.558,
  },
  "facility-zoo": {
    url: new URL("./models/facility-zoo.glb", import.meta.url).href,
    scale: 1.1,
    yOffset: 0.626,
  },
  "facility-farm": {
    url: new URL("./models/facility-farm.glb", import.meta.url).href,
    scale: 1.2,
    yOffset: 0.737,
  },
};
// facility-bridge.glbは将来「橋の上にすごろくマスを置く」機能用に生成済みだが、
// 現時点ではSTAGE_PROP_LAYOUTに未配置(パス自体の折れ曲がり機能の実装待ち)。
// カメラは「静止時=盤面全体を見渡す見下ろし視点」「移動中=進行方向の真後ろから追う三人称視点」
// の2段構成にする(2026-08-09)。isMoving(一連のホップ中かどうか)で自動的に切り替わる。
// idleはワールド軸オフセット(character位置基準・向きには連動しない)、
// moveは進行方向ベース(updateCamera内でcharacter.rotation.yから計算)。
const CAMERA_IDLE = { back: 4.0, up: 6.5, trail: 3.5 };
const CAMERA_MOVE = { up: 1.5, trail: 2.2 };
const CAMERA_LERP = 0.08;
const CHARACTER_MODEL_URL = new URL("./models/chinchilla-gray.glb", import.meta.url).href;
// Meshy AI生成モデル(ボーンなし、原点が体の中心付近)の実測バウンディングボックスから逆算。
// 縦幅(Y)実寸1.90 → 見た目の高さ約0.9になるよう縮小し、脚の接地位置がy=0に来るよう底上げする。
const CHARACTER_SCALE = 0.47;
const CHARACTER_Y_OFFSET = 0.445;
// モデルの正面が既定でワールド+Z(カメラ側)を向いている前提の補正値。
// 実機で向きがズレて見える場合はこの値(ラジアン)を調整する。
const CHARACTER_FORWARD_OFFSET = 0;

let renderer = null;
let scene = null;
let camera = null;
let character = null;
let squareMarkers = [];
let animationFrameId = null;
let lastFrameTime = null;
let mixer = null;
let idleAction = null;
let walkAction = null;
let currentAction = null;

let hopState = null; // { fromIndex, toIndex, startTime, durationMs, onDone }
let currentIndex = 0;
let cameraCurrentPos = new THREE.Vector3();
// hopStateはマス1つ分ごとにnullへ戻る瞬間があり(次のhopTo()が呼ばれるまでのマイクロタスクの間)、
// これをそのままカメラ切り替えに使うと1マスごとに一瞬idle側へ引っ張られて弾んで見える。
// 「一連の移動中かどうか」はhopSteps単位のこのフラグで別管理する。
let isMoving = false;
// mount()のたびに増分し、非同期ロードの完了時に「まだ同じシーンか」を判定するための世代番号。
// disposeで再mountされた後に古いロードが完了してもシーンを誤って触らないようにする。
let sceneGeneration = 0;

function squarePosition(index) {
  return new THREE.Vector3(
    index * SQUARE_SPACING,
    0,
    Math.sin(index * PATH_CURVE_FREQUENCY) * PATH_CURVE_AMPLITUDE
  );
}

// パス上の連続位置t(例: gapIndex+0.5)における点と、その地点の進行方向に垂直な法線を求める。
// 建物・木をパスの向きに追従してオフセット配置するために使う。
function pathPointAndNormal(t) {
  const i0 = Math.floor(t);
  const i1 = Math.min(i0 + 1, SQUARE_COUNT - 1);
  const p0 = squarePosition(i0);
  const p1 = squarePosition(i1);
  const point = p0.clone().lerp(p1, t - i0);
  const tangent = new THREE.Vector3(p1.x - p0.x, 0, p1.z - p0.z).normalize();
  const normal = new THREE.Vector3(-tangent.z, 0, tangent.x);
  return { point, normal };
}

function createGroundTexture() {
  const size = 256;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#4f9d6e";
  ctx.fillRect(0, 0, size, size);
  ctx.strokeStyle = "rgba(255,255,255,0.3)";
  ctx.lineWidth = 4;
  ctx.strokeRect(0, 0, size, size);
  ctx.fillStyle = "rgba(255,255,255,0.12)";
  ctx.beginPath();
  ctx.arc(size * 0.3, size * 0.65, size * 0.12, 0, Math.PI * 2);
  ctx.arc(size * 0.7, size * 0.3, size * 0.08, 0, Math.PI * 2);
  ctx.fill();
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set((SQUARE_COUNT * SQUARE_SPACING) / 2, 3);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

// プレースホルダーの建物(箱+三角屋根)。Codex→Meshyで実素材が揃うまでの仮表示。
// variant "house"=汎用の一軒家、"shop"=看板付きの店(目印用に少し大きめ・色違い)。
function createBuildingPlaceholder(modelKey) {
  const isShop = modelKey === "building-shop";
  const group = new THREE.Group();
  const bodyColor = isShop ? 0x9ecbe0 : 0xf2b6a0;
  const roofColor = isShop ? 0x3f6b8a : 0xb5495b;

  const body = new THREE.Mesh(
    new THREE.BoxGeometry(1.2, 1.4, 1.2),
    new THREE.MeshStandardMaterial({ color: bodyColor })
  );
  body.position.y = 0.7;
  body.castShadow = true;
  body.receiveShadow = true;
  group.add(body);

  const roof = new THREE.Mesh(
    new THREE.ConeGeometry(1.0, 0.9, 4),
    new THREE.MeshStandardMaterial({ color: roofColor })
  );
  roof.position.y = 1.4 + 0.45;
  roof.rotation.y = Math.PI / 4; // 四角錐の角を箱の面に揃える
  roof.castShadow = true;
  group.add(roof);

  if (isShop) {
    const sign = new THREE.Mesh(
      new THREE.BoxGeometry(0.9, 0.3, 0.06),
      new THREE.MeshStandardMaterial({ color: 0xfff6e5 })
    );
    sign.position.set(0, 0.95, 0.63);
    group.add(sign);
  }
  return group;
}

// プレースホルダーの木(幹+樹冠)。variant "round"=広葉樹、"conifer"=針葉樹。
function createTreePlaceholder(variant) {
  const isConifer = variant === "conifer";
  const group = new THREE.Group();

  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.12, 0.16, 0.6, 8),
    new THREE.MeshStandardMaterial({ color: 0x8a5a34 })
  );
  trunk.position.y = 0.3;
  trunk.castShadow = true;
  group.add(trunk);

  const canopy = isConifer
    ? new THREE.Mesh(
        new THREE.ConeGeometry(0.55, 1.3, 8),
        new THREE.MeshStandardMaterial({ color: 0x2f6b3f })
      )
    : new THREE.Mesh(
        new THREE.SphereGeometry(0.6, 12, 10),
        new THREE.MeshStandardMaterial({ color: 0x5fa85c })
      );
  canopy.position.y = isConifer ? 0.6 + 0.65 : 0.6 + 0.55;
  canopy.castShadow = true;
  group.add(canopy);
  return group;
}

// プレースホルダーの子を実モデルへ差し替える(characterのloadCharacterModelと同じパターン)。
// generationはmount()時点のsceneGenerationを渡し、ロード完了時に古いシーンのままなら何もしない。
function loadStagePropModel(owner, placeholder, modelKey, generation) {
  const config = STAGE_PROP_MODELS[modelKey];
  if (!config) return;
  const loader = new GLTFLoader();
  loader.setDRACOLoader(dracoLoader);
  loader.load(
    config.url,
    (gltf) => {
      if (generation !== sceneGeneration) return;
      owner.remove(placeholder);
      const model = gltf.scene;
      model.scale.setScalar(config.scale);
      model.position.y = config.yOffset;
      model.traverse((node) => {
        if (node.isMesh) {
          node.castShadow = true;
          node.receiveShadow = true;
        }
      });
      owner.add(model);
    },
    undefined,
    (err) => {
      console.warn(`ステージ装飾(${modelKey})の読み込みに失敗、プレースホルダーのまま続行します`, err);
    }
  );
}

// STAGE_PROP_LAYOUTに従い、マスの間の隙間(gapIndex)ごとに建物・木を配置する。
// 各propはcharacterと同じくy=0(徒歩の接地基準)に立たせ、パスの向き(接線)に垂直な
// 法線方向にSTAGE_PROP_SIDE_OFFSETだけオフセットして、マスの移動そのものは妨げない。
// まずプレースホルダーを即座に表示し、対応する実GLBを非同期で差し替える。
function createStageProps(scene) {
  const generation = sceneGeneration;
  for (const prop of STAGE_PROP_LAYOUT) {
    const treeVariant = TREE_VARIANTS[Math.floor(Math.random() * TREE_VARIANTS.length)];
    const modelKey = prop.kind === "building" ? prop.model : `tree-${treeVariant}`;
    const placeholder =
      prop.kind === "building" ? createBuildingPlaceholder(prop.model) : createTreePlaceholder(treeVariant);

    const side = prop.side === "north" ? 1 : -1;
    const { point, normal } = pathPointAndNormal(prop.gapIndex + 0.5);
    const owner = new THREE.Group();
    owner.position.copy(point).addScaledVector(normal, side * STAGE_PROP_SIDE_OFFSET);
    // 建物の正面(ドア・看板)は既定でワールド+Zを向く想定なので、パス側=内側
    // (自分のオフセット方向と逆向き)を向くよう回転させる(木は前後の区別が無いので対象外)。
    if (prop.kind === "building") {
      owner.rotation.y = Math.atan2(-side * normal.x, -side * normal.z);
    }
    owner.add(placeholder);
    scene.add(owner);

    loadStagePropModel(owner, placeholder, modelKey, generation);
  }
}

function buildScene() {
  scene = new THREE.Scene();
  const skyColor = 0x9fd8c0;
  scene.background = new THREE.Color(skyColor);
  // 地面が無限の平面に見えて世界観が乏しいとの指摘への対応: 遠景をフォグでぼかし
  // 「奥行きのある世界にいる」感覚を出す
  scene.fog = new THREE.Fog(skyColor, 9, 22);

  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(SQUARE_COUNT * SQUARE_SPACING + 12, 16),
    new THREE.MeshStandardMaterial({ map: createGroundTexture() })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.set((SQUARE_COUNT - 1) * SQUARE_SPACING * 0.5, -0.5, 0);
  ground.receiveShadow = true;
  scene.add(ground);

  squareMarkers = [];
  for (let i = 0; i < SQUARE_COUNT; i++) {
    const marker = new THREE.Mesh(
      new THREE.BoxGeometry(1, 0.2, 1),
      new THREE.MeshStandardMaterial({ color: i % 2 === 0 ? 0xf4e3b2 : 0xf9f1dc })
    );
    const pos = squarePosition(i);
    marker.position.set(pos.x, -0.4, pos.z);
    marker.receiveShadow = true;
    scene.add(marker);
    squareMarkers.push(marker);
  }

  createStageProps(scene);

  // characterはホップ移動・カメラ追従の対象となるグループ。中身(仮カプセル→実モデル)を
  // 差し替えても位置制御ロジックに影響しないよう、位置はこのグループにだけ持たせる。
  character = new THREE.Group();
  const startPos = squarePosition(0);
  character.position.set(startPos.x, 0, startPos.z);
  scene.add(character);

  const placeholder = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.35, 0.4, 4, 8),
    new THREE.MeshStandardMaterial({ color: 0xe4572e })
  );
  placeholder.position.y = 0.55;
  placeholder.castShadow = true;
  character.add(placeholder);
  loadCharacterModel(character, placeholder);

  const light = new THREE.DirectionalLight(0xffffff, 1.8);
  light.position.set(3, 6, 4);
  light.castShadow = true;
  light.shadow.mapSize.set(1024, 1024);
  light.shadow.camera.left = -2;
  light.shadow.camera.right = SQUARE_COUNT * SQUARE_SPACING + 2;
  light.shadow.camera.top = 6;
  light.shadow.camera.bottom = -6;
  scene.add(light);
  scene.add(new THREE.AmbientLight(0xffffff, 0.55));
}

function findClip(clips, name) {
  return clips.find((c) => c.name.toLowerCase() === name) || null;
}

function playAction(action) {
  if (!action || action === currentAction) return;
  action.reset().fadeIn(0.2).play();
  if (currentAction) currentAction.fadeOut(0.2);
  currentAction = action;
}

function loadCharacterModel(owner, placeholder) {
  const loader = new GLTFLoader();
  loader.setDRACOLoader(dracoLoader);
  loader.load(
    CHARACTER_MODEL_URL,
    (gltf) => {
      // dispose()や再mount()で別のcharacterグループに切り替わっていたら何もしない
      if (character !== owner) return;
      owner.remove(placeholder);
      const model = gltf.scene;
      model.scale.setScalar(CHARACTER_SCALE);
      model.position.y = CHARACTER_Y_OFFSET;
      model.traverse((node) => {
        if (node.isMesh) node.castShadow = true;
      });
      owner.add(model);

      // 「立っている感じ」を出すため、待機中はidle、移動中はwalkのアニメーションクリップを再生する
      if (gltf.animations && gltf.animations.length) {
        mixer = new THREE.AnimationMixer(model);
        idleAction = mixer.clipAction(findClip(gltf.animations, "idle") || gltf.animations[0]);
        walkAction = mixer.clipAction(findClip(gltf.animations, "walk") || gltf.animations[0]);
        currentAction = null;
        playAction(idleAction);
      }
    },
    undefined,
    (err) => {
      console.warn("動物モデルの読み込みに失敗、仮カプセル表示のまま続行します", err);
    }
  );
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

function updateHop(now) {
  if (!hopState) return;
  const t = Math.min(1, (now - hopState.startTime) / hopState.durationMs);
  const fromPos = squarePosition(hopState.fromIndex);
  const toPos = squarePosition(hopState.toIndex);
  character.position.x = fromPos.x + (toPos.x - fromPos.x) * t;
  character.position.z = fromPos.z + (toPos.z - fromPos.z) * t;
  const arc = Math.sin(t * Math.PI);
  character.position.y = arc * HOP_HEIGHT;
  // 空中でわずかに伸び、着地・離陸の瞬間はわずかに潰れる(スクワッシュ&ストレッチ)
  const stretch = 1 + arc * 0.08;
  character.scale.set(1 / Math.sqrt(stretch), stretch, 1 / Math.sqrt(stretch));
  if (t >= 1) {
    currentIndex = hopState.toIndex;
    const done = hopState.onDone;
    hopState = null;
    if (done) done();
  }
}

function updateCamera() {
  let desired;
  if (isMoving) {
    // 進行方向(character.rotation.y、faceDirectionで更新済み)の真後ろに位置取りする。
    // カーブ中も常に「今向いている方向の後ろ」を保つ。
    const forward = new THREE.Vector3(Math.sin(character.rotation.y), 0, Math.cos(character.rotation.y));
    desired = character.position
      .clone()
      .addScaledVector(forward, -CAMERA_MOVE.trail)
      .add(new THREE.Vector3(0, CAMERA_MOVE.up, 0));
  } else {
    // 静止時は進行方向に連動させず、盤面を一定の角度から見渡す固定アングルにする。
    desired = new THREE.Vector3(
      character.position.x - CAMERA_IDLE.trail,
      CAMERA_IDLE.up,
      character.position.z + CAMERA_IDLE.back
    );
  }
  cameraCurrentPos.lerp(desired, CAMERA_LERP);
  camera.position.copy(cameraCurrentPos);
  camera.lookAt(character.position.x, 0.5, character.position.z);
}

function animate() {
  animationFrameId = requestAnimationFrame(animate);
  const now = performance.now();
  const delta = lastFrameTime ? Math.min((now - lastFrameTime) / 1000, 0.1) : 0;
  lastFrameTime = now;
  if (mixer) mixer.update(delta);
  updateHop(now);
  updateCamera();
  renderer.render(scene, camera);
}

function mount(canvasEl) {
  if (renderer) dispose();
  sceneGeneration += 1;
  renderer = new THREE.WebGLRenderer({ canvas: canvasEl, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  camera = new THREE.PerspectiveCamera(50, 1, 0.1, 100);
  cameraCurrentPos.set(-CAMERA_IDLE.trail, CAMERA_IDLE.up, CAMERA_IDLE.back);
  camera.position.copy(cameraCurrentPos);
  buildScene();
  resize();
  window.addEventListener("resize", resize);
  animate();
}

function dispose() {
  if (animationFrameId) cancelAnimationFrame(animationFrameId);
  animationFrameId = null;
  lastFrameTime = null;
  window.removeEventListener("resize", resize);
  if (renderer) renderer.dispose();
  renderer = null;
  scene = null;
  camera = null;
  character = null;
  squareMarkers = [];
  hopState = null;
  isMoving = false;
  currentIndex = 0;
  mixer = null;
  idleAction = null;
  walkAction = null;
  currentAction = null;
}

function faceDirection(fromPos, toPos) {
  const dx = toPos.x - fromPos.x;
  const dz = toPos.z - fromPos.z;
  if (dx === 0 && dz === 0) return;
  character.rotation.y = Math.atan2(dx, dz) + CHARACTER_FORWARD_OFFSET;
}

function hopTo(fromIndex, toIndex, options) {
  return new Promise((resolve) => {
    faceDirection(squarePosition(fromIndex), squarePosition(toIndex));
    const durationMs = (options && options.stepDurationMs) || 150;
    hopState = {
      fromIndex,
      toIndex,
      startTime: performance.now(),
      durationMs,
      onDone: resolve,
    };
  });
}

async function hopSteps(fromIndex, toIndex, options) {
  if (toIndex > fromIndex) {
    playAction(walkAction);
    isMoving = true;
  }
  let pos = fromIndex;
  while (pos < toIndex) {
    await hopTo(pos, pos + 1, options);
    pos += 1;
  }
  playAction(idleAction);
  isMoving = false;
}

function focusOn(index) {
  currentIndex = index;
}

window.LifeRoadBoard3D = { mount, dispose, hopTo, hopSteps, focusOn };
