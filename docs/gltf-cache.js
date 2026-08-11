// GLTF/GLBモデルの共有キャッシュ(board3d.js・snack-board3d.js共通)。
// 同一URLは1回だけ読み込み、以降はロード済みテンプレートをclone(true)して使い回す。
// (マス数拡張以降、装飾を毎回読み込み直してモバイルでメモリ・CPU負荷からフリーズする
// 不具合の原因になっていたため、2026-08-11にboard3d.jsから切り出して共通化した)
import { GLTFLoader } from "https://unpkg.com/three@0.169.0/examples/jsm/loaders/GLTFLoader.js";
import { DRACOLoader } from "https://unpkg.com/three@0.169.0/examples/jsm/loaders/DRACOLoader.js";

const dracoLoader = new DRACOLoader();
dracoLoader.setDecoderPath("https://unpkg.com/three@0.169.0/examples/jsm/libs/draco/");

const gltfSceneCache = new Map(); // url -> Promise<THREE.Object3D>

export function loadGLTFSceneCached(url) {
  let cached = gltfSceneCache.get(url);
  if (!cached) {
    const loader = new GLTFLoader();
    loader.setDRACOLoader(dracoLoader);
    cached = new Promise((resolve, reject) => {
      loader.load(url, (gltf) => resolve(gltf.scene), undefined, reject);
    });
    gltfSceneCache.set(url, cached);
  }
  return cached;
}
