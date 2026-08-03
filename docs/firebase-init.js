// ライフロード Firebase初期化(通信モード選択時のみ読み込む想定)
// CDN経由でSDKを読み込むため、ビルド不要でGitHub Pagesにそのまま置ける。
//
// 注意: このファイルのAPIキーは「公開前提」の値です(Firebaseのクライアント向け
// APIキーは秘密情報ではありません)。実際のアクセス制御は firestore.rules 側の
// セキュリティルールで行っています。
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import {
  getAuth,
  signInAnonymously,
  onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";

// TODO: Firebaseコンソールでプロジェクトを作成後、実際の値に置き換える(フェーズ2セットアップ手順を参照)
const firebaseConfig = {
  apiKey: "PLACEHOLDER_API_KEY",
  authDomain: "PLACEHOLDER.firebaseapp.com",
  projectId: "PLACEHOLDER",
  storageBucket: "PLACEHOLDER.appspot.com",
  messagingSenderId: "PLACEHOLDER",
  appId: "PLACEHOLDER",
};

const firebaseApp = initializeApp(firebaseConfig);
const auth = getAuth(firebaseApp);
const db = getFirestore(firebaseApp);

// 匿名認証でサインインする(既存セッションがあればそれを使い、二重にアカウントを作らない)
function ensureSignedIn() {
  return new Promise((resolve, reject) => {
    const unsubscribe = onAuthStateChanged(
      auth,
      (user) => {
        unsubscribe();
        if (user) {
          resolve(user);
        } else {
          signInAnonymously(auth)
            .then((cred) => resolve(cred.user))
            .catch(reject);
        }
      },
      reject
    );
  });
}

window.FirebaseCtx = { auth, db, ensureSignedIn };
window.dispatchEvent(new Event("firebase-ctx-ready"));
