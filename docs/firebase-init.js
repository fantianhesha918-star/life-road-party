// ライフロード Firebase初期化(通信モード選択時のみ読み込む想定)
// CDN経由でSDKを読み込むため、ビルド不要でGitHub Pagesにそのまま置ける。
//
// 注意: このファイルのAPIキーは「公開前提」の値です(Firebaseのクライアント向け
// APIキーは秘密情報ではありません)。実際のアクセス制御は firestore.rules 側の
// セキュリティルールで行っています。
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.17.0/firebase-app.js";
import {
  getAuth,
  signInAnonymously,
  onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/12.17.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/12.17.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyCYDqffmRtgvGp-PNAC5TPzHp8v9o4zqSs",
  authDomain: "life-road-party.firebaseapp.com",
  projectId: "life-road-party",
  storageBucket: "life-road-party.firebasestorage.app",
  messagingSenderId: "688927743205",
  appId: "1:688927743205:web:722f3fc37731828db4c80c",
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
