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
const CAMERA_BACK = 3.5;
const CAMERA_UP = 3.2;
const CAMERA_LERP = 0.08;
const DOG_MODEL_URL = new URL("./models/animal-dog.glb", import.meta.url).href;
// Kenney Cube Petsのモデルは実機確認前のため、見た目のスケール・接地位置は暫定値。
// 実際に表示してみてから調整する前提の値。
const CHARACTER_SCALE = 0.6;
const CHARACTER_Y_OFFSET = 0;

let renderer = null;
let scene = null;
let camera = null;
let character = null;
let squareMarkers = [];
let animationFrameId = null;

let hopState = null; // { fromIndex, toIndex, startTime, durationMs, onDone }
let currentIndex = 0;
let cameraTarget = new THREE.Vector3();
let cameraCurrentPos = new THREE.Vector3();

function squarePosition(index) {
  return new THREE.Vector3(index * SQUARE_SPACING, 0, 0);
}

function buildScene() {
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x9fd8c0);

  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(SQUARE_COUNT * SQUARE_SPACING + 4, 6),
    new THREE.MeshStandardMaterial({ color: 0x4f9d6e })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.set((SQUARE_COUNT - 1) * SQUARE_SPACING * 0.5, -0.5, 0);
  scene.add(ground);

  squareMarkers = [];
  for (let i = 0; i < SQUARE_COUNT; i++) {
    const marker = new THREE.Mesh(
      new THREE.BoxGeometry(1, 0.2, 1),
      new THREE.MeshStandardMaterial({ color: i % 2 === 0 ? 0xf4e3b2 : 0xf9f1dc })
    );
    const pos = squarePosition(i);
    marker.position.set(pos.x, -0.4, pos.z);
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
  character.add(placeholder);
  loadCharacterModel(character, placeholder);

  const light = new THREE.DirectionalLight(0xffffff, 1.6);
  light.position.set(3, 6, 4);
  scene.add(light);
  scene.add(new THREE.AmbientLight(0xffffff, 0.6));
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
      owner.add(model);
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
  character.position.y = Math.sin(t * Math.PI) * HOP_HEIGHT;
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
  camera.lookAt(character.position.x, 0.3, 0);
}

function animate() {
  animationFrameId = requestAnimationFrame(animate);
  updateHop(performance.now());
  updateCamera();
  renderer.render(scene, camera);
}

function mount(canvasEl) {
  if (renderer) dispose();
  renderer = new THREE.WebGLRenderer({ canvas: canvasEl, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
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
  window.removeEventListener("resize", resize);
  if (renderer) renderer.dispose();
  renderer = null;
  scene = null;
  camera = null;
  character = null;
  squareMarkers = [];
  hopState = null;
  currentIndex = 0;
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
  let pos = fromIndex;
  while (pos < toIndex) {
    await hopTo(pos, pos + 1, options);
    pos += 1;
  }
}

function focusOn(index) {
  currentIndex = index;
}

window.LifeRoadBoard3D = { mount, dispose, hopTo, hopSteps, focusOn };
