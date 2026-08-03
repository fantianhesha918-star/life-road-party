// ライフロード 通信モード: Firestore読み書き(部屋作成/参加/購読/ハートビート)
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  onSnapshot,
  serverTimestamp,
  Timestamp,
} from "https://www.gstatic.com/firebasejs/12.17.0/firebase-firestore.js";

const ROOM_CODE_CHARS = "23456789ABCDEFGHJKMNPQRSTUVWXYZ"; // 0/O/1/I/L等の紛らわしい文字を除外
const ROOM_CODE_LENGTH = 6;
const ROOM_TTL_HOURS = 6; // この時間操作がなければ部屋を再利用可能・TTLポリシーで自動削除対象にする
const CREATE_RETRY_LIMIT = 5;

function generateRoomCode() {
  let code = "";
  for (let i = 0; i < ROOM_CODE_LENGTH; i++) {
    code += ROOM_CODE_CHARS[Math.floor(Math.random() * ROOM_CODE_CHARS.length)];
  }
  return code;
}

function expireAtTimestamp() {
  return Timestamp.fromMillis(Date.now() + ROOM_TTL_HOURS * 60 * 60 * 1000);
}

function roomRef(roomCode) {
  return doc(window.FirebaseCtx.db, "rooms", roomCode);
}

// 端末のローカルプロフィールから、現在装備している見た目だけを取り出す
// (コイン・所持アイテム一覧はFirestoreには送らない)
function currentAvatarVisual() {
  const profile = window.LifeRoadProfile.loadProfile();
  return window.LifeRoadProfile.getAvatarVisual(profile.equipped);
}

// 部屋を新規作成する。部屋コードが偶然重複した場合は数回リトライする。
async function createRoom({ nickname, maxPlayers }) {
  const user = await window.FirebaseCtx.ensureSignedIn();
  const uid = user.uid;

  let lastError = null;
  for (let attempt = 0; attempt < CREATE_RETRY_LIMIT; attempt++) {
    const roomCode = generateRoomCode();
    const data = {
      createdAt: serverTimestamp(),
      lastActionAt: serverTimestamp(),
      expireAt: expireAtTimestamp(),
      status: "lobby",
      hostUid: uid,
      maxPlayers,
      boardId: "original-v1",
      turnOrder: [],
      currentTurnIndex: 0,
      currentTurnPlayerUid: null,
      players: {
        [uid]: {
          nickname,
          seatIndex: 0,
          isCPU: false,
          avatar: currentAvatarVisual(),
          position: 0,
          money: window.LifeRoadData.START_MONEY,
          job: null,
          finished: false,
          lastSeenAt: serverTimestamp(),
        },
      },
    };
    try {
      await setDoc(roomRef(roomCode), data);
      return { roomCode, uid };
    } catch (err) {
      lastError = err;
      // ルールで拒否される(既に使用中の部屋コードと衝突)場合は別のコードで再試行
    }
  }
  throw lastError || new Error("部屋の作成に失敗しました");
}

async function joinRoom({ roomCode, nickname }) {
  const user = await window.FirebaseCtx.ensureSignedIn();
  const uid = user.uid;
  const ref = roomRef(roomCode);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    throw new Error("部屋が見つかりませんでした。部屋番号を確認してください");
  }
  const room = snap.data();
  const existingUids = Object.keys(room.players || {});

  // 既に参加済みのメンバーなら、対戦中・終了後でも再入室できる(タブを閉じた/リロードした場合の復帰)
  if (existingUids.includes(uid)) {
    return { roomCode, uid };
  }
  if (room.status !== "lobby") {
    throw new Error("この部屋はすでに対戦が始まっています");
  }
  if (existingUids.length >= room.maxPlayers) {
    throw new Error("この部屋は満員です");
  }

  await updateDoc(ref, {
    [`players.${uid}`]: {
      nickname,
      seatIndex: existingUids.length,
      isCPU: false,
      avatar: currentAvatarVisual(),
      position: 0,
      money: window.LifeRoadData.START_MONEY,
      job: null,
      finished: false,
      lastSeenAt: serverTimestamp(),
    },
    lastActionAt: serverTimestamp(),
    expireAt: expireAtTimestamp(),
  });
  return { roomCode, uid };
}

function subscribeRoom(roomCode, onChange) {
  return onSnapshot(roomRef(roomCode), (snap) => {
    if (snap.exists()) onChange(snap.data());
  });
}

async function sendHeartbeat(roomCode, uid) {
  await updateDoc(roomRef(roomCode), {
    [`players.${uid}.lastSeenAt`]: serverTimestamp(),
  });
}

// ホストが対戦を開始する(参加者の入室順でターン順を決める)
async function startGame(roomCode, room) {
  const uids = Object.keys(room.players);
  await updateDoc(roomRef(roomCode), {
    status: "playing",
    turnOrder: uids,
    currentTurnIndex: 0,
    currentTurnPlayerUid: uids[0],
    lastActionAt: serverTimestamp(),
    expireAt: expireAtTimestamp(),
  });
}

// 現在の手番プレイヤーが、自分の手番の結果を書き込む
async function writeTurnResult(roomCode, patch) {
  await updateDoc(roomRef(roomCode), {
    ...patch,
    lastActionAt: serverTimestamp(),
    expireAt: expireAtTimestamp(),
  });
}

window.Room = {
  createRoom,
  joinRoom,
  subscribeRoom,
  sendHeartbeat,
  startGame,
  writeTurnResult,
};
