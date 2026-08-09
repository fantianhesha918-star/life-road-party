// アニマルライフ 盤面3D化(フェーズC・本番プレイ画面への統合)
// 目的: 本番のゲーム画面(renderGameScreen)に常設される盤面表示。
// キャラクターはMeshy AIで生成した動物モデル(docs/models/*.glb、
// 出典はdocs/models/CREDITS.md参照)を読み込む。ボーンアニメーションを持たない
// 静止フィギュア形状のため、動きはすべて位置・拡縮の変形(updateHopForEntryの放物線+
// スクワッシュ&ストレッチ)で表現している。
// "three"はindex.htmlのimportmapで解決される(GLTFLoader.js内部が bare specifier "three" を
// importしているため、importmapが無いとGLTFLoaderの読み込みごと失敗する)
import * as THREE from "three";
import { GLTFLoader } from "https://unpkg.com/three@0.169.0/examples/jsm/loaders/GLTFLoader.js";
import { DRACOLoader } from "https://unpkg.com/three@0.169.0/examples/jsm/loaders/DRACOLoader.js";

// Draco圧縮して書き出したGLBを読むため、GLTFLoaderにDRACOLoaderを明示的に渡す
// (渡さないと読み込みに失敗するが、失敗時は仮プレースホルダー表示のまま無言で続行してしまう)。
const dracoLoader = new DRACOLoader();
dracoLoader.setDecoderPath("https://unpkg.com/three@0.169.0/examples/jsm/libs/draco/");

// マス数は本番の盤面(BOARD_SQUARES.length)に合わせてmount()の都度セットする
// (将来のゲームモード別マス数拡張にもこの仕組みのまま追従できる)。
let squareCount = 10;
// マスの種類(BOARD_SQUARES[i].type)。マス土台の色分けに使う。mount()の都度app.js側から渡される。
let squareTypes = [];
// 株購入チャンスのマスindex一覧(game-data.jsのSTOCK_TRIGGER_INDEXES)。mount()の都度渡される。
let stockTriggerIndexes = [];
const SQUARE_SPACING = 2.2;
const HOP_HEIGHT = 0.6;
// 道をゆるやかに蛇行させるsin波のパラメータ。index*FREQUENCYが増えるほど
// 周期的にS字カーブを繰り返す(マス数が増減してもそのまま追従する)。
const PATH_CURVE_AMPLITUDE = 1.8;
const PATH_CURVE_FREQUENCY = 0.35;
const STAGE_PROP_SIDE_OFFSET = 2.8;
// 木は「丸い葉(round)」「とんがり葉(conifer)」の2種をランダムに混ぜて配置する
const TREE_VARIANTS = ["round", "conifer"];
// STAGE_PROP_MODELSのうちtree-*を除いた建物・施設キー一覧(表示順に巡回して配置する)。
const BUILDING_MODEL_KEYS = [
  "building-house",
  "building-shop",
  "building-office",
  "building-apartment",
  "building-restaurant",
  "building-station",
  "building-school",
  "building-hospital",
  "facility-park",
  "facility-amusement-park",
  "facility-aquarium",
  "facility-zoo",
  "facility-farm",
];
// マスの間の隙間(gapIndex)ごとに建物・木を1組ずつ配置するレイアウトを動的に組み立てる。
// 手作業の固定配列(旧STAGE_PROP_LAYOUT)だと将来のマス数拡張(100〜300マス)に
// 追従できないため、建物モデルを順番に巡回させるアルゴリズム方式にした。
function buildStagePropLayout(count) {
  const layout = [];
  const gapCount = Math.max(0, count - 1);
  for (let i = 0; i < gapCount; i++) {
    const buildingModel = BUILDING_MODEL_KEYS[i % BUILDING_MODEL_KEYS.length];
    const buildingSide = i % 2 === 0 ? "north" : "south";
    const treeSide = buildingSide === "north" ? "south" : "north";
    layout.push({ id: `building-${i}`, kind: "building", model: buildingModel, gapIndex: i, side: buildingSide });
    layout.push({ id: `tree-${i}`, kind: "tree", gapIndex: i, side: treeSide });
    // 街灯・ベンチ・看板は建物と同じ側の、道により近い位置に巡回配置する(奥に建物、手前に小物)
    const streetPropModel = STREET_PROP_MODEL_KEYS[i % STREET_PROP_MODEL_KEYS.length];
    layout.push({ id: `streetprop-${i}`, kind: "streetprop", model: streetPropModel, gapIndex: i, side: buildingSide });
  }
  return layout;
}
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
  "prop-streetlamp": {
    url: new URL("./models/prop-streetlamp.glb", import.meta.url).href,
    scale: 0.9,
    yOffset: 0.9,
  },
  "prop-bench": {
    url: new URL("./models/prop-bench.glb", import.meta.url).href,
    scale: 0.55,
    yOffset: 0.42,
  },
  "prop-signboard": {
    url: new URL("./models/prop-signboard.glb", import.meta.url).href,
    scale: 0.45,
    yOffset: 0.373,
  },
  "gate-start": {
    url: new URL("./models/gate-start.glb", import.meta.url).href,
    scale: 1.5,
    yOffset: 1.288,
  },
  "gate-goal": {
    url: new URL("./models/gate-goal.glb", import.meta.url).href,
    scale: 1.5,
    yOffset: 1.244,
  },
  "cloud-puffy": {
    url: new URL("./models/cloud-puffy.glb", import.meta.url).href,
    scale: 1.5,
    yOffset: 0, // 雲は接地させず空中に手動配置するため未使用(createCloudsで直接position.yを指定)
  },
};
// 道沿いの小物(街灯・ベンチ・看板)を巡回配置するキー一覧
const STREET_PROP_MODEL_KEYS = ["prop-streetlamp", "prop-bench", "prop-signboard"];
// 建物・木より道に近い位置に配置する(奥に建物、手前に小物という奥行きを出す)
const STREET_PROP_SIDE_OFFSET = 1.5;
// マスの種類(game-data.js参照)ごとの色。2D版style.cssの.cell-*配色をそのまま流用する
const SQUARE_TYPE_COLORS = {
  start: 0xfff3cd,
  goal: 0xfff3cd,
  job: 0xe8f0fe,
  payday: 0xe6f4ea,
  event: 0xfdeaea,
  fortune: 0xf3e8fd,
  choice: 0xfff0e0,
  rest: 0xffffff,
  marriage: 0xffc9de,
  childbirth: 0xcfe8ff,
  "house-market": 0xd9a066,
  "house-fire": 0xff8a65,
  "house-swap": 0x80cbc4,
};
// 株購入チャンスのマス(通過するだけで発生、game-data.jsのSTOCK_TRIGGER_INDEXES)は
// 上記の種類別配色より優先して、目立つ金色で塗る(マスの意味自体は変わらないため
// typeとは別の重ね掛けのプロパティとして扱う)
const STOCK_TRIGGER_COLOR = 0xf6c343;
// マス土台モデル(masu-base.glb)。無地のため上記の色をマテリアルに都度上書きして使う。
// yOffsetは他モデルと違い「上面がy=0(キャラクターの足元)に来る」ように中心を沈める値
// (= -(scale × 実測厚みの半分0.164))。
const MASU_BASE_MODEL = {
  url: new URL("./models/masu-base.glb", import.meta.url).href,
  scale: 0.85,
  yOffset: -0.14,
};
// 背景・地面・道の実イラスト素材(Codex作成、docs/images/参照)
const GROUND_TEXTURE_URL = new URL("./images/ground-grass.jpg", import.meta.url).href;
const ROAD_TEXTURE_URL = new URL("./images/road-path.jpg", import.meta.url).href;
const SKY_BACKDROP_URL = new URL("./images/sky-backdrop.jpg", import.meta.url).href;
const ROAD_HALF_WIDTH = 0.9;
// facility-bridge.glbは将来「橋の上にすごろくマスを置く」機能用に生成済みだが、
// 現時点ではbuildStagePropLayoutの対象外(パス自体の折れ曲がり機能の実装待ち)。
// カメラは「静止時=盤面全体を見渡す見下ろし視点」「移動中=進行方向の真後ろから追う三人称視点」
// の2段構成にする。isMoving(現在カメラが追従しているプレイヤーがホップ中かどうか)で自動的に切り替わる。
// 画面いっぱいに表示するようになったため、真上寄りの見下ろし(旧: up6.5/back4.0)から
// 建物の外観とキャラクターが同時に見える斜め(ジオラマ風、約40°)の角度に変更した。
const CAMERA_IDLE = { back: 5.2, up: 4.5, trail: 3.0 };
const CAMERA_MOVE = { up: 1.5, trail: 2.2 };
const CAMERA_LERP = 0.08;
// 動物種(shop-data.jsのSPECIES_ITEMS)ごとの実3Dモデル。6種(チンチラ2色+いぬ2色+ねこ+うさぎ)
// すべて実測済み(2026-08-09)。scaleは「実測した縦幅(Three.jsでBox3計測、Y軸)を基準に、
// 描画後の高さがチンチラ(グレー)と揃うよう逆算した値」、yOffsetはどのモデルもバウンディング
// ボックスの中心がほぼ原点(center.y≈0)のため、chinchilla-grayと同じ0.445で全種そのまま接地する
// (実測でscale×|min.y|≈0.445〜0.446になることを確認済み)。
const SPECIES_MODEL_MAP = {
  "species-chinchilla-gray": {
    url: new URL("./models/chinchilla-gray.glb", import.meta.url).href,
    scale: 0.47,
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
    scale: 0.635,
    yOffset: 0.445,
  },
  "species-rabbit-white": {
    url: new URL("./models/rabbit-white.glb", import.meta.url).href,
    scale: 0.469,
    yOffset: 0.445,
  },
};
// モデルの正面が既定でワールド+Z(カメラ側)を向いている前提の補正値。
// 実機で向きがズレて見える場合はこの値(ラジアン)を調整する。
const CHARACTER_FORWARD_OFFSET = 0;

let renderer = null;
let scene = null;
let camera = null;
// playerId -> { group, placeholder, mixer, idleAction, walkAction, currentAction, hop, currentIndex }
let characters = new Map();
// カメラが追従する対象のプレイヤーid。手番プレイヤーに同期させる(app.js側のfocusCamera呼び出し経由)。
let focusPlayerId = null;
let squareMarkers = [];
let animationFrameId = null;
let lastFrameTime = null;
let cameraCurrentPos = new THREE.Vector3();
// hopは1マス分ごとにnullへ戻る瞬間があり(次のhopTo()が呼ばれるまでのマイクロタスクの間)、
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

// 同じマスに複数のプレイヤーが乗ったときに重ならないよう、プレイヤーごとに固定の
// 小さな「持ち場」オフセットを常時つける(players配列内の並び順だけで決まるので、
// 他のプレイヤーの位置に関わらず毎回同じ位置をキープできる)。全員がstart(index0)に
// 集まるゲーム開始直後や、結婚マス等の強制停止マスで特に効果を発揮する。
const PLAYER_SLOT_RADIUS = 0.32;
function playerSlotOffset(playerIndex, totalPlayers) {
  if (!totalPlayers || totalPlayers <= 1) return new THREE.Vector3(0, 0, 0);
  const angle = (playerIndex / totalPlayers) * Math.PI * 2;
  return new THREE.Vector3(Math.cos(angle) * PLAYER_SLOT_RADIUS, 0, Math.sin(angle) * PLAYER_SLOT_RADIUS);
}

// キャラクター用: マス中心にそのプレイヤーの持ち場オフセットを加えた位置
function characterSlotPosition(index, offset) {
  const p = squarePosition(index);
  return new THREE.Vector3(p.x + offset.x, p.y, p.z + offset.z);
}

// パス上の連続位置t(例: gapIndex+0.5)における点と、その地点の進行方向に垂直な法線を求める。
// 建物・木をパスの向きに追従してオフセット配置するために使う。
function pathPointAndNormal(t) {
  const i0 = Math.floor(t);
  const i1 = Math.min(i0 + 1, squareCount - 1);
  const p0 = squarePosition(i0);
  const p1 = squarePosition(i1);
  const point = p0.clone().lerp(p1, t - i0);
  const tangent = new THREE.Vector3(p1.x - p0.x, 0, p1.z - p0.z).normalize();
  const normal = new THREE.Vector3(-tangent.z, 0, tangent.x);
  return { point, normal };
}

const textureLoader = new THREE.TextureLoader();

function loadGroundTexture() {
  const texture = textureLoader.load(GROUND_TEXTURE_URL);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set((squareCount * SQUARE_SPACING) / 3, 6);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

// パス(squarePosition)に沿って道テクスチャを貼ったリボン状のメッシュを作る。
// 各マス中心を結ぶ直線区間の連なりとして構築する(実際のホップ移動もマス間を直線で結ぶため、
// このリボンは常にキャラクターの通り道と正確に一致する)。
function createRoadRibbon(count) {
  const texture = textureLoader.load(ROAD_TEXTURE_URL);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.colorSpace = THREE.SRGBColorSpace;

  const positions = [];
  const uvs = [];
  const indices = [];
  let uAccum = 0;
  for (let i = 0; i < count; i++) {
    const p = squarePosition(i);
    let tangent;
    if (i === 0) {
      const p1 = squarePosition(Math.min(1, count - 1));
      tangent = new THREE.Vector3(p1.x - p.x, 0, p1.z - p.z);
    } else {
      const p0 = squarePosition(i - 1);
      tangent = new THREE.Vector3(p.x - p0.x, 0, p.z - p0.z);
    }
    if (tangent.lengthSq() < 1e-6) tangent.set(1, 0, 0);
    tangent.normalize();
    const normal = new THREE.Vector3(-tangent.z, 0, tangent.x);
    const left = p.clone().addScaledVector(normal, ROAD_HALF_WIDTH);
    const right = p.clone().addScaledVector(normal, -ROAD_HALF_WIDTH);
    positions.push(left.x, -0.45, left.z, right.x, -0.45, right.z);
    if (i > 0) uAccum += SQUARE_SPACING / (ROAD_HALF_WIDTH * 2);
    uvs.push(uAccum, 0, uAccum, 1);
  }
  for (let i = 0; i < count - 1; i++) {
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
  const mesh = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ map: texture }));
  mesh.receiveShadow = true;
  return mesh;
}

// プレースホルダーの建物(箱+三角屋根)。Codex→Meshyで実素材が揃うまでの仮表示
// (現状は全建物モデルが揃っているため通常は一瞬しか表示されない)。
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

// 街灯・ベンチ・看板用の簡易プレースホルダー(実GLB読み込み完了までの仮表示)。
function createSmallPropPlaceholder() {
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(0.3, 0.6, 0.3),
    new THREE.MeshStandardMaterial({ color: 0xcccccc })
  );
  mesh.position.y = 0.3;
  mesh.castShadow = true;
  return mesh;
}

// buildStagePropLayoutに従い、マスの間の隙間(gapIndex)ごとに建物・木・道沿いの小物を配置する。
// 各propはcharacterと同じくy=0(徒歩の接地基準)に立たせ、パスの向き(接線)に垂直な
// 法線方向にオフセットして、マスの移動そのものは妨げない。建物・木は奥(STAGE_PROP_SIDE_OFFSET)、
// 街灯・ベンチ・看板は道により近い手前(STREET_PROP_SIDE_OFFSET)に配置し奥行きを出す。
// まずプレースホルダーを即座に表示し、対応する実GLBを非同期で差し替える。
function createStageProps(scene) {
  const generation = sceneGeneration;
  const layout = buildStagePropLayout(squareCount);
  for (const prop of layout) {
    let modelKey;
    let placeholder;
    let sideOffset;
    if (prop.kind === "building") {
      modelKey = prop.model;
      placeholder = createBuildingPlaceholder(prop.model);
      sideOffset = STAGE_PROP_SIDE_OFFSET;
    } else if (prop.kind === "tree") {
      const treeVariant = TREE_VARIANTS[Math.floor(Math.random() * TREE_VARIANTS.length)];
      modelKey = `tree-${treeVariant}`;
      placeholder = createTreePlaceholder(treeVariant);
      sideOffset = STAGE_PROP_SIDE_OFFSET;
    } else {
      modelKey = prop.model;
      placeholder = createSmallPropPlaceholder();
      sideOffset = STREET_PROP_SIDE_OFFSET;
    }

    const side = prop.side === "north" ? 1 : -1;
    const { point, normal } = pathPointAndNormal(prop.gapIndex + 0.5);
    const owner = new THREE.Group();
    owner.position.copy(point).addScaledVector(normal, side * sideOffset);
    // 建物の正面(ドア・看板)は既定でワールド+Zを向く想定なので、パス側=内側
    // (自分のオフセット方向と逆向き)を向くよう回転させる(木・小物は前後の区別が薄いので対象外)。
    if (prop.kind === "building") {
      owner.rotation.y = Math.atan2(-side * normal.x, -side * normal.z);
    }
    owner.add(placeholder);
    scene.add(owner);

    loadStagePropModel(owner, placeholder, modelKey, generation);
  }
}

// スタート/ゴールのゲートを盤面の両端に、道を横切るように配置する。
function createGates(scene) {
  const generation = sceneGeneration;
  placeGate(scene, "gate-start", 0, generation);
  if (squareCount > 1) placeGate(scene, "gate-goal", squareCount - 1, generation);
}

function placeGate(scene, modelKey, index, generation) {
  const placeholder = createSmallPropPlaceholder();
  const owner = new THREE.Group();
  const pos = squarePosition(index);
  // pathPointAndNormalはgapの中間点(整数+0.5)基準のため、端の指数でも有効な接線が取れるよう
  // 内側にわずかにずらしたtで法線を求める(位置そのものはsquarePosition(index)を使う)。
  const t = Math.max(0.001, Math.min(squareCount - 1.001, index));
  const { normal } = pathPointAndNormal(t);
  owner.position.copy(pos);
  owner.rotation.y = Math.atan2(normal.x, normal.z);
  owner.add(placeholder);
  scene.add(owner);
  loadStagePropModel(owner, placeholder, modelKey, generation);
}

// 空を漂う雲を数個配置する(接地せず、盤面の長さに応じて数を決める)。
function createClouds(scene) {
  const generation = sceneGeneration;
  const cloudCount = Math.max(3, Math.round(squareCount / 6));
  for (let i = 0; i < cloudCount; i++) {
    const t = ((i + 0.5) / cloudCount) * Math.max(1, squareCount - 1);
    const pos = squarePosition(t);
    const placeholder = createSmallPropPlaceholder();
    const owner = new THREE.Group();
    const sideJitter = (i % 2 === 0 ? 1 : -1) * (4 + Math.random() * 3);
    owner.position.set(pos.x + (Math.random() - 0.5) * 3, 5.5 + Math.random() * 2, pos.z + sideJitter);
    owner.rotation.y = Math.random() * Math.PI * 2;
    owner.scale.setScalar(0.8 + Math.random() * 0.6);
    owner.add(placeholder);
    scene.add(owner);
    loadStagePropModel(owner, placeholder, "cloud-puffy", generation);
  }
}

// プレイヤーの色+動物種の絵文字を描いた円形バッジ(ビルボードスプライト)。
// 実3Dモデル未整備の種のプレースホルダーに載せて、2DのアバターバッジUIと見た目を揃える。
function createSpeciesBadgeSprite(color, emoji) {
  const size = 128;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, size / 2 - 4, 0, Math.PI * 2);
  ctx.fillStyle = color || "#e4572e";
  ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,0.9)";
  ctx.lineWidth = 6;
  ctx.stroke();
  if (emoji) {
    ctx.font = `${size * 0.55}px sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(emoji, size / 2, size / 2 + 4);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const material = new THREE.SpriteMaterial({ map: texture, transparent: true });
  const sprite = new THREE.Sprite(material);
  sprite.scale.set(0.5, 0.5, 1);
  sprite.position.y = 1.05;
  return sprite;
}

// 実3Dモデル未整備の動物種向けの仮カプセル+種バッジ。
function createCharacterPlaceholder(color, emoji) {
  const group = new THREE.Group();
  const capsule = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.35, 0.4, 4, 8),
    new THREE.MeshStandardMaterial({ color: color || 0xe4572e })
  );
  capsule.position.y = 0.55;
  capsule.castShadow = true;
  group.add(capsule);
  group.add(createSpeciesBadgeSprite(color, emoji));
  return group;
}

function findClip(clips, name) {
  return clips.find((c) => c.name.toLowerCase() === name) || null;
}

function playAction(entry, action) {
  if (!action || action === entry.currentAction) return;
  action.reset().fadeIn(0.2).play();
  if (entry.currentAction) entry.currentAction.fadeOut(0.2);
  entry.currentAction = action;
}

// speciesIdに対応する実モデルがあれば非同期ロードして差し替える。無ければプレースホルダーのまま
// (SPECIES_MODEL_MAPに無い動物種は、残り4種の3Dモデル化が完了するまでこの状態が続く想定)。
function loadCharacterModel(entry, speciesId, generation) {
  const config = SPECIES_MODEL_MAP[speciesId];
  if (!config) {
    // ここに来るのはspeciesIdがSPECIES_MODEL_MAPに無い(=旧セーブ等でspeciesId自体が
    // 欠落している、または未対応の値)場合。無言のままだと「プレースホルダーのまま
    // 動かない」不具合の原因特定が難しいため、必ず警告を出す。
    console.warn(`動物モデル: speciesId="${speciesId}"に対応するモデルが見つからないため、プレースホルダー表示のまま続行します`);
    return;
  }
  const loader = new GLTFLoader();
  loader.setDRACOLoader(dracoLoader);
  loader.load(
    config.url,
    (gltf) => {
      if (generation !== sceneGeneration) return;
      entry.group.remove(entry.placeholder);
      const model = gltf.scene;
      model.scale.setScalar(config.scale);
      model.position.y = config.yOffset;
      model.traverse((node) => {
        if (node.isMesh) node.castShadow = true;
      });
      entry.group.add(model);

      // 「立っている感じ」を出すため、待機中はidle、移動中はwalkのアニメーションクリップを再生する
      if (gltf.animations && gltf.animations.length) {
        entry.mixer = new THREE.AnimationMixer(model);
        entry.idleAction = entry.mixer.clipAction(findClip(gltf.animations, "idle") || gltf.animations[0]);
        entry.walkAction = entry.mixer.clipAction(findClip(gltf.animations, "walk") || gltf.animations[0]);
        entry.currentAction = null;
        playAction(entry, entry.idleAction);
      }
    },
    undefined,
    (err) => {
      console.warn(
        `動物モデル(speciesId="${speciesId}", url=${config.url})の読み込みに失敗、プレースホルダー表示のまま続行します`,
        err
      );
    }
  );
}

// プレイヤー1人分の3Dオブジェクト一式を生成し、現在の位置(player.position)に配置する。
// playerIndex/totalPlayersは、同じマスで重ならないための持ち場オフセット算出に使う。
function createCharacterEntry(player, playerIndex, totalPlayers) {
  const group = new THREE.Group();
  const startIndex = typeof player.position === "number" ? player.position : 0;
  const slotOffset = playerSlotOffset(playerIndex || 0, totalPlayers || 1);
  const startPos = characterSlotPosition(startIndex, slotOffset);
  group.position.set(startPos.x, 0, startPos.z);
  scene.add(group);

  const visual = player.avatar || {};
  const placeholder = createCharacterPlaceholder(visual.color, visual.speciesEmoji);
  group.add(placeholder);

  const entry = {
    group,
    placeholder,
    mixer: null,
    idleAction: null,
    walkAction: null,
    currentAction: null,
    hop: null,
    currentIndex: startIndex,
    slotOffset,
  };
  characters.set(player.id, entry);
  loadCharacterModel(entry, visual.speciesId, sceneGeneration);
  return entry;
}

function squareTypeColor(index) {
  if (stockTriggerIndexes.includes(index)) return STOCK_TRIGGER_COLOR;
  const type = squareTypes[index];
  return type && SQUARE_TYPE_COLORS[type] !== undefined ? SQUARE_TYPE_COLORS[type] : 0xf9f1dc;
}

// masu-base.glbは全マス共通の形状なので1回だけ読み込み、マスの数だけクローンして
// マテリアル色だけマスの種類ごとに変える(建物のように毎回GLBを読み込み直すと無駄が大きいため)。
// 読み込み中は既存のプレースホルダー(色付きBox、squareMarkers)をそのまま表示しておく。
function loadMasuBaseInstances(scene) {
  const generation = sceneGeneration;
  const loader = new GLTFLoader();
  loader.setDRACOLoader(dracoLoader);
  loader.load(
    MASU_BASE_MODEL.url,
    (gltf) => {
      if (generation !== sceneGeneration) return;
      const template = gltf.scene;
      for (let i = 0; i < squareMarkers.length; i++) {
        scene.remove(squareMarkers[i]);
        const instance = template.clone(true);
        instance.traverse((node) => {
          if (node.isMesh) {
            node.material = node.material.clone();
            node.material.color.setHex(squareTypeColor(i));
            node.receiveShadow = true;
          }
        });
        instance.scale.setScalar(MASU_BASE_MODEL.scale);
        const pos = squarePosition(i);
        instance.position.set(pos.x, MASU_BASE_MODEL.yOffset, pos.z);
        scene.add(instance);
        squareMarkers[i] = instance;
      }
    },
    undefined,
    (err) => {
      console.warn("マス土台モデルの読み込みに失敗、プレースホルダーのまま続行します", err);
    }
  );
}

function buildScene(players) {
  scene = new THREE.Scene();
  // フォグ色はsky-backdropの水平線付近の淡い色合いに近い値にして、遠景がなじむようにする
  const fogColor = 0xbfe3da;
  scene.fog = new THREE.Fog(fogColor, 9, 22);
  const bgTexture = textureLoader.load(SKY_BACKDROP_URL);
  bgTexture.colorSpace = THREE.SRGBColorSpace;
  scene.background = bgTexture;

  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(squareCount * SQUARE_SPACING + 12, 16),
    new THREE.MeshStandardMaterial({ map: loadGroundTexture() })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.set((squareCount - 1) * SQUARE_SPACING * 0.5, -0.5, 0);
  ground.receiveShadow = true;
  scene.add(ground);

  scene.add(createRoadRibbon(squareCount));

  squareMarkers = [];
  for (let i = 0; i < squareCount; i++) {
    const marker = new THREE.Mesh(
      new THREE.BoxGeometry(1, 0.2, 1),
      new THREE.MeshStandardMaterial({ color: squareTypeColor(i) })
    );
    const pos = squarePosition(i);
    marker.position.set(pos.x, -0.4, pos.z);
    marker.receiveShadow = true;
    scene.add(marker);
    squareMarkers.push(marker);
  }
  loadMasuBaseInstances(scene);

  createStageProps(scene);
  createGates(scene);
  createClouds(scene);

  characters = new Map();
  const playerList = players || [];
  playerList.forEach((p, i) => createCharacterEntry(p, i, playerList.length));

  const light = new THREE.DirectionalLight(0xffffff, 1.8);
  light.position.set(3, 6, 4);
  light.castShadow = true;
  light.shadow.mapSize.set(1024, 1024);
  light.shadow.camera.left = -2;
  light.shadow.camera.right = squareCount * SQUARE_SPACING + 2;
  light.shadow.camera.top = 6;
  light.shadow.camera.bottom = -6;
  scene.add(light);
  scene.add(new THREE.AmbientLight(0xffffff, 0.55));
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

function updateHopForEntry(entry, now) {
  if (!entry.hop) return;
  const hop = entry.hop;
  const t = Math.min(1, (now - hop.startTime) / hop.durationMs);
  const offset = entry.slotOffset || { x: 0, z: 0 };
  const fromPos = characterSlotPosition(hop.fromIndex, offset);
  const toPos = characterSlotPosition(hop.toIndex, offset);
  entry.group.position.x = fromPos.x + (toPos.x - fromPos.x) * t;
  entry.group.position.z = fromPos.z + (toPos.z - fromPos.z) * t;
  const arc = Math.sin(t * Math.PI);
  entry.group.position.y = arc * HOP_HEIGHT;
  // 空中でわずかに伸び、着地・離陸の瞬間はわずかに潰れる(スクワッシュ&ストレッチ)
  const stretch = 1 + arc * 0.08;
  entry.group.scale.set(1 / Math.sqrt(stretch), stretch, 1 / Math.sqrt(stretch));
  if (t >= 1) {
    entry.currentIndex = hop.toIndex;
    const done = hop.onDone;
    entry.hop = null;
    if (done) done();
  }
}

function updateCamera() {
  const entry = focusPlayerId ? characters.get(focusPlayerId) : null;
  if (!entry) return;
  const focusGroup = entry.group;
  let desired;
  if (isMoving) {
    // 進行方向(focusGroup.rotation.y、faceDirectionで更新済み)の真後ろに位置取りする。
    // カーブ中も常に「今向いている方向の後ろ」を保つ。
    const forward = new THREE.Vector3(Math.sin(focusGroup.rotation.y), 0, Math.cos(focusGroup.rotation.y));
    desired = focusGroup.position
      .clone()
      .addScaledVector(forward, -CAMERA_MOVE.trail)
      .add(new THREE.Vector3(0, CAMERA_MOVE.up, 0));
  } else {
    // 静止時は進行方向に連動させず、盤面を一定の角度から見渡す固定アングルにする。
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

function animate() {
  animationFrameId = requestAnimationFrame(animate);
  const now = performance.now();
  const delta = lastFrameTime ? Math.min((now - lastFrameTime) / 1000, 0.1) : 0;
  lastFrameTime = now;
  characters.forEach((entry) => {
    if (entry.mixer) entry.mixer.update(delta);
    updateHopForEntry(entry, now);
  });
  updateCamera();
  renderer.render(scene, camera);
}

// canvasEl: マウント先の<canvas>。options.squareCount: 盤面のマス数(BOARD_SQUARES.length)。
// options.players: [{id, position, avatar:{color,speciesId,speciesEmoji,...}}, ...]。
// options.currentTurnIndex: 初期カメラの追従対象を決めるための手番インデックス。
function mount(canvasEl, options) {
  if (renderer) dispose();
  sceneGeneration += 1;
  const opts = options || {};
  squareCount = opts.squareCount || 10;
  squareTypes = opts.squareTypes || [];
  stockTriggerIndexes = opts.stockTriggerIndexes || [];
  renderer = new THREE.WebGLRenderer({ canvas: canvasEl, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  camera = new THREE.PerspectiveCamera(55, 1, 0.1, 100);
  cameraCurrentPos.set(-CAMERA_IDLE.trail, CAMERA_IDLE.up, CAMERA_IDLE.back);
  camera.position.copy(cameraCurrentPos);
  buildScene(opts.players);
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
  lastFrameTime = null;
  window.removeEventListener("resize", resize);
  if (renderer) renderer.dispose();
  renderer = null;
  scene = null;
  camera = null;
  characters = new Map();
  focusPlayerId = null;
  squareMarkers = [];
  isMoving = false;
}

function faceDirection(entry, fromPos, toPos) {
  const dx = toPos.x - fromPos.x;
  const dz = toPos.z - fromPos.z;
  if (dx === 0 && dz === 0) return;
  entry.group.rotation.y = Math.atan2(dx, dz) + CHARACTER_FORWARD_OFFSET;
}

function hopTo(playerId, fromIndex, toIndex, options) {
  return new Promise((resolve) => {
    const entry = characters.get(playerId);
    if (!entry) {
      resolve();
      return;
    }
    faceDirection(entry, squarePosition(fromIndex), squarePosition(toIndex));
    const durationMs = (options && options.stepDurationMs) || 150;
    entry.hop = { fromIndex, toIndex, startTime: performance.now(), durationMs, onDone: resolve };
  });
}

// playerIdのキャラクターをfromIndex→toIndexまで1マスずつホップさせる。カメラは
// このプレイヤーが現在の追従対象(focusPlayerId)のときだけ移動視点に切り替わる。
async function hopSteps(playerId, fromIndex, toIndex, options) {
  const entry = characters.get(playerId);
  if (!entry) return;
  const isFocus = playerId === focusPlayerId;
  if (toIndex > fromIndex) {
    playAction(entry, entry.walkAction);
    if (isFocus) isMoving = true;
  }
  let pos = fromIndex;
  while (pos < toIndex) {
    await hopTo(playerId, pos, pos + 1, options);
    pos += 1;
  }
  playAction(entry, entry.idleAction);
  if (isFocus) isMoving = false;
}

// 現在の全プレイヤーの位置に3D側を合わせる(render()のたびに呼ばれる想定の軽量な同期処理)。
// ホップ中(entry.hop有り)のプレイヤーはhopSteps側が権威を持つため触らない。
// 新規プレイヤー(まだcharactersに無いid)がいれば生成する。
function syncPlayers(players) {
  if (!scene) return;
  const playerList = players || [];
  playerList.forEach((p, i) => {
    const slotOffset = playerSlotOffset(i, playerList.length);
    let entry = characters.get(p.id);
    if (!entry) {
      entry = createCharacterEntry(p, i, playerList.length);
      return;
    }
    entry.slotOffset = slotOffset;
    if (entry.hop) return;
    if (entry.currentIndex !== p.position) {
      const pos = characterSlotPosition(p.position, slotOffset);
      entry.group.position.set(pos.x, 0, pos.z);
      entry.group.scale.set(1, 1, 1);
      entry.currentIndex = p.position;
    } else {
      // 位置は変わっていなくても、持ち場オフセット自体が変わった場合(プレイヤー人数変化等)は
      // ホップ中でなければ現在地に反映しておく
      const pos = characterSlotPosition(entry.currentIndex, slotOffset);
      entry.group.position.set(pos.x, 0, pos.z);
    }
  });
}

// カメラの追従対象(アイドル時の見下ろし位置・移動時の三人称視点の基準)を切り替える。
function focusCamera(playerId) {
  if (playerId) focusPlayerId = playerId;
}

window.LifeRoadBoard3D = { mount, dispose, hopSteps, syncPlayers, focusCamera };
