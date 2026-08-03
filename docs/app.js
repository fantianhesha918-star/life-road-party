// ライフロード 起動・画面遷移・全体配線

const SAVE_KEY = "liferoad_solo_save_v1";
const HEARTBEAT_INTERVAL_MS = 15000;

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
    this.render();
  },

  goSetup() {
    this.mode = "solo";
    this.screen = "setup";
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
    this.screen = "game";
    this.render();
    this.maybeRunCPUTurn();
  },

  startGame() {
    const nicknameInput = document.getElementById("nickname-input");
    const cpuSelect = document.getElementById("cpu-count-select");
    const nickname = ((nicknameInput && nicknameInput.value) || "プレイヤー").trim().slice(0, 10) || "プレイヤー";
    const cpuCount = parseInt((cpuSelect && cpuSelect.value) || "1", 10);

    const configs = [{ id: "human", name: nickname, isCPU: false }];
    for (let i = 1; i <= cpuCount; i++) {
      configs.push({ id: `cpu${i}`, name: `CPU${i}`, isCPU: true });
    }
    this.humanId = "human";
    this.state = createInitialState(configs);
    this.log = [{ type: "info", text: "ゲーム開始！" }];
    this.screen = "game";
    this.saveGame();
    this.render();
    this.maybeRunCPUTurn();
  },

  handleRoll() {
    if (!this.state || this.state.status !== "playing") return;
    const turnPlayer = currentPlayer(this.state);
    if (turnPlayer.id !== this.humanId || this.state.pendingChoice) return;
    const roll = rollDice();
    const result = applyRoll(this.state, roll);
    this.pushLog(result.entries);
    this.afterTurnAction();
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
      setTimeout(() => {
        this.screen = "result";
        this.clearSave();
        this.render();
      }, 900);
      return;
    }
    this.maybeRunCPUTurn();
  },

  maybeRunCPUTurn() {
    if (!this.state || this.state.status !== "playing") return;

    if (this.state.pendingChoice) {
      const choosingPlayer = this.state.players.find((p) => p.id === this.state.pendingChoice.playerId);
      if (choosingPlayer && choosingPlayer.isCPU) {
        setTimeout(() => {
          if (!this.state || !this.state.pendingChoice) return;
          const idx = cpuDecideJobOffer(this.state.pendingChoice.offers);
          this.chooseJob(idx);
        }, 700);
      }
      return;
    }

    const turnPlayer = currentPlayer(this.state);
    if (!turnPlayer.isCPU) return;
    setTimeout(() => {
      if (!this.state || this.state.status !== "playing") return;
      const roll = rollDice();
      const result = applyRoll(this.state, roll);
      this.pushLog(result.entries);
      this.afterTurnAction();
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
    };
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
    }
    this.render();
  },

  startOnlineGame() {
    if (!this.online || !this.online.room) return;
    window.Room.startGame(this.online.roomCode, this.online.room).catch((err) => this.handleOnlineError(err));
  },

  handleOnlineRoll() {
    if (!this.online || !this.online.room) return;
    const room = this.online.room;
    if (room.status !== "playing" || room.currentTurnPlayerUid !== this.online.uid) return;

    const localState = roomToEngineState(room);
    const roll = rollDice();
    const result = applyRoll(localState, roll);
    this.pushOnlineLog(result.entries);

    // 楽観的に自分の画面だけ即時反映する(サーバー確定はonSnapshotで後追い)
    this.online.localTurnState = localState;
    this.render();

    if (result.pendingChoice) return;
    this.commitOnlineTurn(localState);
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
      view.innerHTML = renderTitleScreen(this.hasSave());
    } else if (this.screen === "setup") {
      view.innerHTML = renderSetupScreen();
    } else if (this.screen === "game") {
      view.innerHTML = renderGameScreen(this.state, this.log, this.humanId, "solo");
    } else if (this.screen === "result") {
      view.innerHTML = renderResultScreen(this.state, "solo");
    } else if (this.screen === "online-menu") {
      view.innerHTML = renderOnlineMenuScreen(this.onlineError, this.onlineBusy);
    } else if (this.screen === "online-lobby" && this.online && this.online.room) {
      view.innerHTML = renderOnlineLobbyScreen(this.online.room, this.online.roomCode, this.online.uid);
    } else if (this.screen === "online-game" && this.online && this.online.room) {
      const baseState = roomToEngineState(this.online.room);
      const displayState = this.online.localTurnState || baseState;
      view.innerHTML = renderGameScreen(displayState, this.online.log, this.online.uid, "online");
    } else if (this.screen === "online-result" && this.online && this.online.room) {
      const state = roomToEngineState(this.online.room);
      view.innerHTML = renderResultScreen(state, "online");
    }
  },
};

document.addEventListener("DOMContentLoaded", () => App.init());
