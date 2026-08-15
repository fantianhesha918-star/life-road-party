// ライフロード 起動・画面遷移・全体配線

const SAVE_KEY = "liferoad_solo_save_v1";
const ONLINE_ROOM_KEY = "liferoad_online_room_v1";
const SNACK_SAVE_KEY = "liferoad_snack_save_v1";
const HEARTBEAT_INTERVAL_MS = 15000;
const HOP_STEP_MS = 420; // マス移動アニメーション、1マスあたりの所要時間
// snack-board3d.jsのHOP_STEP_DURATION_MSと同じ値(標準速度時の1マスあたりの所要時間)。
// ESモジュール側のprivate定数を直接参照できないため値を複製している(既存の
// SPECIES_MODEL_MAP等と同じ、このコードベース既存のパターン)。2026-08-15、移動を
// ゆっくりめに調整(260→360、理由はsnack-board3d.js側のHOP_STEP_DURATION_MS参照)。
const SNACK_HOP_STEP_MS = 360;
const CPU_PRE_ROLL_MS = 1100; // CPUがルーレットを回す前の「間」
const CPU_PRE_CHOICE_MS = 1500; // CPUが選択肢を考える「間」
const CPU_REVEAL_MS = 2200; // CPUの結果カード(テロップ)を見せておく時間
const TURN_POPUP_MS = 1500; // 手番切り替えポップアップの表示時間
const MONEY_TOAST_MS = 2600; // 所持金変動トーストの表示時間

// おやつ集めモードの演出速度設定(標準/はやい/最速)。localStorageにフラグを保存するだけの
// 簡易実装(既存のaudio.jsの音量設定と同じ保存パターンを踏襲)。snackDelayによる待機時間・
// 1マスごとの移動時間・サイコロ演出の長さをまとめて倍率で縮める。
const SNACK_SPEED_KEY = "liferoad_snack_speed_v1";
const SNACK_SPEED_SCALES = { standard: 1, fast: 1.8, fastest: 3 };
const SNACK_SPEED_LABELS = { standard: "標準", fast: "はやい", fastest: "最速" };
let snackSpeedScale = 1; // snackDelay()・サイコロ演出のスケール(1=標準、大きいほど速い)

function loadSnackSpeedSetting() {
  try {
    const raw = localStorage.getItem(SNACK_SPEED_KEY);
    return raw && SNACK_SPEED_SCALES[raw] ? raw : "standard";
  } catch (e) {
    return "standard";
  }
}

function saveSnackSpeedSetting(speed) {
  try {
    localStorage.setItem(SNACK_SPEED_KEY, speed);
  } catch (e) {
    // 保存できなくても致命的ではないので無視
  }
}

// おやつ集めモードの演出パイプライン(行動順決めサイコロ・ラウンド/ターンテロップ等)で使う
// Promiseベースの待機ヘルパー。setTimeoutをawaitできる形にするだけの小さなユーティリティ。
// snackSpeedScaleで割ることで、演出速度設定(はやい/最速)を全ての待機箇所へ一括反映する。
function snackDelay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms / snackSpeedScale));
}

// おやつ集めモード専用の効果音・振動(仕様書14章・別紙「効果音・振動仕様」)。
// 音源ファイルが未納のため、audio.jsに追加したplayTone()でWeb Audio APIの短い仮音を鳴らす。
// 仕様書のイベントID表(全19件)のうち、既存のフックだけで取りこぼし無く検出できる代表的な
// 7件に絞った(通過マスの効果音等、専用の検出ポイントが無いものは今回のフェーズでは対象外)。
const SNACK_SFX_EVENTS = {
  diceStop: { freq: 660, ms: 120, vibrate: 35 },
  coinGain: { freq: 880, ms: 90, vibrate: 20 },
  coinSpend: { freq: 330, ms: 110, vibrate: 20 },
  snackGet: { freq: 1046, ms: 220, vibrate: 80 },
  rankUp: { freq: 784, ms: 140, vibrate: 20 },
  rankDown: { freq: 392, ms: 140, vibrate: 25 },
  resultReveal: { freq: 700, ms: 220, vibrate: 25 },
  winner: { freq: 1046, ms: 320, vibrate: [80, 40, 120] },
  // ガブリオンイベント(05_ガブリオンイベント確定仕様書「音と画面効果」)。専用の音源は無いため
  // 引き続きWeb Audio仮音を使うが、振動パターンだけは仕様書の数値をそのまま採用する。
  gaburionEntrance: { freq: 220, ms: 260, vibrate: [40, 40] },
  gaburionSpin: { freq: 500, ms: 90, vibrate: null },
  gaburionBad: { freq: 260, ms: 260, vibrate: 60 },
  gaburionRescue: { freq: 900, ms: 260, vibrate: [30, 40] },
};

function snackSfx(eventId) {
  const ev = SNACK_SFX_EVENTS[eventId];
  if (!ev || !window.LifeRoadAudio) return;
  window.LifeRoadAudio.playTone(ev.freq, ev.ms);
  if (ev.vibrate) window.LifeRoadAudio.vibrate(ev.vibrate);
}

// entries内のtype:"money"/"snack"を見て対応する効果音を鳴らす。1アクションで複数の
// entryが出ることもあるが、演出としてはまとめて1回で十分なため最初の1件だけを採用する。
function playSnackEntrySfx(entries) {
  if (!entries || !entries.length) return;
  const moneyEntry = entries.find((e) => e.type === "money" && typeof e.delta === "number" && e.delta !== 0);
  if (entries.some((e) => e.type === "snack")) {
    snackSfx("snackGet");
  } else if (moneyEntry) {
    snackSfx(moneyEntry.delta > 0 ? "coinGain" : "coinSpend");
  }
}

// 古いセーブ(ガブリオン機能追加より前)にも空のガブリオン関連フィールドを補う
// (仕様書「古いセーブにはactivated:falseと空配列を補完する」)。
function migrateSnackSaveState(state) {
  if (!state.gaburion) {
    state.gaburion = { eventId: null, actorId: null, phase: null, resultId: null, targetPlayerId: null, resolved: true, cursedDiePlayerIds: [] };
  }
  if (!state.finalThree) {
    state.finalThree = { activated: false, activatedRound: null, seed: null, transformedSpaces: [] };
  }
  if (state.pendingGaburion === undefined) state.pendingGaburion = null;
  return state;
}

// SNACK_STAGE_NODESはページ内で使い回す共有配列だが、ページ再読み込みでモジュールが
// 再評価されるとノード側の実行時変更(橋の開閉・ガブリオンの盤面変化)は失われる。
// セーブ再開時、保存されているstate側の情報からノードの状態を作り直す(罠(activeTrap)は
// セーブ対象外の既存設計のため対象外のまま)。第8ラウンド以降なのに変化がまだ未適用という
// タイミングでセーブされていた場合は、演出無しで即座に適用して状態の正しさを優先する。
function reapplySnackNodeMutations(state) {
  applySnackGimmickForRound(state);
  if (state.finalThree.activated) {
    state.finalThree.transformedSpaces.forEach((change) => {
      const node = findSnackNode(change.spaceId);
      if (!node) return;
      if (change.afterType === "gaburion") node.gaburion = true;
      else node.nodeType = change.afterType;
    });
  } else if (state.round >= state.totalRounds - SNACK_FINAL_SPRINT_ROUND_OFFSET) {
    applySnackFinalThreeTransform(state);
  }
}

// 3D種選択(speciesId)の実装より前に保存されたセーブ・オンライン部屋データにはavatarに
// speciesIdが無い場合がある。無いままだと board3d.js が3Dモデルを一切読み込まず、
// createCharacterPlaceholder()の色付きカプセル(プレイヤー色そのまま)で止まってしまうため、
// 読み込み・復元のたびにこの関数で補う。
function ensureSpeciesId(avatar, fallbackColor) {
  const a = avatar || { color: fallbackColor };
  if (!a.speciesId) {
    a.speciesId = "species-chinchilla-gray";
    if (!a.speciesEmoji) a.speciesEmoji = "🐹";
  }
  return a;
}

// Firestoreの部屋ドキュメント(playersがuidキーのマップ)を、game-engine.jsが
// 扱えるゲーム状態(playersが配列)に変換する
function roomToEngineState(room) {
  // 全クライアント(ホスト・参加者とも)が同じ盤面(BOARD_SQUARES等)を独立に再現できるよう、
  // room.squareCountから毎回セットし直す(決定的な生成のため配列自体をFirestoreに送る必要はない)。
  setActiveBoard(room.squareCount || 30);
  const order = room.turnOrder && room.turnOrder.length ? room.turnOrder : Object.keys(room.players);
  const players = order.map((uid, i) => {
    const p = room.players[uid] || {};
    const color = TOKEN_COLORS[i % TOKEN_COLORS.length];
    return {
      id: uid,
      name: p.nickname || `プレイヤー${i + 1}`,
      isCPU: !!p.isCPU,
      personality: p.personality || null,
      color,
      avatar: ensureSpeciesId(p.avatar || { color, speciesEmoji: null, costumeImage: null }, color),
      position: typeof p.position === "number" ? p.position : 0,
      money: typeof p.money === "number" ? p.money : window.LifeRoadData.START_MONEY,
      job: p.job || null,
      finished: !!p.finished,
      skipNextTurn: !!p.skipNextTurn,
      stockShares: typeof p.stockShares === "number" ? p.stockShares : 0,
      children: typeof p.children === "number" ? p.children : 0,
      housePrice: typeof p.housePrice === "number" ? p.housePrice : 0,
      insurance: p.insurance || null,
      finishOrder: typeof p.finishOrder === "number" ? p.finishOrder : null,
      settlement: p.settlement || null,
    };
  });
  const currentTurnIndex = Math.max(0, order.indexOf(room.currentTurnPlayerUid));
  return {
    players,
    currentTurnIndex,
    turnNumber: 1,
    status: room.status === "finished" ? "finished" : "playing",
    pendingChoice: null,
    finishCounter: typeof room.finishCounter === "number" ? room.finishCounter : 0,
  };
}

// game-engine.jsで進めたローカル状態を、Firestoreに書き戻すパッチに変換する
// (既存のnickname/seatIndex/isCPU/lastSeenAtは保持し、進行に関わる項目だけ更新する)
function engineStateToRoomPatch(localState, room) {
  const players = {};
  localState.players.forEach((p) => {
    const existing = room.players[p.id] || {};
    players[p.id] = {
      ...existing,
      position: p.position,
      money: p.money,
      job: p.job,
      finished: p.finished,
      skipNextTurn: !!p.skipNextTurn,
      stockShares: p.stockShares || 0,
      children: p.children || 0,
      housePrice: p.housePrice || 0,
      insurance: p.insurance || null,
      finishOrder: p.finishOrder || null,
      settlement: p.settlement || null,
    };
  });
  const finished = localState.status === "finished";
  return {
    players,
    currentTurnIndex: localState.currentTurnIndex,
    currentTurnPlayerUid: finished ? null : localState.players[localState.currentTurnIndex].id,
    status: finished ? "finished" : "playing",
    finishCounter: localState.finishCounter || 0,
  };
}

const App = {
  screen: "title",
  mode: "solo", // "solo" | "online"

  // ---- 一人モード用の状態 ----
  state: null,
  log: [],
  humanId: "human",
  lastReward: null,

  // ---- ターンハブ(演出+選択肢メニュー)のUI状態。solo/online共通で使う ----
  hub: { view: "menu", spinNumber: null, itemMessage: null },
  // ---- 選択イベントの結果演出カード。solo用(online用はthis.online.revealに持つ) ----
  reveal: null, // { text, delta, job }
  // ---- ログモーダルの開閉状態。solo/online共通で使う ----
  logOpen: false,
  // ---- 選択画面から開く「自分の状況を確認」モーダルの開閉状態。solo/online共通で使う ----
  statusPeekOpen: false,
  // ---- ヘッダーの中断ボタンから開く「メニューに戻りますか？」確認モーダルの開閉状態 ----
  pauseMenuOpen: false,
  // ---- 所持金が変動したプレイヤーを一定時間だけ画面上部に知らせるトースト表示。
  // 結婚のお祝い金のように「今の手番プレイヤー以外」の所持金も動くイベント向け
  // (手番プレイヤー自身の増減は演出カード側のreveal-deltaで既に見えているため対象外)----
  moneyToasts: [],
  moneyToastSeq: 0,
  // ---- ホップ移動アニメーション中かどうか。true の間は選択モーダルを表示しない ----
  hopping: false,
  // ---- ホップ移動中に「今動いているプレイヤーid」を覚えておく。state.currentTurnIndexは
  // 移動開始前に次の手番へ進んでしまうため、カメラ・ヘッダーはこちらを優先して参照する ----
  hoppingPlayerId: null,
  // ---- 手番切り替え時に一瞬表示するポップアップ(アバター+名前)。solo用(online用はthis.online.turnPopup) ----
  turnPopup: null, // { name, visual }
  turnPopupTimer: null,
  // ---- 3D盤面のマウント状態管理(sync3DBoard参照)。現在マウント中かどうかを覚えておく ----
  board3dMounted: false,
  // ---- おやつ集めモード3D盤面のマウント状態(sync3DBoard参照、既存board3dMountedとは別管理) ----
  snackBoard3dMounted: false,
  // ---- ショップで購入成功時に一瞬表示する「入手しました」トースト。solo/online共通で使う ----
  shopToast: null, // { name, image, emoji }
  shopToastTimer: null,

  // ---- 通信モード用の状態 ----
  online: null, // { roomCode, uid, nickname, room, unsubscribe, log, localTurnState }
  onlineError: null,
  onlineBusy: false,
  heartbeatTimer: null,

  init() {
    this.render();
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("./service-worker.js").catch(() => {});
    }
  },

  hasSave() {
    return !!localStorage.getItem(SAVE_KEY);
  },

  goTitle() {
    this.teardownOnline();
    this.mode = "solo";
    this.screen = "title";
    this.state = null;
    this.log = [];
    this.hub = { view: "menu", spinNumber: null, itemMessage: null };
    this.reveal = null;
    this.logOpen = false;
    this.statusPeekOpen = false;
    this.pauseMenuOpen = false;
    this.moneyToasts = [];
    this.hopping = false;
    this.hoppingPlayerId = null;
    clearTimeout(this.turnPopupTimer);
    this.turnPopup = null;
    this.render();
  },

  goSetup() {
    this.mode = "solo";
    this.screen = "setup";
    this.render();
  },

  goProfile() {
    this.screen = "profile";
    this.render();
  },

  goShop() {
    this.screen = "shop";
    this.render();
  },

  goSettings() {
    this.screen = "settings";
    this.render();
  },

  goHelp() {
    this.screen = "help";
    this.render();
  },

  goStats() {
    this.screen = "stats";
    this.render();
  },

  setAudioSetting(key, value) {
    const settings = LifeRoadAudio.loadAudioSettings();
    settings[key] = value;
    LifeRoadAudio.saveAudioSettings(settings);
    this.render();
  },

  testPlaySe() {
    LifeRoadAudio.playSe("confirm");
  },

  // ==================== 盤面3D化(フェーズC・本番統合) ====================

  loadBoard3DModules() {
    if (window.LifeRoadBoard3D) return Promise.resolve();
    return import("./board3d.js");
  },

  loadSnackBoard3DModules() {
    if (window.LifeRoadSnackBoard3D) return Promise.resolve();
    return import("./snack-board3d.js");
  },

  equipAvatarItem(category, itemId) {
    const profile = LifeRoadProfile.loadProfile();
    LifeRoadProfile.equipItem(profile, category, itemId);
    LifeRoadProfile.saveProfile(profile);
    this.render();
  },

  buyShopItem(itemId) {
    const profile = LifeRoadProfile.loadProfile();
    const result = LifeRoadProfile.purchaseItem(profile, itemId);
    if (result.ok) {
      LifeRoadProfile.saveProfile(profile);
      LifeRoadAudio.playSe("confirm");
      const item = LifeRoadProfile.findShopItem(itemId);
      this.shopToast = item ? { name: item.name, image: item.image, emoji: item.emoji } : null;
      clearTimeout(this.shopToastTimer);
      this.shopToastTimer = setTimeout(() => {
        this.shopToast = null;
        this.render();
      }, 1800);
    } else {
      LifeRoadAudio.playSe("error");
    }
    this.render();
  },

  continueGame() {
    const saved = this.loadSave();
    if (!saved) {
      this.goTitle();
      return;
    }
    this.mode = "solo";
    this.state = saved.state;
    this.log = saved.log;
    this.humanId = saved.humanId;
    // 旧セーブ(ゲームモード導入前)にはboardSquareCountが無いため、30マスのレガシー盤面
    // にフォールバックする(setActiveBoardは30以外なら生成、30なら手作業盤面を使う)。
    setActiveBoard(this.state.boardSquareCount || 30);
    // 旧セーブにはavatar.speciesIdが無い場合がある。人間は現在の装備種、CPU等は既定種で補う
    // (ensureSpeciesIdは既定種のみのため、人間だけ先に現在の装備種を明示的に当てる)
    const profile = LifeRoadProfile.loadProfile();
    const humanVisual = LifeRoadProfile.getAvatarVisual(profile.equipped);
    this.state.players.forEach((p) => {
      if (p.id === this.humanId && p.avatar && !p.avatar.speciesId) {
        p.avatar.speciesId = humanVisual.speciesId;
        p.avatar.speciesEmoji = humanVisual.speciesEmoji;
      } else {
        ensureSpeciesId(p.avatar, p.color);
      }
    });
    this.hub = { view: "menu", spinNumber: null, itemMessage: null };
    this.reveal = null;
    this.logOpen = false;
    this.statusPeekOpen = false;
    this.pauseMenuOpen = false;
    this.moneyToasts = [];
    this.hopping = false;
    this.hoppingPlayerId = null;
    this.screen = "game";
    this.render();
    this.showTurnPopup();
    this.maybeRunCPUTurn();
  },

  startGame() {
    const nicknameInput = document.getElementById("nickname-input");
    const cpuSelect = document.getElementById("cpu-count-select");
    const modeSelect = document.getElementById("mode-select");
    const nickname = ((nicknameInput && nicknameInput.value) || "プレイヤー").trim().slice(0, 10) || "プレイヤー";
    const cpuCount = parseInt((cpuSelect && cpuSelect.value) || "1", 10);
    const squareCount = parseInt((modeSelect && modeSelect.value) || "100", 10);
    setActiveBoard(squareCount);

    const profile = LifeRoadProfile.loadProfile();
    const humanAvatar = LifeRoadProfile.getAvatarVisual(profile.equipped);
    const configs = [{ id: "human", name: nickname, isCPU: false, avatar: humanAvatar }];
    for (let i = 1; i <= cpuCount; i++) {
      // speciesIdが無いと3Dモデルを一切読み込まず、色付きプレースホルダーのままになってしまうため
      // 動物種をランダムに割り当てる(SPECIES_ITEMSはshop-data.js参照)
      const species = SPECIES_ITEMS[Math.floor(Math.random() * SPECIES_ITEMS.length)];
      configs.push({
        id: `cpu${i}`,
        name: `CPU${i}`,
        isCPU: true,
        personality: LifeRoadCPU.pickRandomPersonality(),
        avatar: {
          color: TOKEN_COLORS[i % TOKEN_COLORS.length],
          speciesId: species.id,
          speciesEmoji: species.emoji,
          costumeImage: null,
        },
      });
    }
    this.humanId = "human";
    this.state = createInitialState(configs);
    this.log = [{ type: "info", text: "ゲーム開始！" }];
    this.hub = { view: "menu", spinNumber: null, itemMessage: null };
    this.reveal = null;
    this.logOpen = false;
    this.statusPeekOpen = false;
    this.pauseMenuOpen = false;
    this.moneyToasts = [];
    this.hopping = false;
    this.hoppingPlayerId = null;
    this.screen = "game";
    this.saveGame();
    this.render();
    this.showTurnPopup();
    this.maybeRunCPUTurn();
  },

  handleRoll(roll) {
    if (!this.state || this.state.status !== "playing") return;
    const turnPlayer = currentPlayer(this.state);
    if (turnPlayer.id !== this.humanId || this.state.pendingChoice) return;
    const actualRoll = typeof roll === "number" ? roll : rollDice();
    const playerId = turnPlayer.id;
    const fromPos = turnPlayer.position;
    const result = applyRoll(this.state, actualRoll);
    const toPos = turnPlayer.position;
    this.runHopSteps(playerId, fromPos, toPos, () => {
      this.pushLog(result.entries);
      this.showMoneyToasts(result.entries, playerId, this.state.players);
      if (!result.pendingChoice && result.reveal) {
        // choice以外のマス(できごと・運命の分かれ道・給料日・ひと休み等)もテロップ枠で
        // 見せてから次へ進む。「つぎへ」を押すまでdismissReveal()が呼ばれずターンは進まない。
        // applyRoll()は既にターンを次へ進めた状態までstateを更新済みのため、この時点で
        // 一度保存しておく(「つぎへ」を押す前に中断されると、resultText表示中の内容が
        // 保存されないまま次回再開時に古い状態へ巻き戻ってしまうバグの修正、2026-08-11)。
        this.reveal = { ...result.reveal, visual: turnPlayer.avatar || { color: turnPlayer.color, speciesEmoji: null, costumeImage: null } };
        this.saveGame();
        this.render();
        return;
      }
      this.afterTurnAction();
    });
  },

  // ---- マップ上のホップ移動アニメーション(solo/online共通、3D盤面側に委譲) ----

  runHopSteps(playerId, fromPos, toPos, onDone) {
    if (toPos <= fromPos) {
      onDone();
      return;
    }
    // ホップ開始時点でhub/pendingChoice/currentTurnIndexは既に次の状態に更新済みだが、
    // 選択モーダルはキャラクターが動き終わるまでhoppingフラグで抑止する(render()自体は
    // ここで一度呼び、ルーレット/ターンハブのモーダルは退かす。移動そのものは3D側が自前の
    // rAFで進める)。hoppingPlayerIdは、currentTurnIndexが既に次のプレイヤーを指していても
    // カメラ・ヘッダーが「今実際に動いているプレイヤー」を映し続けるための参照用。
    this.hopping = true;
    this.hoppingPlayerId = playerId;
    this.render();
    // ゲーム開始直後の1ターン目など、3D盤面(board3d.js、CDN経由のThree.js含む)の初回読み込みが
    // 終わっていない状態で即座にルーレットを押すと、旧実装では window.LifeRoadBoard3D が
    // まだ無いためホップ演出を丸ごとスキップして即終了させてしまい、「1ターン目だけキャラクターが
    // 追えない(そもそも動くところが描画されない)」不具合になっていた。読み込みを待ってから
    // ホップを実行するよう修正する(render()内のsync3DBoard()が既にmount()側のloadを
    // 呼んでいるため、同じPromiseにthenするだけでmount完了後の実行順が保証される)。
    this.loadBoard3DModules().then(() => {
      window.LifeRoadBoard3D.hopSteps(playerId, fromPos, toPos, { stepDurationMs: HOP_STEP_MS }).then(() => {
        this.hopping = false;
        this.hoppingPlayerId = null;
        onDone();
      });
    });
  },

  // 通信対戦で、自分が操作していない他プレイヤー(人間・CPU問わず)の位置がFirestore経由で
  // 変わったことを検知し、瞬間移動ではなくホップ演出付きで自分の画面にも反映する
  // (通信モードでの3D同期強化、2026-08-11)。自分自身の手番、および自分がホストとして
  // 駆動したCPUの手番は、駆動した時点でknownPositionsを先読み更新しておくことで、
  // ここでの二重アニメーションを防いでいる(maybeRunOnlineCPUTurn参照)。
  syncRemotePositions(room) {
    if (!this.online) return;
    const known = this.online.knownPositions;
    Object.keys(room.players || {}).forEach((uid) => {
      const newPos = room.players[uid].position;
      const prevPos = known[uid];
      // 自分(ホスト)がCPUの手番を駆動した際に先読み更新した値より古いスナップショット
      // (Firestoreへの書き込みがまだ反映されていないハートビート等)は無視する。ここで
      // known[uid]を巻き戻してしまうと、後から届く新しいスナップショットで再び「進んだ」と
      // 誤検知し、同じ移動を二重にホップ演出してしまう(2026-08-11に実機テストで発覚・修正)。
      if (prevPos !== undefined && newPos < prevPos) return;
      // 自分自身/初見のプレイヤー/位置変化なしは演出せず基準位置として記録するだけ
      if (uid === this.online.uid || prevPos === undefined || newPos === prevPos) {
        known[uid] = newPos;
        return;
      }
      if (this.online.remoteHoppingIds.has(uid)) return; // 既にこのプレイヤーの演出中
      known[uid] = newPos;
      this.online.remoteHoppingIds.add(uid);
      this.online.remoteFocusPlayerId = uid; // カメラもこの演出中のプレイヤーを追う(sync3DBoard参照)
      this.loadBoard3DModules().then(() => {
        window.LifeRoadBoard3D.hopSteps(uid, prevPos, newPos, { stepDurationMs: HOP_STEP_MS }).then(() => {
          // ホップ演出中に退室していたら(this.online=null)何もしない
          if (!this.online) return;
          this.online.remoteHoppingIds.delete(uid);
          if (this.online.remoteFocusPlayerId === uid) this.online.remoteFocusPlayerId = null;
          this.render();
        });
      });
    });
  },

  // ---- ターンハブ(演出+選択肢メニュー) ----

  showHubView(view) {
    this.hub = { view, spinNumber: null, itemMessage: null };
    this.render();
  },

  // ---- ログモーダル(solo/online共通) ----

  toggleLog() {
    this.logOpen = !this.logOpen;
    LifeRoadAudio.playSe(this.logOpen ? "modalOpen" : "modalClose");
    this.render();
  },

  // ---- 選択画面から開く「自分の状況を確認」モーダル(solo/online共通) ----

  toggleStatusPeek() {
    this.statusPeekOpen = !this.statusPeekOpen;
    LifeRoadAudio.playSe(this.statusPeekOpen ? "modalOpen" : "modalClose");
    this.render();
  },

  // ---- ヘッダーの中断ボタン(ゲーム画面からメニューへ戻る、solo/online共通) ----

  togglePauseMenu() {
    this.pauseMenuOpen = !this.pauseMenuOpen;
    LifeRoadAudio.playSe(this.pauseMenuOpen ? "modalOpen" : "modalClose");
    this.render();
  },

  // 「タイトルに戻る」確定。soloは進行状況を保存してから戻る(continueGameで再開できる)。
  // onlineは自分のルーム参照を消して退室する(他プレイヤーの対戦はそのまま続く)。
  confirmPauseToTitle() {
    if (this.screen === "snack-game") {
      this.saveSnackGame();
      this.goTitle();
      return;
    }
    if (this.mode === "online") {
      this.leaveOnlineRoom();
      return;
    }
    this.saveGame();
    this.goTitle();
  },

  // ---- 所持金変動トースト(結婚のお祝い金のように手番プレイヤー以外の所持金も動くイベント用) ----
  // entriesの中から「今の手番プレイヤー以外」のtype:"money"かつplayerId付きのものを拾い、
  // 画面上部に一定時間だけ表示する(演出カード側は手番プレイヤー自身の増減しか見せないため)。
  showMoneyToasts(entries, actingPlayerId, players) {
    const targets = entries.filter((e) => e.type === "money" && e.playerId && e.playerId !== actingPlayerId && e.delta);
    if (!targets.length) return;
    const newToasts = targets.map((e) => {
      const player = players.find((p) => p.id === e.playerId);
      this.moneyToastSeq += 1;
      return {
        id: this.moneyToastSeq,
        name: player ? player.name : "",
        visual: player ? player.avatar || { color: player.color, speciesEmoji: null, costumeImage: null } : null,
        delta: e.delta,
      };
    });
    this.moneyToasts = this.moneyToasts.concat(newToasts);
    LifeRoadAudio.playSe(newToasts[0].delta > 0 ? "moneyGain" : "moneySpend");
    this.render();
    newToasts.forEach((toast) => {
      setTimeout(() => {
        this.moneyToasts = this.moneyToasts.filter((t) => t.id !== toast.id);
        this.render();
      }, MONEY_TOAST_MS);
    });
  },

  useConsumable(itemId) {
    const profile = LifeRoadProfile.loadProfile();
    const result = LifeRoadProfile.useConsumableItem(profile, itemId);
    if (!result.ok) {
      LifeRoadAudio.playSe("error");
      return;
    }
    LifeRoadAudio.playSe("confirm");
    LifeRoadProfile.saveProfile(profile);

    if (this.mode === "online") {
      if (!this.online || !this.online.room) return;
      if (!this.online.localTurnState) this.online.localTurnState = roomToEngineState(this.online.room);
      const entry = applyItemEffect(this.online.localTurnState, this.online.uid, result.delta, result.item.name);
      this.pushOnlineLog([entry]);
    } else {
      if (!this.state) return;
      const entry = applyItemEffect(this.state, this.humanId, result.delta, result.item.name);
      this.pushLog([entry]);
      this.saveGame();
    }

    this.hub = {
      view: "items",
      spinNumber: null,
      itemMessage: `「${result.item.name}」を使った(${result.delta >= 0 ? "+" : ""}${result.delta}万円)`,
    };
    this.render();
  },

  spinRoulette() {
    if (this.hub.view === "spinning") return;
    this.runRouletteAnimation((finalRoll) => this.commitRoulette(finalRoll));
  },

  // ルーレットの回転演出そのもの(hub.view="spinning")。onFinishに最終的な目を渡して呼ぶ。
  // 人間の手動ロール(spinRoulette)・CPUの自動ロール(maybeRunCPUTurn)の両方から使う共通処理。
  runRouletteAnimation(onFinish) {
    LifeRoadAudio.playSe("diceRoll");
    const finalRoll = rollDice();
    this.hub = { view: "spinning", spinNumber: rollDice(), spinning: true, itemMessage: null };
    this.render();

    let ticks = 0;
    const totalTicks = 9;
    const timer = setInterval(() => {
      ticks++;
      if (ticks >= totalTicks) {
        clearInterval(timer);
        this.hub.spinNumber = finalRoll;
        this.hub.spinning = false;
        this.render();
        setTimeout(() => onFinish(finalRoll), 400);
        return;
      }
      this.hub.spinNumber = rollDice();
      this.render();
    }, 90);
  },

  commitRoulette(roll) {
    this.hub = { view: "menu", spinNumber: null, itemMessage: null };
    if (this.mode === "online") {
      this.handleOnlineRoll(roll);
    } else {
      this.handleRoll(roll);
    }
  },

  chooseOption(optionIndex) {
    if (!this.state || !this.state.pendingChoice) return;
    LifeRoadAudio.playSe("confirm");
    // resolveChoice後はcurrentTurnIndexが次の手番へ進んでしまうため、
    // 演出に使うアバターはここで(選んだ本人のものを)先に確保しておく
    const player = this.state.players.find((p) => p.id === this.state.pendingChoice.playerId);
    const result = resolveChoice(this.state, this.state.pendingChoice.playerId, optionIndex);
    this.pushLog(result.entries);
    this.reveal = { ...result.reveal, visual: player.avatar || { color: player.color, speciesEmoji: null, costumeImage: null } };
    // resolveChoice()は選択確定・ターン進行までstateを即座に更新済みのため、この時点で
    // 一度保存する(「つぎへ」を押す前に中断されると選択前の状態へ巻き戻るバグの修正、2026-08-11、
    // Codexレビューで指摘)。
    this.saveGame();
    this.render();
  },

  dismissReveal() {
    if (!this.reveal) return;
    this.reveal = null;
    this.afterTurnAction();
  },

  afterTurnAction() {
    this.saveGame();
    this.render();
    if (this.state.status === "finished") {
      const human = this.state.players.find((p) => p.id === this.humanId);
      const ranking = getRanking(this.state);
      const isFirstPlace = !!(ranking[0] && ranking[0].id === this.humanId);
      this.lastReward = this.grantGameReward(human ? human.money : 0, isFirstPlace);
      LifeRoadAudio.playBgmJingle("goal");
      setTimeout(() => {
        this.screen = "result";
        this.clearSave();
        this.render();
      }, 900);
      return;
    }
    // state.currentTurnIndexはこの時点で既に次のプレイヤーへ進んでいるので、
    // ここで「次は誰の番か」のポップアップを一瞬出す(pendingChoice中でも手番自体は
    // 変わっていないので誤って表示されることはない)
    if (!this.state.pendingChoice) this.showTurnPopup();
    this.maybeRunCPUTurn();
  },

  // 手番切り替え時に、アバターと名前を1〜2秒だけ中央に表示するポップアップ
  showTurnPopup() {
    const turnPlayer = currentPlayer(this.state);
    if (!turnPlayer) return;
    this.turnPopup = { name: turnPlayer.name, visual: turnPlayer.avatar || { color: turnPlayer.color, speciesEmoji: null, costumeImage: null } };
    LifeRoadAudio.playSe("notify");
    this.render();
    clearTimeout(this.turnPopupTimer);
    this.turnPopupTimer = setTimeout(() => {
      this.turnPopup = null;
      this.render();
    }, TURN_POPUP_MS);
  },

  // オンライン版のsyncOnlineScreen()から、手番プレイヤーが切り替わるたびに呼ばれる
  showOnlineTurnPopup(turnPlayer) {
    if (!this.online) return;
    this.online.turnPopup = { name: turnPlayer.name, visual: turnPlayer.avatar || { color: turnPlayer.color, speciesEmoji: null, costumeImage: null } };
    LifeRoadAudio.playSe("notify");
    clearTimeout(this.turnPopupTimer);
    this.turnPopupTimer = setTimeout(() => {
      if (this.online) this.online.turnPopup = null;
      this.render();
    }, TURN_POPUP_MS);
  },

  grantGameReward(finalMoney, isFirstPlace) {
    const profile = LifeRoadProfile.loadProfile();
    const reward = LifeRoadProfile.applyGameReward(profile, finalMoney, isFirstPlace);
    LifeRoadProfile.saveProfile(profile);
    return reward;
  },

  maybeRunCPUTurn() {
    if (!this.state || this.state.status !== "playing") return;

    if (this.state.pendingChoice) {
      const choosingPlayer = this.state.players.find((p) => p.id === this.state.pendingChoice.playerId);
      if (choosingPlayer && choosingPlayer.isCPU) {
        this.runCPUChoice(choosingPlayer);
      }
      return;
    }

    const turnPlayer = currentPlayer(this.state);
    if (!turnPlayer.isCPU) return;
    setTimeout(() => {
      if (!this.state || this.state.status !== "playing") return;
      // 人間の手番と同じルーレット演出を見せてからロールを確定する(CPUだけ演出無しで
      // 即座に進むと、何が起きたか分かりづらいため)
      this.runRouletteAnimation((roll) => this.commitCPURoll(roll));
    }, CPU_PRE_ROLL_MS);
  },

  commitCPURoll(roll) {
    if (!this.state || this.state.status !== "playing") return;
    this.hub = { view: "menu", spinNumber: null, itemMessage: null };
    const player = currentPlayer(this.state);
    const playerId = player.id;
    const fromPos = player.position;
    const result = applyRoll(this.state, roll);
    const toPos = player.position;
    this.runHopSteps(playerId, fromPos, toPos, () => {
      this.pushLog(result.entries);
      this.showMoneyToasts(result.entries, playerId, this.state.players);
      if (!result.pendingChoice && result.reveal) {
        this.reveal = {
          ...result.reveal,
          visual: player.avatar || { color: player.color, speciesEmoji: null, costumeImage: null },
          interactive: false,
        };
        // CPUのロール結果も既にstateへ反映済みのため、非表示タイマーを待たず即座に保存する
        // (人間の選択と同じ「reveal表示中の中断で巻き戻る」バグの修正、2026-08-11)。
        this.saveGame();
        this.render();
        setTimeout(() => {
          if (!this.reveal) return;
          this.reveal = null;
          this.afterTurnAction();
        }, CPU_REVEAL_MS);
        return;
      }
      this.afterTurnAction();
    });
  },

  // CPUが就職・イベント等の選択マスに止まったときの演出。人間と同じ選択モーダルを
  // (押せない状態で)一定時間見せてから、CPUの決定と結果を演出付きで表示する。
  runCPUChoice(choosingPlayer) {
    setTimeout(() => {
      if (!this.state || !this.state.pendingChoice) return;
      const idx = cpuDecideOption(this.state.pendingChoice, choosingPlayer.personality);
      const result = resolveChoice(this.state, this.state.pendingChoice.playerId, idx);
      this.pushLog(result.entries);
      this.reveal = {
        ...result.reveal,
        visual: choosingPlayer.avatar || { color: choosingPlayer.color, speciesEmoji: null, costumeImage: null },
        interactive: false,
      };
      // CPUの選択結果も既にstateへ反映済みのため、非表示タイマーを待たず即座に保存する
      // (人間の選択と同じ「reveal表示中の中断で巻き戻る」バグの修正、2026-08-11)。
      this.saveGame();
      this.render();
      setTimeout(() => {
        if (!this.reveal) return;
        this.reveal = null;
        this.afterTurnAction();
      }, CPU_REVEAL_MS);
    }, CPU_PRE_CHOICE_MS);
  },

  pushLog(entries) {
    this.log = [...entries].reverse().concat(this.log).slice(0, 100);
  },

  saveGame() {
    try {
      localStorage.setItem(
        SAVE_KEY,
        JSON.stringify({ state: this.state, log: this.log, humanId: this.humanId })
      );
    } catch (e) {
      // 保存容量オーバー等は無視(オートセーブは補助機能のため)
    }
  },

  loadSave() {
    try {
      return JSON.parse(localStorage.getItem(SAVE_KEY));
    } catch (e) {
      return null;
    }
  },

  clearSave() {
    localStorage.removeItem(SAVE_KEY);
  },

  // ==================== 通信モード ====================

  loadFirebaseModules() {
    if (window.Room) return Promise.resolve();
    return import("./firebase-init.js").then(() => import("./room.js"));
  },

  goOnlineMenu() {
    this.mode = "online";
    this.screen = "online-menu";
    this.onlineError = null;
    this.onlineBusy = false;
    this.render();
  },

  createOnlineRoom() {
    const nicknameInput = document.getElementById("online-nickname-input");
    const maxPlayersSelect = document.getElementById("online-maxplayers-select");
    const modeSelect = document.getElementById("online-mode-select");
    const cpuCountSelect = document.getElementById("online-cpu-count-select");
    const nickname = ((nicknameInput && nicknameInput.value) || "プレイヤー").trim().slice(0, 10) || "プレイヤー";
    const maxPlayers = parseInt((maxPlayersSelect && maxPlayersSelect.value) || "4", 10);
    const squareCount = parseInt((modeSelect && modeSelect.value) || "100", 10);
    // ホスト自身の1枠は必ず確保する(CPU人数がmaxPlayersと同数以上にならないようクランプ)
    const cpuCount = Math.min(parseInt((cpuCountSelect && cpuCountSelect.value) || "0", 10), maxPlayers - 1);

    this.onlineError = null;
    this.onlineBusy = true;
    this.render();
    this.loadFirebaseModules()
      .then(() => window.Room.createRoom({ nickname, maxPlayers, squareCount, cpuCount }))
      .then(({ roomCode, uid }) => this.enterOnlineRoom(roomCode, uid, nickname))
      .catch((err) => this.handleOnlineError(err));
  },

  joinOnlineRoom() {
    const nicknameInput = document.getElementById("online-nickname-input");
    const codeInput = document.getElementById("online-roomcode-input");
    const nickname = ((nicknameInput && nicknameInput.value) || "プレイヤー").trim().slice(0, 10) || "プレイヤー";
    const roomCode = ((codeInput && codeInput.value) || "").trim().toUpperCase();
    if (!roomCode) {
      this.onlineError = "部屋番号を入力してください";
      this.render();
      return;
    }

    this.onlineError = null;
    this.onlineBusy = true;
    this.render();
    this.loadFirebaseModules()
      .then(() => window.Room.joinRoom({ roomCode, nickname }))
      .then(({ roomCode: code, uid }) => this.enterOnlineRoom(code, uid, nickname))
      .catch((err) => this.handleOnlineError(err));
  },

  resumeOnlineRoom() {
    const saved = this.loadOnlineRoomRef();
    if (!saved) {
      this.goOnlineMenu();
      return;
    }
    this.onlineError = null;
    this.onlineBusy = true;
    this.render();
    this.loadFirebaseModules()
      .then(() => window.Room.joinRoom({ roomCode: saved.roomCode, nickname: saved.nickname }))
      .then(({ roomCode, uid }) => this.enterOnlineRoom(roomCode, uid, saved.nickname))
      .catch((err) => this.handleOnlineError(err));
  },

  saveOnlineRoomRef() {
    if (!this.online) return;
    try {
      localStorage.setItem(
        ONLINE_ROOM_KEY,
        JSON.stringify({ roomCode: this.online.roomCode, nickname: this.online.nickname })
      );
    } catch (e) {
      // 保存できなくても致命的ではないので無視
    }
  },

  loadOnlineRoomRef() {
    try {
      return JSON.parse(localStorage.getItem(ONLINE_ROOM_KEY));
    } catch (e) {
      return null;
    }
  },

  clearOnlineRoomRef() {
    localStorage.removeItem(ONLINE_ROOM_KEY);
  },

  handleOnlineError(err) {
    this.onlineBusy = false;
    this.onlineError = (err && err.message) || "通信エラーが発生しました";
    this.render();
  },

  enterOnlineRoom(roomCode, uid, nickname) {
    this.onlineBusy = false;
    this.online = {
      roomCode,
      uid,
      nickname,
      room: null,
      unsubscribe: null,
      log: [{ type: "info", text: "部屋に接続しました" }],
      localTurnState: null,
      reveal: null,
      rewardGranted: false,
      lastReward: null,
      turnPopup: null,
      lastTurnUid: null,
      drivingCPU: false, // CPUの手番進行(ホストのみ)の二重発火防止フラグ
      knownPositions: {}, // playerId -> 直近の位置。他プレイヤーの移動をリモート検知してホップ演出するための記録
      remoteHoppingIds: new Set(), // 現在リモート追いつきホップ演出中のplayerId(二重発火防止)
      remoteFocusPlayerId: null, // リモート追いつき演出中、カメラをそのプレイヤーへ向けるための対象id
    };
    this.hub = { view: "menu", spinNumber: null, itemMessage: null };
    this.saveOnlineRoomRef();
    this.screen = "online-lobby";
    this.render();
    this.online.unsubscribe = window.Room.subscribeRoom(roomCode, (room) => {
      if (!this.online) return;
      this.online.room = room;
      this.syncRemotePositions(room);
      // 自分の手番結果を楽観表示中の場合、サーバーが確定させたのを確認できたら
      // 以後はサーバー状態(room)をそのまま使う。就職選択待ち(pendingChoice)の間は
      // 他の参加者のハートビート更新等で誤って消さないよう保持し続ける。
      if (this.online.localTurnState && !this.online.localTurnState.pendingChoice) {
        const stillMyTurn = room.status === "playing" && room.currentTurnPlayerUid === this.online.uid;
        if (!stillMyTurn) this.online.localTurnState = null;
      }
      this.syncOnlineScreen();
    });
    this.startHeartbeat();
  },

  startHeartbeat() {
    this.stopHeartbeat();
    this.heartbeatTimer = setInterval(() => {
      if (this.online && this.online.roomCode && this.online.uid) {
        window.Room.sendHeartbeat(this.online.roomCode, this.online.uid).catch(() => {});
      }
    }, HEARTBEAT_INTERVAL_MS);
  },

  stopHeartbeat() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  },

  syncOnlineScreen() {
    if (!this.online || !this.online.room) return;
    const status = this.online.room.status;
    if (status === "lobby") {
      this.screen = "online-lobby";
    } else if (status === "playing") {
      this.screen = "online-game";
      // 手番プレイヤーが切り替わったら(Firestoreの同期経由で他人の手番開始も含む)、
      // アバター+名前のポップアップを一瞬出す
      const turnUid = this.online.room.currentTurnPlayerUid;
      if (turnUid && turnUid !== this.online.lastTurnUid) {
        this.online.lastTurnUid = turnUid;
        const state = roomToEngineState(this.online.room);
        const turnPlayer = state.players.find((p) => p.id === turnUid);
        if (turnPlayer) this.showOnlineTurnPopup(turnPlayer);
      }
    } else if (status === "finished") {
      this.screen = "online-result";
      this.stopHeartbeat();
      if (!this.online.rewardGranted) {
        this.online.rewardGranted = true;
        const state = roomToEngineState(this.online.room);
        const me = state.players.find((p) => p.id === this.online.uid);
        const ranking = getRanking(state);
        const isFirstPlace = !!(ranking[0] && ranking[0].id === this.online.uid);
        this.online.lastReward = this.grantGameReward(me ? me.money : 0, isFirstPlace);
        LifeRoadAudio.playBgmJingle("goal");
      }
    }
    this.maybeRunOnlineCPUTurn();
    this.render();
  },

  startOnlineGame() {
    if (!this.online || !this.online.room) return;
    window.Room.startGame(this.online.roomCode, this.online.room).catch((err) => this.handleOnlineError(err));
  },

  handleOnlineRoll(roll) {
    if (!this.online || !this.online.room) return;
    const room = this.online.room;
    if (room.status !== "playing" || room.currentTurnPlayerUid !== this.online.uid) return;

    const localState = this.online.localTurnState || roomToEngineState(room);
    const actualRoll = typeof roll === "number" ? roll : rollDice();
    const turnPlayer = currentPlayer(localState);
    const playerId = turnPlayer.id;
    const fromPos = turnPlayer.position;
    const result = applyRoll(localState, actualRoll);
    const toPos = turnPlayer.position;

    // 楽観的に自分の画面だけ即時反映する(サーバー確定はonSnapshotで後追い)
    this.online.localTurnState = localState;

    this.runHopSteps(playerId, fromPos, toPos, () => {
      this.pushOnlineLog(result.entries);
      this.showMoneyToasts(result.entries, playerId, localState.players);
      if (!result.pendingChoice && result.reveal) {
        // choice以外のマスもテロップ枠で見せる。オンラインはターン確定(Firestore書き込み)を
        // 待たせない設計を維持するため、表示と同時にcommitOnlineTurnも呼ぶ(dismissは見た目のみ)
        this.online.reveal = { ...result.reveal, visual: turnPlayer.avatar || { color: turnPlayer.color, speciesEmoji: null, costumeImage: null } };
      }
      this.render();
      if (result.pendingChoice) return;
      this.commitOnlineTurn(localState);
    });
  },

  chooseOnlineOption(optionIndex) {
    if (!this.online || !this.online.localTurnState) return;
    LifeRoadAudio.playSe("confirm");
    const localState = this.online.localTurnState;
    const player = localState.players.find((p) => p.id === localState.pendingChoice.playerId);
    const result = resolveChoice(localState, localState.pendingChoice.playerId, optionIndex);
    this.pushOnlineLog(result.entries);
    // pendingChoiceが外れた状態を引き続き楽観表示し、確定はonSnapshotで後追いする
    this.online.localTurnState = localState;
    this.online.reveal = { ...result.reveal, visual: player.avatar || { color: player.color, speciesEmoji: null, costumeImage: null } };
    this.commitOnlineTurn(localState);
  },

  dismissOnlineReveal() {
    if (!this.online || !this.online.reveal) return;
    this.online.reveal = null;
    this.render();
  },

  commitOnlineTurn(localState) {
    const patch = engineStateToRoomPatch(localState, this.online.room);
    this.render();
    window.Room.writeTurnResult(this.online.roomCode, patch).catch((err) => this.handleOnlineError(err));
  },

  // CPUの手番はサインインしたユーザーがいないため、ホストのブラウザだけが代わりに進める
  // (firestore.rulesのisTurnUpdate側でもホスト以外からの書き込みは拒否される)。
  isAuthorizedToDriveCPU() {
    return !!(this.online && this.online.room && this.online.uid === this.online.room.hostUid);
  },

  // オンライン対戦でCPUの手番になったら、一人プレイのmaybeRunCPUTurn/commitCPURoll/
  // runCPUChoiceと同じ流れでロール・選択を自動進行し、結果をcommitOnlineTurnで書き込む。
  // syncOnlineScreen()(Firestoreの部屋更新のたびに呼ばれる)から毎回呼ばれる。
  // forcedStateを渡すのは、pendingChoice発生時に自分自身を継続呼び出しする場合のみ
  // (このときはガード判定を再実行せず、そのまま処理を続ける)。
  maybeRunOnlineCPUTurn(forcedState) {
    if (!this.online || !this.online.room || this.online.room.status !== "playing") return;
    if (!this.isAuthorizedToDriveCPU()) return;

    let localState = forcedState;
    if (!localState) {
      // 二重発火防止に加え、自分(人間)の手番がまだFirestoreへ確定していない間
      // (ホップ中・楽観表示中)はCPUの手番判定に割り込まない。localTurnStateは
      // 人間の手番の楽観状態と共有しているため、ここで読むと競合してしまう
      // (人間が手番中に別イベントでsyncOnlineScreenが再発火し、その途中経過を
      // 誤ってCPUの手番として処理してしまう不具合があったため、この分岐にした)。
      if (this.online.drivingCPU || this.hopping || this.online.localTurnState) return;
      const room = this.online.room;
      const turnPlayerDoc = room.players[room.currentTurnPlayerUid];
      if (!turnPlayerDoc || !turnPlayerDoc.isCPU) return;
      localState = roomToEngineState(room);
    }

    if (localState.pendingChoice) {
      const choosingPlayer = localState.players.find((p) => p.id === localState.pendingChoice.playerId);
      if (!choosingPlayer || !choosingPlayer.isCPU) return;
      this.online.drivingCPU = true;
      setTimeout(() => {
        if (!this.online) return;
        const idx = cpuDecideOption(localState.pendingChoice, choosingPlayer.personality);
        const result = resolveChoice(localState, localState.pendingChoice.playerId, idx);
        this.pushOnlineLog(result.entries);
        this.online.reveal = {
          ...result.reveal,
          visual: choosingPlayer.avatar || { color: choosingPlayer.color, speciesEmoji: null, costumeImage: null },
          interactive: false,
        };
        this.render();
        setTimeout(() => {
          this.online.drivingCPU = false;
          if (!this.online) return;
          this.online.reveal = null;
          this.commitOnlineTurn(localState);
        }, CPU_REVEAL_MS);
      }, CPU_PRE_CHOICE_MS);
      return;
    }

    const turnPlayer = currentPlayer(localState);
    if (!turnPlayer || !turnPlayer.isCPU) return;
    this.online.drivingCPU = true;
    setTimeout(() => {
      if (!this.online) return;
      this.runRouletteAnimation((roll) => {
        if (!this.online) return;
        const playerId = turnPlayer.id;
        const fromPos = turnPlayer.position;
        const result = applyRoll(localState, roll);
        const toPos = turnPlayer.position;
        // 自分(ホスト)がこの後すぐアニメーションさせるため、syncRemotePositions側の
        // リモート追いつき演出が二重発火しないよう先に基準位置を更新しておく。
        if (this.online) this.online.knownPositions[playerId] = toPos;
        this.runHopSteps(playerId, fromPos, toPos, () => {
          if (!this.online) return;
          this.pushOnlineLog(result.entries);
          this.showMoneyToasts(result.entries, playerId, localState.players);
          if (!result.pendingChoice && result.reveal) {
            this.online.reveal = {
              ...result.reveal,
              visual: turnPlayer.avatar || { color: turnPlayer.color, speciesEmoji: null, costumeImage: null },
              interactive: false,
            };
            this.render();
            setTimeout(() => {
              this.online.drivingCPU = false;
              if (!this.online) return;
              this.online.reveal = null;
              this.commitOnlineTurn(localState);
            }, CPU_REVEAL_MS);
            return;
          }
          this.online.drivingCPU = false;
          this.render();
          if (result.pendingChoice) {
            this.maybeRunOnlineCPUTurn(localState);
            return;
          }
          this.commitOnlineTurn(localState);
        });
      });
    }, CPU_PRE_ROLL_MS);
  },

  pushOnlineLog(entries) {
    if (!this.online) return;
    this.online.log = [...entries].reverse().concat(this.online.log).slice(0, 100);
  },

  leaveOnlineRoom() {
    this.clearOnlineRoomRef();
    this.teardownOnline();
    this.mode = "solo";
    this.goTitle();
  },

  teardownOnline() {
    this.stopHeartbeat();
    if (this.online && this.online.unsubscribe) {
      this.online.unsubscribe();
    }
    this.online = null;
  },

  render() {
    const view = document.getElementById("view");
    if (this.screen === "title") {
      view.innerHTML = renderTitleScreen(this.hasSave(), LifeRoadProfile.loadProfile());
    } else if (this.screen === "profile") {
      view.innerHTML = renderProfileScreen(LifeRoadProfile.loadProfile());
    } else if (this.screen === "shop") {
      view.innerHTML = renderShopScreen(LifeRoadProfile.loadProfile(), this.shopToast);
    } else if (this.screen === "settings") {
      view.innerHTML = renderSettingsScreen(LifeRoadAudio.loadAudioSettings());
    } else if (this.screen === "help") {
      view.innerHTML = renderHelpScreen();
    } else if (this.screen === "stats") {
      view.innerHTML = renderStatsScreen(LifeRoadProfile.loadProfile());
    } else if (this.screen === "setup") {
      view.innerHTML = renderSetupScreen();
    } else if (this.screen === "game") {
      view.innerHTML = renderGameScreen(this.state, this.log, this.humanId, "solo", LifeRoadProfile.loadProfile(), this.hub, this.reveal, this.logOpen, this.hopping, this.turnPopup, this.statusPeekOpen, this.moneyToasts, this.pauseMenuOpen);
    } else if (this.screen === "result") {
      view.innerHTML = renderResultScreen(this.state, "solo", this.lastReward);
    } else if (this.screen === "online-menu") {
      view.innerHTML = renderOnlineMenuScreen(this.onlineError, this.onlineBusy, this.loadOnlineRoomRef());
    } else if (this.screen === "online-lobby" && this.online && this.online.room) {
      view.innerHTML = renderOnlineLobbyScreen(this.online.room, this.online.roomCode, this.online.uid);
    } else if (this.screen === "online-game" && this.online && this.online.room) {
      const baseState = roomToEngineState(this.online.room);
      const displayState = this.online.localTurnState || baseState;
      view.innerHTML = renderGameScreen(displayState, this.online.log, this.online.uid, "online", LifeRoadProfile.loadProfile(), this.hub, this.online.reveal, this.logOpen, this.hopping, this.online.turnPopup, this.statusPeekOpen, this.moneyToasts, this.pauseMenuOpen);
    } else if (this.screen === "online-result" && this.online && this.online.room) {
      const state = roomToEngineState(this.online.room);
      view.innerHTML = renderResultScreen(state, "online", this.online.lastReward);
    } else if (this.screen === "snack-setup") {
      view.innerHTML = renderSnackSetupScreen();
    } else if (this.screen === "snack-game" && this.snack) {
      view.innerHTML = renderSnackGameScreen(this.snack, this.snackHumanId, this.pauseMenuOpen);
    } else if (this.screen === "snack-result" && this.snack) {
      view.innerHTML = renderSnackResultScreen(this.snack.state, this.snackHumanId, this.snack.resultReveal);
    }
    this.sync3DBoard();
    this.syncHeader();
  },

  // ヘッダーの「アニマルライフ」文字を、ゲーム画面の間だけ手番表示に差し替える
  // (headerは#viewの外にある常設要素のため、render()のinnerHTML置き換えとは別に直接更新する)。
  syncHeader() {
    const titleEl = document.getElementById("app-header-title");
    if (!titleEl) return;
    let state = null;
    if (this.screen === "game") {
      state = this.state;
    } else if (this.screen === "online-game" && this.online && this.online.room) {
      state = this.online.localTurnState || roomToEngineState(this.online.room);
    } else if (this.screen === "snack-game" && this.snack) {
      state = this.snack.state;
    }
    titleEl.innerHTML = state ? renderHeaderTurnContent(state, this.hoppingPlayerId) : "アニマルライフ";
    const pauseBtn = document.getElementById("app-header-pause");
    if (pauseBtn) pauseBtn.style.display = state ? "" : "none";
  },

  // 3D盤面(board3d.js)を、現在の画面がgame/online-gameかどうかに応じてマウント/破棄し、
  // マウント中は現在のプレイヤー位置・手番へ同期する(renderのたびに呼ばれる軽量な処理)。
  sync3DBoard() {
    const isGameScreen = this.screen === "game" || this.screen === "online-game";
    const isSnackGameScreen = this.screen === "snack-game" && !!this.snack;
    const dock = document.getElementById("board3d-overlay");

    // 画面遷移で使わなくなった側の3D盤面(本編/おやつ集め)は都度dispose()する
    // (両方を同時にマウントしたままにしない。同じ#board3d-canvasを共用するため)。
    if (!isGameScreen && this.board3dMounted && window.LifeRoadBoard3D) {
      window.LifeRoadBoard3D.dispose();
      this.board3dMounted = false;
    }
    if (!isSnackGameScreen && this.snackBoard3dMounted && window.LifeRoadSnackBoard3D) {
      window.LifeRoadSnackBoard3D.dispose();
      this.snackBoard3dMounted = false;
    }

    if (!isGameScreen && !isSnackGameScreen) {
      if (dock) dock.classList.remove("is-active");
      return;
    }
    if (dock) dock.classList.add("is-active");

    if (isSnackGameScreen) {
      this.syncSnackBoard3D();
      return;
    }

    let state = null;
    if (this.mode === "online") {
      if (!this.online || !this.online.room) return;
      state = this.online.localTurnState || roomToEngineState(this.online.room);
    } else {
      state = this.state;
    }
    if (!state || !state.players[state.currentTurnIndex]) return;

    // 初回mount()自体が(動的import待ちで)非同期のため、1ターン目に素早くルーレットを押すと
    // 「mountがまだ済んでいない間にホップが始まる」競合が起こりうる。mount()内部の初期フォーカスは
    // 呼び出し時点のcurrentTurnIndexしか見ないため、mount直後にも下のfocusCameraで
    // hoppingPlayerId優先の対象へ必ず合わせ直す(2ターン目以降は既にmount済みなのでこの経路は通らない)。
    // オンラインでは、自分が操作していない他プレイヤーの移動をリモートで追いつき演出中
    // (syncRemotePositions参照)の間は、そのプレイヤーへカメラを向ける(次の手番プレイヤーの
    // 静止画へ先に切り替わってしまい、動いている本人を映せない不具合を防ぐため)。
    const remoteFocusId = this.mode === "online" && this.online ? this.online.remoteFocusPlayerId : null;
    const focusId = this.hoppingPlayerId || remoteFocusId || state.players[state.currentTurnIndex].id;
    this.loadBoard3DModules()
      .then(() => {
        // 非同期読み込み完了までの間に画面遷移していたら何もしない
        if (this.screen !== "game" && this.screen !== "online-game") return;
        if (!this.board3dMounted) {
          window.LifeRoadBoard3D.mount(document.getElementById("board3d-canvas"), {
            squareCount: BOARD_SQUARES.length,
            squareTypes: BOARD_SQUARES.map((s) => s.type),
            stockTriggerIndexes: STOCK_TRIGGER_INDEXES,
            players: state.players,
            currentTurnIndex: state.currentTurnIndex,
          });
          this.board3dMounted = true;
        } else {
          window.LifeRoadBoard3D.syncPlayers(state.players);
        }
        window.LifeRoadBoard3D.focusCamera(focusId);
      })
      .catch((err) => {
        console.error("3D盤面の読み込みに失敗", err);
      });
  },

  // おやつ集めモード用3D盤面のmount()が「一度だけ」実行されることを保証する共有Promise。
  // 2026-08-12: render()を短時間に連続で呼ぶ場面(ゲーム開始直後、MAP_INTRO演出開始のため
  // すぐにもう一度render()する等)が増えたため、初回mount()完了前に複数回syncSnackBoard3D()が
  // 呼ばれ、それぞれが独立に「まだマウントされていない」と判断してmount()を多重にキューイング
  // してしまう競合が発生した(mount()はcameraMode等を毎回リセットするため、マップ紹介演出の
  // 最中に別のmount()が割り込むとカメラ演出が即座に壊れる不具合があった)。
  // さらに、playSnackMapIntro()が独自にloadSnackBoard3DModules()だけを待って
  // playMapIntro()を呼んでいたため、mount()未完了(camera/scene未生成)のままplayMapIntro()が
  // 呼ばれて即座に終了してしまう(=マップ紹介がスキップされたように見える)別の競合もあった。
  // syncSnackBoard3D()とplaySnackMapIntro()の両方がこの同じPromiseを共有して待つことで、
  // 「mount()が確実に一度だけ・完了してから次に進む」ことを保証する。
  ensureSnackBoard3DMounted() {
    if (this.snackBoard3dMounted) return Promise.resolve();
    if (this._snackBoard3dMountPromise) return this._snackBoard3dMountPromise;
    const snack = this.snack.state;
    this._snackBoard3dMountPromise = this.loadSnackBoard3DModules()
      .then(() => {
        // 非同期読み込み完了までの間に画面遷移していたら何もしない
        if (this.screen !== "snack-game" || !this.snack) return;
        if (!this.snackBoard3dMounted) {
          window.LifeRoadSnackBoard3D.mount(document.getElementById("board3d-canvas"), {
            nodes: SNACK_STAGE_NODES,
            players: snack.players,
            currentTurnIndex: snack.currentTurnIndex,
            activeSnackNodeIds: snack.activeSnackNodeIds,
          });
          this.snackBoard3dMounted = true;
        }
      })
      .catch((err) => {
        console.error("おやつ集めモード3D盤面の読み込みに失敗", err);
      })
      .then(() => {
        this._snackBoard3dMountPromise = null;
      });
    return this._snackBoard3dMountPromise;
  },

  // おやつ集めモード用3D盤面の同期(sync3DBoard()から画面がsnack-gameのときだけ呼ばれる)。
  syncSnackBoard3D() {
    const snack = this.snack.state;
    const player = snack.players[snack.currentTurnIndex];
    if (!player) return;
    const focusId = player.id;
    this.ensureSnackBoard3DMounted().then(() => {
      if (this.screen !== "snack-game" || !this.snack || !this.snackBoard3dMounted) return;
      window.LifeRoadSnackBoard3D.syncPlayers(snack.players, snack.activeSnackNodeIds);
      window.LifeRoadSnackBoard3D.focusCamera(focusId);
    });
  },

  // ==================== おやつ集めモード ====================
  // 既存の人生ゲームモード(this.state等)とは完全に別の状態(this.snack)で管理する。
  // 保存タイミングは、Codexレビュー対応で見つけたバグ(reveal表示中に保存が遅れて中断時に
  // 巻き戻る)と同じ設計ミスを避けるため、state変更の直後に必ずsaveSnackGame()する。
  //
  // 2026-08-12(統合仕様書対応): 従来のthis.snack.hub(view: menu/spinning/items/shop の
  // 4値のみのadhocな状態)を廃止し、this.snack.phaseによる明示的な状態マシンへ作り直した。
  // 人間の手番は必ずPLAYER_INTRO→TURN_MENUを経由し、TURN_MENUは人間が「サイコロを振る」を
  // 押すまでROLLINGへ遷移しない(CPUのみCPU_TURNから自動でロールへ進む)。この設計により、
  // 「次の人間ターンで自動的にサイコロ演出が走って止まる」という不具合のクラスが構造的に
  // 起こらなくなる(以前はCPU側のhub.viewリセット漏れという個別バグとしてパッチしていたが、
  // 今回は状態マシンの設計そのもので再発を防ぐ)。
  //
  // phaseの一覧: MAP_INTRO, ORDER_ROLL, ORDER_TIE_ROLL, ORDER_RESULT, ROUND_INTRO,
  // PLAYER_INTRO, TURN_MENU, ITEM_SELECT, ITEM_CONFIRM, SHOP_SELECT, ROLLING,
  // ROUTE_SELECT, SNACK_PURCHASE_CONFIRM, STOP_CHOICE, MOVING, ACTION_RESULT,
  // NEXT_ACTION, MAP_OVERVIEW, MAP_ZOOM, CPU_TURN, GAME_RESULT

  hasSnackSave() {
    return !!localStorage.getItem(SNACK_SAVE_KEY);
  },

  goSnackSetup() {
    this.screen = "snack-setup";
    this.render();
  },

  startSnackGame() {
    const nicknameInput = document.getElementById("snack-nickname-input");
    const cpuSelect = document.getElementById("snack-cpu-count-select");
    const nickname = ((nicknameInput && nicknameInput.value) || "プレイヤー").trim().slice(0, 10) || "プレイヤー";
    const cpuCount = parseInt((cpuSelect && cpuSelect.value) || "1", 10);
    const profile = LifeRoadProfile.loadProfile();
    const humanAvatar = LifeRoadProfile.getAvatarVisual(profile.equipped);
    const configs = [{ id: "human", name: nickname, isCPU: false, avatar: humanAvatar }];
    for (let i = 1; i <= cpuCount; i++) {
      const species = SPECIES_ITEMS[Math.floor(Math.random() * SPECIES_ITEMS.length)];
      configs.push({
        id: `cpu${i}`,
        name: `CPU${i}`,
        isCPU: true,
        personality: LifeRoadCPU.pickRandomPersonality(),
        avatar: { color: TOKEN_COLORS[i % TOKEN_COLORS.length], speciesId: species.id, speciesEmoji: species.emoji, costumeImage: null },
      });
    }
    this.snackHumanId = "human";
    snackSpeedScale = SNACK_SPEED_SCALES[loadSnackSpeedSetting()];
    this.snack = this.createSnackUiState(createSnackState(configs), [{ type: "info", text: "おやつ集めモード開始！" }]);
    this.snack.phase = "MAP_INTRO";
    this.screen = "snack-game";
    this.saveSnackGame();
    this.render();
    this.playSnackMapIntro();
  },

  continueSnackGame() {
    const saved = this.loadSnackSave();
    if (!saved) {
      this.goTitle();
      return;
    }
    this.snackHumanId = saved.humanId;
    snackSpeedScale = SNACK_SPEED_SCALES[loadSnackSpeedSetting()];
    const migratedState = migrateSnackSaveState(saved.state);
    reapplySnackNodeMutations(migratedState);
    this.snack = this.createSnackUiState(migratedState, saved.log);
    this.screen = "snack-game";
    this.snack.phase = this.computeResumeSnackPhase();
    this.render();
    if (this.snack.phase === "ORDER_ROLL") {
      this.startSnackOrderRoll();
    } else if (this.snack.phase === "CPU_TURN") {
      this.maybeRunSnackCPUTurn();
    } else if (this.snack.phase === "GABURION_INTRO") {
      this.beginSnackGaburionSequence(currentSnackPlayer(this.snack.state));
    }
  },

  // this.snackのUI側(演出・ポップアップ)フィールドをまとめて初期化する。
  // phase以外はセーブ対象外(saveSnackGameは{state,log,humanId}のみ保存し、phaseは
  // 再開のたびcomputeResumeSnackPhase()で安全な入力待ち状態へ正規化する、仕様15章)。
  createSnackUiState(state, log) {
    return {
      state,
      log,
      phase: "TURN_MENU",
      logOpen: false,
      returnPhase: null,
      lastActionActor: null,
      lastActionEntries: [],
      orderRoll: null,
      playerIntro: null,
      roundIntro: null,
      pendingItemId: null,
      speed: loadSnackSpeedSetting(),
      remainingSteps: null, // MOVING中のみ数値({playerId, total, done})、それ以外はnull
      reveal: null, // SNACK_REVEAL中のみ{nodeId, ringLabel, zoneLabel, price}
      cpuReason: null, // 直近のCPU判断理由(仕様書14章)。CPU_TURNオーバーレイの吹き出しに使う
      resultReveal: null, // 最終結果画面のみ{stage}。finishSnackGame()で作られる
      prevRankById: null, // 直前の順位スナップショット(Map<playerId, rankIndex>)。セーブ非対象の演出用一時状態
      rankChangeFx: null, // 直近の順位変動({changes:[...], id})。一定時間後にnullへ戻る
      finalThreeReveal: null, // FINAL_THREE_TRANSFORM中のみ{changes, index}
      lastGaburionEntries: null, // GABURION_RESULT/APPLY中のみ、直近の抽選結果entries
    };
  },

  // 演出速度設定(標準/はやい/最速)を変更する。ポーズメニューから呼ばれる。
  setSnackSpeed(speed) {
    if (!SNACK_SPEED_SCALES[speed] || !this.snack) return;
    this.snack.speed = speed;
    snackSpeedScale = SNACK_SPEED_SCALES[speed];
    saveSnackSpeedSetting(speed);
    this.render();
  },

  // 振動オン/オフ設定を変更する。ポーズメニューから呼ばれる(audio.jsの既存設定オブジェクトに
  // vibrationOnとして相乗り保存する)。
  setSnackVibration(on) {
    const settings = LifeRoadAudio.loadAudioSettings();
    settings.vibrationOn = !!on;
    LifeRoadAudio.saveAudioSettings(settings);
    this.render();
  },

  // 演出中(MAP_INTRO/ORDER_ROLL系/ROLLING/MOVING等)にリロードされた場合でも、
  // 決定済みデータ(turnOrderDecided/pending*/turnRolled)だけを見て直近の安全な
  // 入力待ちphaseへ正規化する。順番決め未確定ならORDER_ROLLからやり直す(仕様6章)。
  computeResumeSnackPhase() {
    const state = this.snack.state;
    if (!state.turnOrderDecided) return "ORDER_ROLL";
    const player = currentSnackPlayer(state);
    if (state.pendingGaburion || (state.gaburion && !state.gaburion.resolved && state.gaburion.actorId)) {
      return "GABURION_INTRO";
    }
    if (state.pendingBranch) return player.isCPU ? "CPU_TURN" : "ROUTE_SELECT";
    if (state.pendingSnackChoice) return player.isCPU ? "CPU_TURN" : "SNACK_PURCHASE_CONFIRM";
    if (state.pendingStopChoice) return player.isCPU ? "CPU_TURN" : "STOP_CHOICE";
    if (player.isCPU) return "CPU_TURN";
    return player.turnRolled ? "NEXT_ACTION" : "TURN_MENU";
  },

  pushSnackLog(entries) {
    this.snack.log = [...entries].reverse().concat(this.snack.log).slice(0, 100);
  },

  saveSnackGame() {
    try {
      localStorage.setItem(SNACK_SAVE_KEY, JSON.stringify({ state: this.snack.state, log: this.snack.log, humanId: this.snackHumanId }));
    } catch (e) {
      // 保存容量オーバー等は無視(オートセーブは補助機能のため)
    }
  },

  loadSnackSave() {
    try {
      return JSON.parse(localStorage.getItem(SNACK_SAVE_KEY));
    } catch (e) {
      return null;
    }
  },

  clearSnackSave() {
    localStorage.removeItem(SNACK_SAVE_KEY);
  },

  snackToggleLog() {
    this.snack.logOpen = !this.snack.logOpen;
    LifeRoadAudio.playSe(this.snack.logOpen ? "modalOpen" : "modalClose");
    this.render();
  },

  // ==================== マップ紹介フライスルー ====================

  async playSnackMapIntro() {
    this.snack.phase = "MAP_INTRO";
    this.render();
    try {
      await this.ensureSnackBoard3DMounted();
      if (window.LifeRoadSnackBoard3D && window.LifeRoadSnackBoard3D.playMapIntro) {
        const intro = window.LifeRoadSnackBoard3D.playMapIntro();
        this._snackIntroSkip = intro.requestSkip;
        await intro.finished;
        this._snackIntroSkip = null;
      }
    } catch (err) {
      console.error("おやつ集めモード: マップ紹介の再生に失敗", err);
    }
    this.snack.state.mapIntroDone = true;
    this.saveSnackGame();
    // await せずfire-and-forgetで呼ぶ(下のplaySnackReveal自身がstartSnackOrderRoll()まで
    // 責任を持つ。ここでawaitしてから続けて呼ぶと、途中でsnackSkipReveal()がタップされた
    // 場合にstartSnackOrderRoll()が二重に走ってしまう=beginSnackRound等と同じ
    // 「setTimeout+トークン確認」パターンを踏襲するための設計)。
    this.playSnackReveal();
  },

  snackSkipMapIntro() {
    if (this._snackIntroSkip) this._snackIntroSkip();
  },

  // 初回出現時のおやつ紹介演出(仕様書14章SNACK_REVEAL)。ゲーム開始時に1回だけ、
  // マップ紹介フライスルーの直後・行動順決めサイコロの前に挟む。取得後の再配置紹介は
  // CPU手番も含め呼び出し箇所が増えて演出が頻発しすぎるため、今回のフェーズでは対象外
  // (毎ターンのテンポを優先し、初回オリエンテーションのみに絞った)。
  // 呼び出し完了後のstartSnackOrderRoll()まで自分で面倒を見る(snackSkipReveal()から
  // 直接呼ばれた場合との二重呼び出しを避けるため、下のトークン確認を必ず通す)。
  async playSnackReveal() {
    // 同時出現数が2以上でも、初回オリエンテーション演出は従来どおり1箇所だけ紹介する
    // (複数箇所を続けて飛び回るとテンポが悪化するため、代表として先頭の1個に絞る)。
    const node = findSnackNode(this.snack.state.activeSnackNodeIds[0]);
    if (!node) {
      this.startSnackOrderRoll();
      return;
    }
    this.snack.reveal = {
      nodeId: node.id,
      ringLabel: node.zone === "outer" ? "外周" : "内周",
      zoneLabel: node.buildingZone ? SNACK_ZONE_LABELS[node.buildingZone] || "" : "",
      price: SNACK_SNACK_PRICE,
    };
    this.snack.phase = "SNACK_REVEAL";
    this.render();
    if (this.snackBoard3dMounted && window.LifeRoadSnackBoard3D) {
      // 2026-08-16、以前はおやつ地点だけの近距離周回で、地図上のどこか・現在地からの距離感が
      // 伝わらないという指摘を受け、全プレイヤーの現在地(ゲーム開始直後なのでスタート地点)も
      // 一緒に画面へ収めるカメラへ変更(snack-board3d.js側のupdateSnackRevealCamera参照)。
      const contextIds = this.snack.state.players.map((p) => p.id);
      window.LifeRoadSnackBoard3D.enterSnackReveal(node.id, contextIds);
    }
    const token = (this._snackFlowToken = (this._snackFlowToken || 0) + 1);
    await snackDelay(3000);
    if (this._snackFlowToken !== token) return;
    if (window.LifeRoadSnackBoard3D) window.LifeRoadSnackBoard3D.exitSnackReveal();
    this.snack.reveal = null;
    this.startSnackOrderRoll();
  },

  // 購入で新しく出現したおやつの場所を、全プレイヤーの現在地と一緒に一瞬だけ見せる
  // (2026-08-16、「獲得後におやつが移動した時も位置関係がわかるように」との指摘で追加)。
  // 初回オリエンテーション(playSnackReveal)と同じenterSnackReveal/exitSnackRevealを使うが、
  // こちらは毎回の購入で起きるため専用のポップアップ・スキップ操作は設けず短い時間だけ流す。
  async revealNewSnackSpotIfAny(newSnackNodeId) {
    if (!newSnackNodeId || !this.snackBoard3dMounted || !window.LifeRoadSnackBoard3D) return;
    const contextIds = this.snack.state.players.map((p) => p.id);
    window.LifeRoadSnackBoard3D.enterSnackReveal(newSnackNodeId, contextIds);
    const token = (this._snackFlowToken = (this._snackFlowToken || 0) + 1);
    await snackDelay(1400);
    if (this._snackFlowToken !== token) return;
    if (window.LifeRoadSnackBoard3D) window.LifeRoadSnackBoard3D.exitSnackReveal();
  },

  snackSkipReveal() {
    if (this.snack.phase !== "SNACK_REVEAL") return;
    this._snackFlowToken = (this._snackFlowToken || 0) + 1;
    if (window.LifeRoadSnackBoard3D) window.LifeRoadSnackBoard3D.exitSnackReveal();
    this.snack.reveal = null;
    this.startSnackOrderRoll();
  },

  // ==================== 行動順決めサイコロ ====================

  startSnackOrderRoll() {
    const ids = this.snack.state.players.map((p) => p.id);
    this.runSnackOrderRollGroup(ids, false).then((order) => {
      if (this.snackBoard3dMounted && window.LifeRoadSnackBoard3D) window.LifeRoadSnackBoard3D.exitOrderLineup();
      this.snack.phase = "ORDER_RESULT";
      this.snack.orderRoll = { finalOrder: order };
      this.render();
      const token = (this._snackFlowToken = (this._snackFlowToken || 0) + 1);
      snackDelay(1800).then(() => {
        if (this._snackFlowToken !== token) return;
        finalizeSnackTurnOrder(this.snack.state, order);
        this.saveSnackGame();
        this.beginSnackRound();
      });
    });
  },

  // idsグループ内の全員が1個ずつサイコロを振り(人間はタップ待ち、CPUは自動)、
  // 同点者だけを再帰的に再抽選する(同点の中でさらに同点が出ても正しく解決する)。
  // 対象プレイヤーは3D側で横一列に並べて正面を向かせ(enterOrderLineup)、頭上のサイコロ演出
  // (recordSnackOrderRoll内のplayDiceRoll)を1人ずつ順番に見せる(2026-08-16、利用者指示
  // 「キャラクターが横一列に並び正面を向いている状態で、頭上でサイコロが回ってジャンプして
  // 止める演出」対応。同点再抽選では対象が絞られるため、再度呼ぶだけで自動的に並び直る)。
  async runSnackOrderRollGroup(ids, isTie) {
    this.snack.phase = isTie ? "ORDER_TIE_ROLL" : "ORDER_ROLL";
    this.snack.orderRoll = { ids, rolls: {}, isTie };
    this.render();
    if (this.snackBoard3dMounted && window.LifeRoadSnackBoard3D) window.LifeRoadSnackBoard3D.enterOrderLineup(ids);
    for (const id of ids) {
      const player = this.snack.state.players.find((p) => p.id === id);
      if (player.id === this.snackHumanId) {
        await this.waitForSnackOrderRollTap(id);
      } else {
        await snackDelay(500);
        await this.recordSnackOrderRoll(id, rollSnackDice());
        this.render();
      }
    }
    const byValue = new Map();
    ids.forEach((id) => {
      const v = this.snack.orderRoll.rolls[id];
      if (!byValue.has(v)) byValue.set(v, []);
      byValue.get(v).push(id);
    });
    const sortedValues = [...byValue.keys()].sort((a, b) => b - a);
    let order = [];
    for (const v of sortedValues) {
      const group = byValue.get(v);
      if (group.length === 1) {
        order.push(group[0]);
      } else {
        const subOrder = await this.runSnackOrderRollGroup(group, true);
        order = order.concat(subOrder);
      }
    }
    return order;
  },

  waitForSnackOrderRollTap(id) {
    return new Promise((resolve) => {
      this._snackOrderRollResolve = async () => {
        this._snackOrderRollResolve = null;
        await this.recordSnackOrderRoll(id, rollSnackDice());
        this.render();
        resolve();
      };
    });
  },

  snackRollForOrder() {
    if (this._snackOrderRollResolve) this._snackOrderRollResolve();
  },

  // 3D演出がマウント済みならplayDiceRoll(頭上で回転→ジャンプして停止)を再生し終わるまで待つ。
  // 未マウント時は従来通り固定ウェイトのみで進める(フォールバック)。
  recordSnackOrderRoll(id, value) {
    this.snack.orderRoll.rolls[id] = value;
    LifeRoadAudio.playSe("diceRoll");
    if (this.snackBoard3dMounted && window.LifeRoadSnackBoard3D) {
      return window.LifeRoadSnackBoard3D.playDiceRoll(id, value, snackSpeedScale);
    }
    return snackDelay(600);
  },

  // ==================== ラウンド・ターン切替テロップ ====================

  // 第8ラウンド開始時のみFINAL_THREE_TRANSFORM(仕様書05章6節)を挟んでから、通常の
  // ラウンド開始テロップ(showSnackRoundIntro)へ進む。
  beginSnackRound() {
    const state = this.snack.state;
    if (state.round === state.totalRounds - SNACK_FINAL_SPRINT_ROUND_OFFSET && !state.finalThree.activated) {
      this.beginSnackFinalThreeSequence();
      return;
    }
    this.showSnackRoundIntro();
  },

  showSnackRoundIntro() {
    const state = this.snack.state;
    this.snack.roundIntro = {
      round: state.round,
      isFinal: state.round === state.totalRounds,
      // ラストスパート(仕様書14章FINAL_SPRINT)開始ラウンド=中間順位(MID_RESULT)を
      // 「残り3ラウンド開始時」に表示するラウンドと同じタイミングなので、その回だけ
      // タイトルを差し替える形で統合する(同内容のポップアップが2回続けて出るのを避けるため)。
      isFinalSprintStart: state.round === state.totalRounds - SNACK_FINAL_SPRINT_ROUND_OFFSET,
      // ステージギミック(橋)予告(仕様書「変化前に対象ルートを予告する」)。閉鎖の1ラウンド前に告知。
      gimmickWarning: state.round === SNACK_GIMMICK_CLOSE_ROUND - 1 ? "まもなく北の近道(橋)が閉じます" : null,
      midResult: this.buildSnackMidResult(),
    };
    this.snack.phase = "ROUND_INTRO";
    this.render();
    const token = (this._snackFlowToken = (this._snackFlowToken || 0) + 1);
    snackDelay(1800).then(() => {
      if (this._snackFlowToken === token) this.beginSnackPlayerIntro();
    });
  },

  // FINAL_THREE_WARNING→FINAL_THREE_TRANSFORMの一連の演出(仕様書05章6節「演出」)。
  // 完了後にshowSnackRoundIntro()へ合流し、通常の第8ラウンド開始テロップ(ラストスパート表示)へ続く。
  beginSnackFinalThreeSequence() {
    this.snack.phase = "FINAL_THREE_WARNING";
    this.render();
    snackSfx("gaburionBad");
    const token = (this._snackFlowToken = (this._snackFlowToken || 0) + 1);
    snackDelay(1600).then(() => {
      if (this._snackFlowToken !== token) return;
      const changed = applySnackFinalThreeTransform(this.snack.state);
      this.snack.finalThreeReveal = { changes: changed, index: 0 };
      this.snack.phase = "FINAL_THREE_TRANSFORM";
      this.saveSnackGame();
      this.render();
      this.advanceSnackFinalThreeReveal();
    });
  },

  advanceSnackFinalThreeReveal() {
    const token = (this._snackFlowToken = (this._snackFlowToken || 0) + 1);
    const step = () => {
      if (!this.snack || !this.snack.finalThreeReveal || this._snackFlowToken !== token) return;
      const reveal = this.snack.finalThreeReveal;
      if (reveal.index < reveal.changes.length) {
        reveal.index += 1;
        this.render();
        snackDelay(700).then(step);
      } else {
        snackDelay(1000).then(() => {
          if (this._snackFlowToken !== token) return;
          this.snack.finalThreeReveal = null;
          this.showSnackRoundIntro();
        });
      }
    };
    snackDelay(700).then(step);
  },

  // 「スキップ」タップ時。仕様書「スキップ時も内部更新は一括完了させ、最終状態だけ表示する」に
  // 従い、まだ適用前なら即座に適用してからラウンド開始テロップへ進む。
  snackSkipFinalThree() {
    this._snackFlowToken = (this._snackFlowToken || 0) + 1;
    const state = this.snack.state;
    if (!state.finalThree.activated) applySnackFinalThreeTransform(state);
    this.snack.finalThreeReveal = null;
    this.saveSnackGame();
    this.showSnackRoundIntro();
  },

  // 中間順位(仕様書14章MID_RESULT)の表示要否とデータを組み立てる。仕様本文の「第5ラウンド終了時」を
  // 「第6ラウンド開始時」、「残り3ラウンド開始時」を「totalRounds-2ラウンド開始時」と解釈した
  // (両者とも仕様書内の言い回しがラウンド開始/終了で厳密に統一されていないため、既存のROUND_INTRO
  // テロップに乗せられる「ラウンド開始のタイミング」に寄せて実装した)。totalRoundsが5未満の場合は
  // 対象ラウンドが重複・存在しなくなるため自然に非表示になる。
  buildSnackMidResult() {
    const state = this.snack.state;
    const round = state.round;
    const totalRounds = state.totalRounds;
    const isTarget = round === 6 || round === totalRounds - 2 || round === totalRounds;
    if (!isTarget) return null;
    const ranking = getSnackRanking(state);
    const topCoins = ranking.length ? ranking[0].matchCoins : 0;
    const snackZoneLabels = state.activeSnackNodeIds
      .map((id) => findSnackNode(id))
      .filter(Boolean)
      .map((n) => (n.buildingZone ? SNACK_ZONE_LABELS[n.buildingZone] || "" : n.zone === "outer" ? "外周" : "内周"))
      .filter(Boolean);
    const snackZoneLabel = [...new Set(snackZoneLabels)].join("・");
    return {
      ranking: ranking.map((p, i) => ({
        name: p.name,
        rank: i + 1,
        snacks: p.snacks,
        coins: p.matchCoins,
        diffFromTop: topCoins - p.matchCoins,
      })),
      snackZoneLabel,
    };
  },

  beginSnackPlayerIntro() {
    const player = currentSnackPlayer(this.snack.state);
    this.snack.cpuReason = null; // 手番プレイヤーが変わったら前の吹き出しを残さない
    this.snack.playerIntro = { playerId: player.id };
    this.snack.phase = "PLAYER_INTRO";
    this.render();
    if (this.snackBoard3dMounted && window.LifeRoadSnackBoard3D) window.LifeRoadSnackBoard3D.focusCamera(player.id);
    const token = (this._snackFlowToken = (this._snackFlowToken || 0) + 1);
    snackDelay(1400).then(() => {
      if (this._snackFlowToken === token) this.enterSnackTurnPhaseFor(player);
    });
  },

  // テロップ表示中のタップ早送り(仕様7章)。トークンを更新して保留中のタイマーを無効化してから、
  // 次の段階の関数を直接呼ぶ。
  snackSkipTelop() {
    this._snackFlowToken = (this._snackFlowToken || 0) + 1;
    if (this.snack.phase === "ROUND_INTRO") this.beginSnackPlayerIntro();
    else if (this.snack.phase === "PLAYER_INTRO") this.enterSnackTurnPhaseFor(currentSnackPlayer(this.snack.state));
  },

  enterSnackTurnPhaseFor(player) {
    if (player.isCPU) {
      this.snack.phase = "CPU_TURN";
      this.render();
      this.maybeRunSnackCPUTurn();
    } else {
      this.snack.phase = "TURN_MENU";
      this.render();
    }
  },

  // ==================== サイコロ・移動 ====================

  snackRoll() {
    if (this.snack.phase !== "TURN_MENU") return;
    const player = currentSnackPlayer(this.snack.state);
    if (player.id !== this.snackHumanId) return;
    this.snack.phase = "ROLLING";
    this.render();
    this.runSnackDiceAnimation(player.id, (roll) => this.commitSnackRoll(roll));
  },

  // おやつ集めモード専用のサイコロ演出(頭上で回転→ジャンプで停止、マリオパーティ風)。
  // 出目自体はrollSnackDice()で先に確定させ、3D側の演出(playDiceRoll)はあくまで見た目で
  // ロジックには影響しない(オンライン対戦時の通信遅延不公平を避けるための既存方針)。
  runSnackDiceAnimation(playerId, onFinish) {
    const finalRoll = rollSnackDice(this.snack.state, playerId);
    LifeRoadAudio.playSe("diceRoll");
    this.loadSnackBoard3DModules()
      .then(() => {
        window.LifeRoadSnackBoard3D.enterDiceFocus(playerId);
        return window.LifeRoadSnackBoard3D.playDiceRoll(playerId, finalRoll, snackSpeedScale);
      })
      .catch((err) => {
        console.error("おやつ集めモード: サイコロ演出の読み込みに失敗", err);
      })
      .then(() => {
        if (window.LifeRoadSnackBoard3D) window.LifeRoadSnackBoard3D.exitDiceFocus();
        snackSfx("diceStop");
        onFinish(finalRoll);
      });
  },

  // snack-engine.jsの移動結果に含まれるpath(通過ノードIdの配列)を、3D側で1マスずつ
  // 逐次ホップさせる。3D未マウント時(理論上は起きない想定だが念のため)は何もせず戻る。
  // 演出速度設定に応じて1マスあたりの所要時間を短縮し、着地のたびに残り歩数表示を更新する
  // (仕様書14章「1マスずつの移動」の残り歩数表示・速度切替に対応)。
  async playSnackMovementHop(playerId, path) {
    if (!path || !path.length) return;
    if (!this.snackBoard3dMounted || !window.LifeRoadSnackBoard3D) return;
    window.LifeRoadSnackBoard3D.exitBranchOverview();
    this.snack.remainingSteps = { playerId, total: path.length, done: 0 };
    this.render();
    await window.LifeRoadSnackBoard3D.hopPath(playerId, path, {
      stepDurationMs: SNACK_HOP_STEP_MS / snackSpeedScale,
      onStep: (done, total) => {
        if (!this.snack) return;
        this.snack.remainingSteps = { playerId, total, done };
        this.render();
      },
    });
    if (this.snack) this.snack.remainingSteps = null;
  },

  async commitSnackRoll(roll) {
    const state = this.snack.state;
    const player = currentSnackPlayer(state);
    if (player.id !== this.snackHumanId) return;
    this.snack.phase = "MOVING";
    this.render();
    const result = rollSnackAndMove(state, roll);
    this.pushSnackLog(result.entries);
    this.saveSnackGame();
    await this.playSnackMovementHop(player.id, result.path);
    this.showSnackActionResult(player, result.entries);
  },

  async snackChooseBranch(nextNodeId) {
    if (this.snack.phase !== "ROUTE_SELECT" || !this.snack.state.pendingBranch) return;
    const player = currentSnackPlayer(this.snack.state);
    if (player.id !== this.snackHumanId) return;
    this.snack.phase = "MOVING";
    this.render();
    const result = resolveSnackBranch(this.snack.state, nextNodeId);
    this.pushSnackLog(result.entries);
    this.saveSnackGame();
    await this.playSnackMovementHop(player.id, result.path);
    this.showSnackActionResult(player, result.entries);
  },

  async snackChooseSnackPurchase(buy) {
    if (this.snack.phase !== "SNACK_PURCHASE_CONFIRM" || !this.snack.state.pendingSnackChoice) return;
    const player = currentSnackPlayer(this.snack.state);
    if (player.id !== this.snackHumanId) return;
    this.snack.phase = "MOVING";
    this.render();
    const result = resolveSnackChoice(this.snack.state, buy);
    this.pushSnackLog(result.entries);
    this.saveSnackGame();
    await this.playSnackMovementHop(player.id, result.path);
    await this.revealNewSnackSpotIfAny(result.newSnackNodeId);
    this.showSnackActionResult(player, result.entries);
  },

  snackChooseStopOption(optionIndex) {
    if (this.snack.phase !== "STOP_CHOICE" || !this.snack.state.pendingStopChoice) return;
    const player = currentSnackPlayer(this.snack.state);
    if (player.id !== this.snackHumanId) return;
    const result = resolveSnackStopChoice(this.snack.state, optionIndex);
    this.pushSnackLog(result.entries);
    this.saveSnackGame();
    this.showSnackActionResult(player, result.entries);
  },

  // ==================== 行動結果ポップアップ(バグC対応: 行動者+効果を明示表示) ====================

  showSnackActionResult(player, entries) {
    this.snack.lastActionActor = { name: player.name, seatNumber: player.seatNumber, isCPU: player.isCPU };
    this.snack.lastActionEntries = entries || [];
    this.snack.phase = "ACTION_RESULT";
    playSnackEntrySfx(entries);
    this.render();
  },

  // CPUの行動はタップ待ちにせず、CPU_TURN表示中の簡易読み上げ欄にだけ反映する
  setSnackActionResult(player, entries) {
    this.snack.lastActionActor = { name: player.name, seatNumber: player.seatNumber, isCPU: player.isCPU };
    this.snack.lastActionEntries = entries || [];
    playSnackEntrySfx(entries);
  },

  snackDismissActionResult() {
    if (this.snack.phase !== "ACTION_RESULT") return;
    this.afterSnackAction();
  },

  // ==================== アイテム・ショップ・マップ確認(ターンを消費しないポップアップ) ====================

  snackOpenItemSelect() {
    if (!["TURN_MENU", "NEXT_ACTION"].includes(this.snack.phase)) return;
    this.snack.returnPhase = this.snack.phase;
    this.snack.phase = "ITEM_SELECT";
    this.render();
  },

  snackOpenItemConfirm(itemId) {
    this.snack.pendingItemId = itemId;
    this.snack.phase = "ITEM_CONFIRM";
    this.render();
  },

  snackCancelItemConfirm() {
    this.snack.pendingItemId = null;
    this.snack.phase = "ITEM_SELECT";
    this.render();
  },

  snackConfirmUseItem() {
    const itemId = this.snack.pendingItemId;
    const result = useSnackItem(this.snack.state, this.snackHumanId, itemId);
    this.snack.pendingItemId = null;
    if (result.ok) {
      this.pushSnackLog(result.entries || []);
      LifeRoadAudio.playSe("confirm");
      this.saveSnackGame();
      const player = currentSnackPlayer(this.snack.state);
      this.showSnackActionResult(player, result.entries || []);
    } else {
      LifeRoadAudio.playSe("error");
      this.snack.phase = this.snack.returnPhase || "TURN_MENU";
      this.render();
    }
  },

  snackCloseItemSelect() {
    this.snack.phase = this.snack.returnPhase || "TURN_MENU";
    this.snack.returnPhase = null;
    this.render();
  },

  snackOpenShop() {
    if (!["TURN_MENU", "NEXT_ACTION"].includes(this.snack.phase)) return;
    this.snack.returnPhase = this.snack.phase;
    this.snack.phase = "SHOP_SELECT";
    this.render();
  },

  snackCloseShop() {
    this.snack.phase = this.snack.returnPhase || "TURN_MENU";
    this.snack.returnPhase = null;
    this.render();
  },

  snackBuyShopItem(itemId) {
    const result = buySnackShopItem(this.snack.state, this.snackHumanId, itemId);
    LifeRoadAudio.playSe(result.ok ? "confirm" : "error");
    if (result.ok) this.saveSnackGame();
    this.render();
  },

  snackOpenMapOverview() {
    if (["MAP_OVERVIEW", "MAP_ZOOM"].includes(this.snack.phase)) return;
    this.snack.returnPhase = this.snack.phase;
    this.snack.phase = "MAP_OVERVIEW";
    this.render();
    if (this.snackBoard3dMounted && window.LifeRoadSnackBoard3D) window.LifeRoadSnackBoard3D.enterOverview();
  },

  snackOpenMapZoom() {
    if (!["MAP_OVERVIEW", "MAP_ZOOM"].includes(this.snack.phase)) this.snack.returnPhase = this.snack.phase;
    this.snack.phase = "MAP_ZOOM";
    this.render();
    if (this.snackBoard3dMounted && window.LifeRoadSnackBoard3D) window.LifeRoadSnackBoard3D.enterZoom();
    if (!this.snack.state.mapZoomHintShown) {
      this.snack.state.mapZoomHintShown = true;
      this.saveSnackGame();
    }
  },

  snackCloseMapView() {
    this.snack.phase = this.snack.returnPhase || "TURN_MENU";
    this.snack.returnPhase = null;
    this.render();
    if (this.snackBoard3dMounted && window.LifeRoadSnackBoard3D) window.LifeRoadSnackBoard3D.exitMapView();
  },

  // ==================== 行動終了・ターン進行 ====================

  snackEndTurn() {
    if (this.snack.phase !== "NEXT_ACTION") return;
    const player = currentSnackPlayer(this.snack.state);
    if (player.id !== this.snackHumanId) return;
    this.endSnackTurnAndContinue();
  },

  endSnackTurnAndContinue() {
    const prevRound = this.snack.state.round;
    endSnackTurn(this.snack.state);
    this.saveSnackGame();
    if (this.snack.state.status === "finished") {
      this.finishSnackGame();
      return;
    }
    if (this.snack.state.round !== prevRound) {
      this.beginSnackRound();
    } else {
      this.beginSnackPlayerIntro();
    }
  },

  // 手番プレイヤーがCPUの場合、分岐/おやつ確認/選択イベント/ロールをApp側から自動進行する
  // (演出のタイミングを揃えるため、既存のmaybeRunCPUTurnと同様に短いsetTimeoutを挟む)。
  // 先頭で「!player.isCPU なら即return」しているため、人間の手番でこの関数が何かを
  // 自動実行することは無い(バグA=CPUターン後の進行停止の根本対策)。
  maybeRunSnackCPUTurn() {
    const state = this.snack && this.snack.state;
    if (!state || state.status !== "playing") return;
    const player = currentSnackPlayer(state);
    if (!player.isCPU) return;

    if (state.pendingBranch) {
      setTimeout(async () => {
        if (!this.snack || !this.snack.state.pendingBranch) return;
        const decision = window.LifeRoadSnackCPU.cpuChooseSnackBranch(this.snack.state, player);
        this.snack.cpuReason = decision.reason;
        const result = resolveSnackBranch(this.snack.state, decision.choice);
        this.pushSnackLog(result.entries);
        this.setSnackActionResult(player, result.entries);
        this.saveSnackGame();
        await this.playSnackMovementHop(player.id, result.path);
        this.render();
        this.afterSnackAction();
      }, 700);
      return;
    }
    if (state.pendingSnackChoice) {
      setTimeout(async () => {
        if (!this.snack || !this.snack.state.pendingSnackChoice) return;
        const result = resolveSnackChoice(this.snack.state, window.LifeRoadSnackCPU.cpuDecideSnackPurchase());
        this.pushSnackLog(result.entries);
        this.setSnackActionResult(player, result.entries);
        this.saveSnackGame();
        await this.playSnackMovementHop(player.id, result.path);
        await this.revealNewSnackSpotIfAny(result.newSnackNodeId);
        this.render();
        this.afterSnackAction();
      }, 700);
      return;
    }
    if (state.pendingStopChoice) {
      setTimeout(() => {
        if (!this.snack || !this.snack.state.pendingStopChoice) return;
        const idx = LifeRoadCPU.cpuDecideOption(this.snack.state.pendingStopChoice, player.personality);
        const result = resolveSnackStopChoice(this.snack.state, idx);
        this.pushSnackLog(result.entries);
        this.setSnackActionResult(player, result.entries);
        this.saveSnackGame();
        this.render();
        this.afterSnackAction();
      }, 700);
      return;
    }

    if (!player.turnRolled) {
      setTimeout(() => {
        if (!this.snack || this.snack.state.status !== "playing") return;
        if (currentSnackPlayer(this.snack.state).id !== player.id) return;
        const itemDecision = window.LifeRoadSnackCPU.cpuDecideItemToUse(this.snack.state, player);
        if (itemDecision.choice) {
          useSnackItem(this.snack.state, player.id, itemDecision.choice);
          this.snack.cpuReason = itemDecision.reason;
        }
        this.runSnackDiceAnimation(player.id, async (roll) => {
          const result = rollSnackAndMove(this.snack.state, roll);
          this.pushSnackLog(result.entries);
          this.setSnackActionResult(player, result.entries);
          this.saveSnackGame();
          await this.playSnackMovementHop(player.id, result.path);
          this.render();
          this.afterSnackAction();
        });
      }, 700);
      return;
    }
    // 移動・確認まで完了しているのにここへ来た場合(=CPUのターン終了待ち)
    setTimeout(() => this.endSnackTurnAndContinue(), 500);
  },

  // 順位変動(仕様書14章RANK_CHANGE)の検出。afterSnackAction()の単一合流点から呼ぶことで、
  // 人間・CPUどちらの手番が何を解決した後でも同じ条件で検出できる(コイン/おやつが変わり得るのは
  // ここに来る直前=ロール・分岐・購入・選択イベントの解決後のみのため、これで網羅できる)。
  // prevRankByIdはセーブ非対象の演出専用状態なので、ゲーム開始直後(初回呼び出し)は比較対象が無く
  // 何もしない。
  checkSnackRankChange() {
    const ranking = getSnackRanking(this.snack.state);
    const rankById = new Map(ranking.map((p, i) => [p.id, i]));
    const prev = this.snack.prevRankById;
    this.snack.prevRankById = rankById;
    if (!prev) return;
    const changes = [];
    rankById.forEach((rank, id) => {
      const prevRank = prev.get(id);
      if (prevRank === undefined || prevRank === rank) return;
      changes.push({
        playerId: id,
        direction: rank === 0 ? "crown" : rank < prevRank ? "up" : "down",
        fromRank: prevRank,
        toRank: rank,
      });
    });
    if (!changes.length) return;
    snackSfx(changes.some((c) => c.direction === "crown" || c.direction === "up") ? "rankUp" : "rankDown");
    const fxId = Date.now();
    this.snack.rankChangeFx = { changes, id: fxId };
    setTimeout(() => {
      if (this.snack && this.snack.rankChangeFx && this.snack.rankChangeFx.id === fxId) {
        this.snack.rankChangeFx = null;
        this.render();
      }
    }, 1600 / snackSpeedScale);
  },

  // ロール・分岐・おやつ確認・選択イベントのいずれかを解決した直後に必ず呼ぶ(人間はACTION_RESULTの
  // 「次へ」タップから、CPUはmaybeRunSnackCPUTurnから直接)。ゲーム終了判定、まだ解決していない
  // pending(分岐/おやつ確認/選択イベント)への遷移、CPU自動進行、人間の次phase(まだロールして
  // いなければTURN_MENU、ロール済みならNEXT_ACTION)を一箇所で決める単一の合流点。
  afterSnackAction() {
    const state = this.snack.state;
    this.checkSnackRankChange();
    if (state.status === "finished") {
      this.finishSnackGame();
      return;
    }
    const player = currentSnackPlayer(state);
    if (state.pendingGaburion) return this.beginSnackGaburionSequence(player);
    if (state.pendingBranch) return this.enterSnackPendingPhase("ROUTE_SELECT", player);
    if (state.pendingSnackChoice) return this.enterSnackPendingPhase("SNACK_PURCHASE_CONFIRM", player);
    if (state.pendingStopChoice) return this.enterSnackPendingPhase("STOP_CHOICE", player);
    if (player.isCPU) {
      this.snack.phase = "CPU_TURN";
      this.render();
      this.maybeRunSnackCPUTurn();
      return;
    }
    this.snack.phase = player.turnRolled ? "NEXT_ACTION" : "TURN_MENU";
    this.render();
  },

  // ==================== ガブリオンイベント(仕様書05_ガブリオンイベント確定仕様書) ====================
  // GABURION_INTRO→GABURION_ROULETTE_READY→GABURION_ROULETTE_SPIN→GABURION_RESULT→GABURION_APPLY
  // の順に進む。人間・CPUどちらの手番でも同じ関数群で進行し(仕様書9章「CPUが対象を選ぶ必要はない」
  // 通り、CPU固有の判断ロジックは無い)、「まわす」ボタンの起点だけがhuman=タップ/CPU=0.7秒後
  // 自動、という違いになる。

  beginSnackGaburionSequence(player) {
    const state = this.snack.state;
    const { nodeId } = state.pendingGaburion;
    state.pendingGaburion = null;
    state.gaburion = {
      eventId: `gab-${Date.now()}-${player.id}`,
      actorId: player.id,
      phase: "GABURION_INTRO",
      resultId: null,
      targetPlayerId: null,
      resolved: false,
      cursedDiePlayerIds: state.gaburion ? state.gaburion.cursedDiePlayerIds : [],
    };
    this.snack.phase = "GABURION_INTRO";
    this.saveSnackGame();
    this.render();
    // カメラはおやつ紹介(SNACK_REVEAL)と同じ「マスを周回して見せる」演出を流用する
    // (専用のカメラワークを新設するほどの差別化が無いための簡略化)。
    if (this.snackBoard3dMounted && window.LifeRoadSnackBoard3D) {
      window.LifeRoadSnackBoard3D.enterSnackReveal(nodeId);
    }
    snackSfx("gaburionEntrance");
    const token = (this._snackFlowToken = (this._snackFlowToken || 0) + 1);
    snackDelay(1500).then(() => {
      if (this._snackFlowToken !== token) return;
      if (window.LifeRoadSnackBoard3D) window.LifeRoadSnackBoard3D.exitSnackReveal();
      state.gaburion.phase = "GABURION_ROULETTE_READY";
      this.snack.phase = "GABURION_ROULETTE_READY";
      this.render();
      if (player.isCPU) {
        snackDelay(700).then(() => {
          if (this._snackFlowToken === token) this.snackSpinGaburionRoulette();
        });
      }
    });
  },

  // 人間は「まわす」ボタン、CPUは0.7秒後に自動でこれを呼ぶ(仕様書4章)。
  snackSpinGaburionRoulette() {
    if (this.snack.phase !== "GABURION_ROULETTE_READY") return;
    const state = this.snack.state;
    const player = state.players.find((p) => p.id === state.gaburion.actorId);
    // 結果を先に確定させ、その後で見た目のルーレット回転を見せる(仕様書「結果はRNGで先に
    // 決め、盤面回転は結果区画に停止角度を合わせる」、既存の行動順決めサイコロと同じ設計)。
    const resultId = pickGaburionOutcomeId(state, player);
    state.gaburion.resultId = resultId;
    state.gaburion.phase = "GABURION_ROULETTE_SPIN";
    this.snack.phase = "GABURION_ROULETTE_SPIN";
    this.saveSnackGame();
    this.render();
    snackSfx("gaburionSpin");
    const spinMs = 2600; // 仕様書の2.2〜3.0秒レンジの中間値
    const token = (this._snackFlowToken = (this._snackFlowToken || 0) + 1);
    snackDelay(spinMs).then(() => {
      if (this._snackFlowToken !== token) return;
      this.enterSnackGaburionResult();
    });
  },

  enterSnackGaburionResult() {
    const state = this.snack.state;
    const player = state.players.find((p) => p.id === state.gaburion.actorId);
    const entries = [];
    const effectInfo = applyGaburionOutcome(state, player, state.gaburion.resultId, entries);
    state.gaburion.targetPlayerId = effectInfo.targetPlayerId;
    state.gaburion.resolved = true;
    state.gaburion.phase = "GABURION_RESULT";
    this.pushSnackLog(entries);
    this.snack.lastGaburionEntries = entries;
    this.snack.phase = "GABURION_RESULT";
    this.saveSnackGame();
    const isRescue = state.gaburion.resultId === "BONUS_COINS";
    snackSfx(isRescue ? "gaburionRescue" : "gaburionBad");
    this.render();
    // CPU中も最低1.2秒表示する(仕様書9章)。人間側もテンポを揃えるため同じ最低時間にした。
    const minMs = 1200;
    const token = (this._snackFlowToken = (this._snackFlowToken || 0) + 1);
    snackDelay(minMs).then(() => {
      if (this._snackFlowToken !== token) return;
      state.gaburion.phase = "GABURION_APPLY";
      this.snack.phase = "GABURION_APPLY";
      this.render();
      if (player.isCPU) {
        snackDelay(900).then(() => {
          if (this._snackFlowToken === token) this.snackFinishGaburion();
        });
      }
    });
  },

  // 「つぎへ」ボタン(人間)/自動進行(CPU)。通常のターン進行処理へ合流する。
  snackFinishGaburion() {
    if (this.snack.phase !== "GABURION_APPLY") return;
    this.saveSnackGame();
    this.afterSnackAction();
  },

  enterSnackPendingPhase(phase, player) {
    if (phase === "ROUTE_SELECT" && this.snackBoard3dMounted && window.LifeRoadSnackBoard3D && this.snack.state.pendingBranch) {
      window.LifeRoadSnackBoard3D.enterBranchOverview(this.snack.state.pendingBranch.nodeId);
    }
    if (player.isCPU) {
      this.snack.phase = "CPU_TURN";
      this.render();
      this.maybeRunSnackCPUTurn();
    } else {
      this.snack.phase = phase;
      this.render();
    }
  },

  finishSnackGame() {
    this.screen = "snack-result";
    this.clearSnackSave();
    const awardTotal = buildSnackSpecialAwards(this.snack.state).length;
    this.snack.resultReveal = { stage: 0, spotlight: false, awardStage: 0, awardTotal };
    this.render();
    this.advanceSnackResultReveal();
  },

  // 段階的な最終結果発表(仕様書14章FINAL_RESULT_REVEAL)。4位→1位の順に1段階ずつ、
  // 既存のROUND_INTRO等と同じ「setTimeout+トークン確認」パターンで自動的に公開していく。
  // 1位公開後は優勝者スポットライト演出→特別賞の1件ずつ表示、の順に続く。
  advanceSnackResultReveal() {
    const total = getSnackRanking(this.snack.state).length;
    const token = (this._snackFlowToken = (this._snackFlowToken || 0) + 1);
    const step = () => {
      if (!this.snack || !this.snack.resultReveal || this._snackFlowToken !== token) return;
      this.snack.resultReveal.stage += 1;
      const isFinal = this.snack.resultReveal.stage >= total;
      snackSfx(isFinal ? "winner" : "resultReveal");
      this.render();
      if (!isFinal) {
        snackDelay(650).then(step);
      } else {
        this.playSnackWinnerSpotlight(token);
      }
    };
    snackDelay(500).then(step);
  },

  // 1位確定直後、中央スポットライト(台座+王冠+紙吹雪)を一定時間だけ表示してから
  // 特別賞の段階発表(advanceSnackAwardsReveal)へ進む。
  playSnackWinnerSpotlight(token) {
    if (!this.snack || !this.snack.resultReveal || this._snackFlowToken !== token) return;
    this.snack.resultReveal.spotlight = true;
    this.render();
    snackDelay(1400).then(() => {
      if (!this.snack || !this.snack.resultReveal || this._snackFlowToken !== token) return;
      this.snack.resultReveal.spotlight = false;
      this.render();
      this.advanceSnackAwardsReveal(token);
    });
  },

  advanceSnackAwardsReveal(token) {
    if (!this.snack || !this.snack.resultReveal) return;
    const total = this.snack.resultReveal.awardTotal;
    const step = () => {
      if (!this.snack || !this.snack.resultReveal || this._snackFlowToken !== token) return;
      this.snack.resultReveal.awardStage += 1;
      this.render();
      if (this.snack.resultReveal.awardStage < total) snackDelay(450).then(step);
    };
    if (total > 0) snackDelay(300).then(step);
  },

  // 「結果をすぐ見る」タップ時、残りの段階(順位・スポットライト・特別賞)を即座に全公開する。
  snackSkipResultReveal() {
    if (!this.snack || !this.snack.resultReveal) return;
    this._snackFlowToken = (this._snackFlowToken || 0) + 1;
    this.snack.resultReveal.stage = getSnackRanking(this.snack.state).length;
    this.snack.resultReveal.spotlight = false;
    this.snack.resultReveal.awardStage = this.snack.resultReveal.awardTotal;
    this.render();
  },
};

document.addEventListener("DOMContentLoaded", () => App.init());
