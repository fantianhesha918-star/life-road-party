// ライフロード 起動・画面遷移・全体配線

const SAVE_KEY = "liferoad_solo_save_v1";
const ONLINE_ROOM_KEY = "liferoad_online_room_v1";
const HEARTBEAT_INTERVAL_MS = 15000;
const HOP_STEP_MS = 320; // マス移動アニメーション、1マスあたりの所要時間

// Firestoreの部屋ドキュメント(playersがuidキーのマップ)を、game-engine.jsが
// 扱えるゲーム状態(playersが配列)に変換する
function roomToEngineState(room) {
  const order = room.turnOrder && room.turnOrder.length ? room.turnOrder : Object.keys(room.players);
  const players = order.map((uid, i) => {
    const p = room.players[uid] || {};
    return {
      id: uid,
      name: p.nickname || `プレイヤー${i + 1}`,
      isCPU: !!p.isCPU,
      color: TOKEN_COLORS[i % TOKEN_COLORS.length],
      avatar: p.avatar || { color: TOKEN_COLORS[i % TOKEN_COLORS.length], speciesEmoji: null, hatEmoji: null, accessoryEmoji: null },
      position: typeof p.position === "number" ? p.position : 0,
      money: typeof p.money === "number" ? p.money : window.LifeRoadData.START_MONEY,
      job: p.job || null,
      finished: !!p.finished,
    };
  });
  const currentTurnIndex = Math.max(0, order.indexOf(room.currentTurnPlayerUid));
  return {
    players,
    currentTurnIndex,
    turnNumber: 1,
    status: room.status === "finished" ? "finished" : "playing",
    pendingChoice: null,
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
    };
  });
  const finished = localState.status === "finished";
  return {
    players,
    currentTurnIndex: localState.currentTurnIndex,
    currentTurnPlayerUid: finished ? null : localState.players[localState.currentTurnIndex].id,
    status: finished ? "finished" : "playing",
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
  // ---- マップ上のホップ移動アニメーション中の一時的な表示位置。solo/online共通で使う ----
  hopAnimation: null, // { playerId, position }

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
    this.hopAnimation = null;
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

  // ==================== 盤面3D化・フェーズA(技術検証) ====================
  // 本番のプレイ導線には未接続。タイトル画面の検証ボタンからのみ呼ばれる。

  loadBoard3DModules() {
    if (window.LifeRoadBoard3D) return Promise.resolve();
    return import("./board3d.js");
  },

  testBoard3D() {
    this.loadBoard3DModules().then(() => {
      document.getElementById("board3d-overlay").classList.add("is-active");
      window.LifeRoadBoard3D.mount(document.getElementById("board3d-canvas"));
      window.LifeRoadBoard3D.hopSteps(0, 6, { stepDurationMs: HOP_STEP_MS });
    });
  },

  closeBoard3DTest() {
    document.getElementById("board3d-overlay").classList.remove("is-active");
    if (window.LifeRoadBoard3D) window.LifeRoadBoard3D.dispose();
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
    this.hub = { view: "menu", spinNumber: null, itemMessage: null };
    this.hopAnimation = null;
    this.screen = "game";
    this.render();
    this.maybeRunCPUTurn();
  },

  startGame() {
    const nicknameInput = document.getElementById("nickname-input");
    const cpuSelect = document.getElementById("cpu-count-select");
    const nickname = ((nicknameInput && nicknameInput.value) || "プレイヤー").trim().slice(0, 10) || "プレイヤー";
    const cpuCount = parseInt((cpuSelect && cpuSelect.value) || "1", 10);

    const profile = LifeRoadProfile.loadProfile();
    const humanAvatar = LifeRoadProfile.getAvatarVisual(profile.equipped);
    const configs = [{ id: "human", name: nickname, isCPU: false, avatar: humanAvatar }];
    for (let i = 1; i <= cpuCount; i++) {
      configs.push({
        id: `cpu${i}`,
        name: `CPU${i}`,
        isCPU: true,
        personality: LifeRoadCPU.pickRandomPersonality(),
        avatar: { color: TOKEN_COLORS[i % TOKEN_COLORS.length], hatEmoji: null, accessoryEmoji: "🤖" },
      });
    }
    this.humanId = "human";
    this.state = createInitialState(configs);
    this.log = [{ type: "info", text: "ゲーム開始！" }];
    this.hub = { view: "menu", spinNumber: null, itemMessage: null };
    this.hopAnimation = null;
    this.screen = "game";
    this.saveGame();
    this.render();
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
      this.afterTurnAction();
    });
  },

  // ---- マップ上のホップ移動アニメーション(solo/online共通) ----

  runHopSteps(playerId, fromPos, toPos, onDone) {
    if (toPos <= fromPos) {
      this.hopAnimation = null;
      onDone();
      return;
    }
    let pos = fromPos;
    this.hopAnimation = { playerId, position: pos };
    this.render();
    const step = () => {
      pos += 1;
      this.hopAnimation = { playerId, position: pos };
      this.render();
      if (pos >= toPos) {
        setTimeout(() => {
          this.hopAnimation = null;
          onDone();
        }, HOP_STEP_MS);
      } else {
        setTimeout(step, HOP_STEP_MS);
      }
    };
    setTimeout(step, HOP_STEP_MS);
  },

  // ---- ターンハブ(演出+選択肢メニュー) ----

  showHubView(view) {
    this.hub = { view, spinNumber: null, itemMessage: null };
    this.render();
  },

  useConsumable(itemId) {
    const profile = LifeRoadProfile.loadProfile();
    const result = LifeRoadProfile.useConsumableItem(profile, itemId);
    if (!result.ok) return;
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
    const finalRoll = rollDice();
    this.hub = { view: "spinning", spinNumber: rollDice(), itemMessage: null };
    this.render();

    let ticks = 0;
    const totalTicks = 9;
    const timer = setInterval(() => {
      ticks++;
      if (ticks >= totalTicks) {
        clearInterval(timer);
        this.hub.spinNumber = finalRoll;
        this.render();
        setTimeout(() => this.commitRoulette(finalRoll), 400);
        return;
      }
      this.hub.spinNumber = rollDice();
      this.render();
    }, 90);
  },

  commitRoulette(roll) {
    this.hub = { view: "menu", spinNumber: null, itemMessage: null };
    this.hopAnimation = null;
    if (this.mode === "online") {
      this.handleOnlineRoll(roll);
    } else {
      this.handleRoll(roll);
    }
  },

  chooseJob(offerIndex) {
    if (!this.state || !this.state.pendingChoice) return;
    const result = resolveJobChoice(this.state, this.state.pendingChoice.playerId, offerIndex);
    this.pushLog(result.entries);
    this.afterTurnAction();
  },

  afterTurnAction() {
    this.saveGame();
    this.render();
    if (this.state.status === "finished") {
      const human = this.state.players.find((p) => p.id === this.humanId);
      this.lastReward = this.grantGameReward(human ? human.money : 0);
      setTimeout(() => {
        this.screen = "result";
        this.clearSave();
        this.render();
      }, 900);
      return;
    }
    this.maybeRunCPUTurn();
  },

  grantGameReward(finalMoney) {
    const profile = LifeRoadProfile.loadProfile();
    const reward = LifeRoadProfile.applyGameReward(profile, finalMoney);
    LifeRoadProfile.saveProfile(profile);
    return reward;
  },

  maybeRunCPUTurn() {
    if (!this.state || this.state.status !== "playing") return;

    if (this.state.pendingChoice) {
      const choosingPlayer = this.state.players.find((p) => p.id === this.state.pendingChoice.playerId);
      if (choosingPlayer && choosingPlayer.isCPU) {
        setTimeout(() => {
          if (!this.state || !this.state.pendingChoice) return;
          const idx = cpuDecideJobOffer(this.state.pendingChoice.offers, choosingPlayer.personality);
          this.chooseJob(idx);
        }, 700);
      }
      return;
    }

    const turnPlayer = currentPlayer(this.state);
    if (!turnPlayer.isCPU) return;
    setTimeout(() => {
      if (!this.state || this.state.status !== "playing") return;
      const player = currentPlayer(this.state);
      const playerId = player.id;
      const fromPos = player.position;
      const roll = rollDice();
      const result = applyRoll(this.state, roll);
      const toPos = player.position;
      this.runHopSteps(playerId, fromPos, toPos, () => {
        this.pushLog(result.entries);
        this.afterTurnAction();
      });
    }, 900);
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
    const nickname = ((nicknameInput && nicknameInput.value) || "プレイヤー").trim().slice(0, 10) || "プレイヤー";
    const maxPlayers = parseInt((maxPlayersSelect && maxPlayersSelect.value) || "4", 10);

    this.onlineError = null;
    this.onlineBusy = true;
    this.render();
    this.loadFirebaseModules()
      .then(() => window.Room.createRoom({ nickname, maxPlayers }))
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
      rewardGranted: false,
      lastReward: null,
    };
    this.hub = { view: "menu", spinNumber: null, itemMessage: null };
    this.hopAnimation = null;
    this.saveOnlineRoomRef();
    this.screen = "online-lobby";
    this.render();
    this.online.unsubscribe = window.Room.subscribeRoom(roomCode, (room) => {
      if (!this.online) return;
      this.online.room = room;
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
    } else if (status === "finished") {
      this.screen = "online-result";
      this.stopHeartbeat();
      if (!this.online.rewardGranted) {
        this.online.rewardGranted = true;
        const state = roomToEngineState(this.online.room);
        const me = state.players.find((p) => p.id === this.online.uid);
        this.online.lastReward = this.grantGameReward(me ? me.money : 0);
      }
    }
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
      this.render();
      if (result.pendingChoice) return;
      this.commitOnlineTurn(localState);
    });
  },

  chooseOnlineJob(offerIndex) {
    if (!this.online || !this.online.localTurnState) return;
    const localState = this.online.localTurnState;
    const result = resolveJobChoice(localState, localState.pendingChoice.playerId, offerIndex);
    this.pushOnlineLog(result.entries);
    // pendingChoiceが外れた状態を引き続き楽観表示し、確定はonSnapshotで後追いする
    this.online.localTurnState = localState;
    this.commitOnlineTurn(localState);
  },

  commitOnlineTurn(localState) {
    const patch = engineStateToRoomPatch(localState, this.online.room);
    this.render();
    window.Room.writeTurnResult(this.online.roomCode, patch).catch((err) => this.handleOnlineError(err));
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
      view.innerHTML = renderShopScreen(LifeRoadProfile.loadProfile());
    } else if (this.screen === "setup") {
      view.innerHTML = renderSetupScreen();
    } else if (this.screen === "game") {
      view.innerHTML = renderGameScreen(this.state, this.log, this.humanId, "solo", LifeRoadProfile.loadProfile(), this.hub, this.hopAnimation);
    } else if (this.screen === "result") {
      view.innerHTML = renderResultScreen(this.state, "solo", this.lastReward);
    } else if (this.screen === "online-menu") {
      view.innerHTML = renderOnlineMenuScreen(this.onlineError, this.onlineBusy, this.loadOnlineRoomRef());
    } else if (this.screen === "online-lobby" && this.online && this.online.room) {
      view.innerHTML = renderOnlineLobbyScreen(this.online.room, this.online.roomCode, this.online.uid);
    } else if (this.screen === "online-game" && this.online && this.online.room) {
      const baseState = roomToEngineState(this.online.room);
      const displayState = this.online.localTurnState || baseState;
      view.innerHTML = renderGameScreen(displayState, this.online.log, this.online.uid, "online", LifeRoadProfile.loadProfile(), this.hub, this.hopAnimation);
    } else if (this.screen === "online-result" && this.online && this.online.room) {
      const state = roomToEngineState(this.online.room);
      view.innerHTML = renderResultScreen(state, "online", this.online.lastReward);
    }
    this.scrollBoardIfNeeded();
  },

  // 手番プレイヤーの位置(ホップ移動中はその一時的な位置)に盤面のスクロール位置を追従させる
  scrollBoardIfNeeded() {
    if (this.screen !== "game" && this.screen !== "online-game") return;
    let state = null;
    if (this.mode === "online") {
      if (!this.online || !this.online.room) return;
      state = this.online.localTurnState || roomToEngineState(this.online.room);
    } else {
      state = this.state;
    }
    if (!state || !state.players[state.currentTurnIndex]) return;
    const pos = this.hopAnimation ? this.hopAnimation.position : state.players[state.currentTurnIndex].position;
    const el = document.getElementById(`board-cell-${pos}`);
    if (el) el.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
  },
};

document.addEventListener("DOMContentLoaded", () => App.init());
