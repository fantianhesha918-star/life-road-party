// ライフロード 起動・画面遷移・全体配線

const SAVE_KEY = "liferoad_solo_save_v1";
const ONLINE_ROOM_KEY = "liferoad_online_room_v1";
const SNACK_SAVE_KEY = "liferoad_snack_save_v1";
const HEARTBEAT_INTERVAL_MS = 15000;
const HOP_STEP_MS = 420; // マス移動アニメーション、1マスあたりの所要時間
const CPU_PRE_ROLL_MS = 1100; // CPUがルーレットを回す前の「間」
const CPU_PRE_CHOICE_MS = 1500; // CPUが選択肢を考える「間」
const CPU_REVEAL_MS = 2200; // CPUの結果カード(テロップ)を見せておく時間
const TURN_POPUP_MS = 1500; // 手番切り替えポップアップの表示時間
const MONEY_TOAST_MS = 2600; // 所持金変動トーストの表示時間

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
      view.innerHTML = renderSnackGameScreen(this.snack, this.snackHumanId);
    } else if (this.screen === "snack-result" && this.snack) {
      view.innerHTML = renderSnackResultScreen(this.snack.state, this.snackHumanId);
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

  // おやつ集めモード用3D盤面の同期(sync3DBoard()から画面がsnack-gameのときだけ呼ばれる)。
  syncSnackBoard3D() {
    const snack = this.snack.state;
    const player = snack.players[snack.currentTurnIndex];
    if (!player) return;
    const focusId = player.id;
    this.loadSnackBoard3DModules()
      .then(() => {
        // 非同期読み込み完了までの間に画面遷移していたら何もしない
        if (this.screen !== "snack-game" || !this.snack) return;
        if (!this.snackBoard3dMounted) {
          window.LifeRoadSnackBoard3D.mount(document.getElementById("board3d-canvas"), {
            nodes: SNACK_STAGE_NODES,
            players: snack.players,
            currentTurnIndex: snack.currentTurnIndex,
            activeSnackNodeId: snack.activeSnackNodeId,
          });
          this.snackBoard3dMounted = true;
        } else {
          window.LifeRoadSnackBoard3D.syncPlayers(snack.players, snack.activeSnackNodeId);
        }
        window.LifeRoadSnackBoard3D.focusCamera(focusId);
      })
      .catch((err) => {
        console.error("おやつ集めモード3D盤面の読み込みに失敗", err);
      });
  },

  // ==================== おやつ集めモード(フェーズ1試作) ====================
  // 既存の人生ゲームモード(this.state等)とは完全に別の状態(this.snack)で管理する。
  // 保存タイミングは、Codexレビュー対応で見つけたバグ(reveal表示中に保存が遅れて中断時に
  // 巻き戻る)と同じ設計ミスを避けるため、state変更の直後に必ずsaveSnackGame()する。

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
    this.snack = { state: createSnackState(configs), log: [{ type: "info", text: "おやつ集めモード開始！" }], hub: { view: "menu" }, logOpen: false };
    this.screen = "snack-game";
    this.saveSnackGame();
    this.render();
    this.maybeRunSnackCPUTurn();
  },

  continueSnackGame() {
    const saved = this.loadSnackSave();
    if (!saved) {
      this.goTitle();
      return;
    }
    this.snackHumanId = saved.humanId;
    this.snack = { state: saved.state, log: saved.log, hub: { view: "menu" }, logOpen: false };
    this.screen = "snack-game";
    this.render();
    this.maybeRunSnackCPUTurn();
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

  showSnackHubView(view) {
    this.snack.hub = { view };
    this.render();
  },

  snackShowShop() {
    this.snack.hub = { view: "shop" };
    this.render();
  },

  snackToggleLog() {
    this.snack.logOpen = !this.snack.logOpen;
    LifeRoadAudio.playSe(this.snack.logOpen ? "modalOpen" : "modalClose");
    this.render();
  },

  snackRoll() {
    if (this.snack.hub.view === "spinning") return;
    this.runRouletteAnimation((roll) => this.commitSnackRoll(roll));
  },

  commitSnackRoll(roll) {
    this.snack.hub = { view: "menu" };
    const state = this.snack.state;
    const player = currentSnackPlayer(state);
    if (player.id !== this.snackHumanId) return;
    const result = rollSnackAndMove(state, roll);
    this.pushSnackLog(result.entries);
    this.saveSnackGame();
    this.render();
    this.afterSnackAction();
  },

  snackChooseBranch(nextNodeId) {
    if (!this.snack.state.pendingBranch) return;
    const player = this.snack.state.players.find((p) => p.id === this.snack.state.pendingBranch.playerId);
    if (player.id !== this.snackHumanId) return;
    const result = resolveSnackBranch(this.snack.state, nextNodeId);
    this.pushSnackLog(result.entries);
    this.saveSnackGame();
    this.render();
    this.afterSnackAction();
  },

  snackChooseSnackPurchase(buy) {
    if (!this.snack.state.pendingSnackChoice) return;
    const player = this.snack.state.players.find((p) => p.id === this.snack.state.pendingSnackChoice.playerId);
    if (player.id !== this.snackHumanId) return;
    const result = resolveSnackChoice(this.snack.state, buy);
    this.pushSnackLog(result.entries);
    this.saveSnackGame();
    this.render();
    this.afterSnackAction();
  },

  snackChooseStopOption(optionIndex) {
    if (!this.snack.state.pendingStopChoice) return;
    const player = this.snack.state.players.find((p) => p.id === this.snack.state.pendingStopChoice.playerId);
    if (player.id !== this.snackHumanId) return;
    const result = resolveSnackStopChoice(this.snack.state, optionIndex);
    this.pushSnackLog(result.entries);
    this.saveSnackGame();
    this.render();
    this.afterSnackAction();
  },

  snackBuyShopItem(itemId) {
    const result = buySnackShopItem(this.snack.state, this.snackHumanId, itemId);
    LifeRoadAudio.playSe(result.ok ? "confirm" : "error");
    if (result.ok) this.saveSnackGame();
    this.render();
  },

  snackUseItem(itemId) {
    const result = useSnackItem(this.snack.state, this.snackHumanId, itemId);
    if (result.ok) {
      this.pushSnackLog(result.entries || []);
      LifeRoadAudio.playSe("confirm");
      this.saveSnackGame();
    } else {
      LifeRoadAudio.playSe("error");
    }
    this.render();
  },

  snackEndTurn() {
    const player = currentSnackPlayer(this.snack.state);
    if (player.id !== this.snackHumanId) return;
    this.endSnackTurnAndContinue();
  },

  endSnackTurnAndContinue() {
    endSnackTurn(this.snack.state);
    this.saveSnackGame();
    this.render();
    if (this.snack.state.status === "finished") {
      this.finishSnackGame();
      return;
    }
    this.maybeRunSnackCPUTurn();
  },

  // 手番プレイヤーがCPUの場合、分岐/おやつ確認/選択イベント/ロールをApp側から自動進行する
  // (演出のタイミングを揃えるため、既存のmaybeRunCPUTurnと同様に短いsetTimeoutを挟む)。
  maybeRunSnackCPUTurn() {
    const state = this.snack && this.snack.state;
    if (!state || state.status !== "playing") return;

    if (state.pendingBranch) {
      const player = state.players.find((p) => p.id === state.pendingBranch.playerId);
      if (!player.isCPU) return;
      setTimeout(() => {
        if (!this.snack || !this.snack.state.pendingBranch) return;
        const choice = window.LifeRoadSnackCPU.cpuChooseSnackBranch(this.snack.state, player);
        const result = resolveSnackBranch(this.snack.state, choice);
        this.pushSnackLog(result.entries);
        this.saveSnackGame();
        this.render();
        this.afterSnackAction();
      }, 700);
      return;
    }
    if (state.pendingSnackChoice) {
      const player = state.players.find((p) => p.id === state.pendingSnackChoice.playerId);
      if (!player.isCPU) return;
      setTimeout(() => {
        if (!this.snack || !this.snack.state.pendingSnackChoice) return;
        const result = resolveSnackChoice(this.snack.state, window.LifeRoadSnackCPU.cpuDecideSnackPurchase());
        this.pushSnackLog(result.entries);
        this.saveSnackGame();
        this.render();
        this.afterSnackAction();
      }, 700);
      return;
    }
    if (state.pendingStopChoice) {
      const player = state.players.find((p) => p.id === state.pendingStopChoice.playerId);
      if (!player.isCPU) return;
      setTimeout(() => {
        if (!this.snack || !this.snack.state.pendingStopChoice) return;
        const idx = LifeRoadCPU.cpuDecideOption(this.snack.state.pendingStopChoice, player.personality);
        const result = resolveSnackStopChoice(this.snack.state, idx);
        this.pushSnackLog(result.entries);
        this.saveSnackGame();
        this.render();
        this.afterSnackAction();
      }, 700);
      return;
    }

    const player = currentSnackPlayer(state);
    if (!player.isCPU) return;
    if (!player.turnRolled) {
      setTimeout(() => {
        if (!this.snack || this.snack.state.status !== "playing") return;
        if (currentSnackPlayer(this.snack.state).id !== player.id) return;
        const itemId = window.LifeRoadSnackCPU.cpuDecideItemToUse(this.snack.state, player);
        if (itemId) useSnackItem(this.snack.state, player.id, itemId);
        this.runRouletteAnimation((roll) => {
          const result = rollSnackAndMove(this.snack.state, roll);
          this.pushSnackLog(result.entries);
          this.saveSnackGame();
          this.render();
          this.afterSnackAction();
        });
      }, 700);
      return;
    }
    // 移動・確認まで完了しているのにここへ来た場合(=CPUのターン終了待ち)
    setTimeout(() => this.endSnackTurnAndContinue(), 500);
  },

  // ロール・分岐・おやつ確認・選択イベントのいずれかを解決した直後に必ず呼ぶ。
  // ゲーム終了判定、CPU自動進行、および(CPUの移動が完了した場合の)自動ターン終了を行う。
  afterSnackAction() {
    const state = this.snack.state;
    if (state.status === "finished") {
      this.finishSnackGame();
      return;
    }
    if (state.pendingBranch || state.pendingSnackChoice || state.pendingStopChoice) {
      this.maybeRunSnackCPUTurn();
      return;
    }
    const player = currentSnackPlayer(state);
    if (player.isCPU && player.turnRolled && player.remainingSteps === 0) {
      this.endSnackTurnAndContinue();
      return;
    }
    this.maybeRunSnackCPUTurn();
  },

  finishSnackGame() {
    this.screen = "snack-result";
    this.clearSnackSave();
    this.render();
  },
};

document.addEventListener("DOMContentLoaded", () => App.init());
