// アニマルライフ 盤面3D化・フェーズA/B検証
// 目的: DOM UIとWebGL canvasの共存、滑らかなホップ移動、カメラのズーム追従が
// 実現できるかを検証するための最小構成。
// フェーズBの第一歩として、Kenney.nl(CC0、大手定番サイト)の「Cube Pets」パックの
// 犬モデル(docs/models/animal-dog.glb、出典はdocs/models/CREDITS.md参照)を実際に読み込む。
import * as THREE from "https://unpkg.com/three@0.169.0/build/three.module.js";
import { GLTFLoader } from "https://unpkg.com/three@0.169.0/examples/jsm/loaders/GLTFLoader.js";

const SQUARE_COUNT = 10;
const SQUARE_SPACING = 2.2;
const HOP_HEIGHT = 0.6;
// 「その場に立っている感じ」を出すため、遠く見下ろす構図ではなく低め・近めの追従視点にする
const CAMERA_BACK = 2.3;
const CAMERA_UP = 1.6;
const CAMERA_LERP = 0.08;
const DOG_MODEL_URL = new URL("./models/animal-dog.glb", import.meta.url).href;
// モデルのボーンなし階層(body+脚4本)の実寸から逆算した値。脚の接地位置が
// ちょうどy=0に来る作り(CHARACTER_Y_OFFSET=0)だったため、大きさのみ調整。
const CHARACTER_SCALE = 0.8;
const CHARACTER_Y_OFFSET = 0;

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
let cameraTarget = new THREE.Vector3();
let cameraCurrentPos = new THREE.Vector3();

function squarePosition(index) {
  return new THREE.Vector3(index * SQUARE_SPACING, 0, 0);
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
  light.shadow.camera.top = 4;
  light.shadow.camera.bottom = -4;
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
  loader.load(
    DOG_MODEL_URL,
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
  const focusPos = squarePosition(hopState ? character.position.x / SQUARE_SPACING : currentIndex);
  cameraTarget.set(focusPos.x, 0, focusPos.z);
  const desired = new THREE.Vector3(character.position.x, CAMERA_UP, CAMERA_BACK);
  cameraCurrentPos.lerp(desired, CAMERA_LERP);
  camera.position.copy(cameraCurrentPos);
  camera.lookAt(character.position.x, 0.5, 0);
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
  renderer = new THREE.WebGLRenderer({ canvas: canvasEl, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  camera = new THREE.PerspectiveCamera(50, 1, 0.1, 100);
  cameraCurrentPos.set(0, CAMERA_UP, CAMERA_BACK);
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
  currentIndex = 0;
  mixer = null;
  idleAction = null;
  walkAction = null;
  currentAction = null;
}

function hopTo(fromIndex, toIndex, options) {
  return new Promise((resolve) => {
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
  if (toIndex > fromIndex) playAction(walkAction);
  let pos = fromIndex;
  while (pos < toIndex) {
    await hopTo(pos, pos + 1, options);
    pos += 1;
  }
  playAction(idleAction);
}

function focusOn(index) {
  currentIndex = index;
}

window.LifeRoadBoard3D = { mount, dispose, hopTo, hopSteps, focusOn };
