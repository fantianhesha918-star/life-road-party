// ライフロード 起動・画面遷移・全体配線

const SAVE_KEY = "liferoad_solo_save_v1";

const App = {
  screen: "title",
  state: null,
  log: [],
  humanId: "human",

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
    this.screen = "title";
    this.state = null;
    this.log = [];
    this.render();
  },

  goSetup() {
    this.screen = "setup";
    this.render();
  },

  continueGame() {
    const saved = this.loadSave();
    if (!saved) {
      this.goTitle();
      return;
    }
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

  render() {
    const view = document.getElementById("view");
    if (this.screen === "title") {
      view.innerHTML = renderTitleScreen(this.hasSave());
    } else if (this.screen === "setup") {
      view.innerHTML = renderSetupScreen();
    } else if (this.screen === "game") {
      view.innerHTML = renderGameScreen(this.state, this.log, this.humanId);
    } else if (this.screen === "result") {
      view.innerHTML = renderResultScreen(this.state);
    }
  },
};

document.addEventListener("DOMContentLoaded", () => App.init());
