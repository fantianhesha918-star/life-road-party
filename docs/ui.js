// ライフロード 画面描画

const SQUARE_ICON = {
  start: "🚩",
  event: "🎲",
  fortune: "🔮",
  job: "💼",
  payday: "💰",
  rest: "☕",
  goal: "🏁",
};

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[c]));
}

function renderTitleScreen(hasSave) {
  return `
    <section class="screen screen-title">
      <p class="lead">友達と通信、または一人でCPUと対戦して遊べる、人生ゲーム風すごろくです。</p>
      ${hasSave ? `<button class="btn btn-primary" onclick="App.continueGame()">続きから再開する</button>` : ""}
      <button class="btn ${hasSave ? "" : "btn-primary"}" onclick="App.goSetup()">一人で遊ぶ(CPU対戦)</button>
      <button class="btn" onclick="App.goOnlineMenu()">友達と通信して遊ぶ</button>
    </section>
  `;
}

function renderOnlineMenuScreen(error, busy, lastRoom) {
  const sizeOptions = [2, 3, 4, 5, 6]
    .map((n) => `<option value="${n}" ${n === 4 ? "selected" : ""}>${n}人まで</option>`)
    .join("");
  return `
    <section class="screen screen-online-menu">
      <h2>通信対戦</h2>
      ${error ? `<p class="error-text">${escapeHtml(error)}</p>` : ""}
      ${
        lastRoom
          ? `<button class="btn btn-primary" ${busy ? "disabled" : ""} onclick="App.resumeOnlineRoom()">前回の部屋(${escapeHtml(lastRoom.roomCode)})に戻る</button>`
          : ""
      }
      <label class="field">
        <span>あなたのニックネーム</span>
        <input id="online-nickname-input" type="text" maxlength="10" value="プレイヤー" />
      </label>

      <div class="field">
        <h3>部屋を作る</h3>
        <label class="field">
          <span>最大人数</span>
          <select id="online-maxplayers-select">${sizeOptions}</select>
        </label>
        <button class="btn btn-primary" ${busy ? "disabled" : ""} onclick="App.createOnlineRoom()">部屋を作る</button>
      </div>

      <div class="field">
        <h3>部屋に入る</h3>
        <label class="field">
          <span>部屋番号(友達に聞いてください)</span>
          <input id="online-roomcode-input" type="text" maxlength="6" placeholder="例: A3F9K2" />
        </label>
        <button class="btn btn-primary" ${busy ? "disabled" : ""} onclick="App.joinOnlineRoom()">部屋に入る</button>
      </div>

      <button class="btn" onclick="App.goTitle()">戻る</button>
    </section>
  `;
}

function renderOnlineLobbyScreen(room, roomCode, myUid) {
  const players = Object.entries(room.players || {}).sort(
    (a, b) => (a[1].seatIndex || 0) - (b[1].seatIndex || 0)
  );
  const rows = players
    .map(([uid, p]) => {
      const tags = [uid === room.hostUid ? "ホスト" : null, uid === myUid ? "あなた" : null]
        .filter(Boolean)
        .join("・");
      return `
        <li class="player-row">
          <span class="p-name">${escapeHtml(p.nickname)}</span>
          ${tags ? `<span class="badge">${tags}</span>` : ""}
        </li>
      `;
    })
    .join("");
  const isHost = room.hostUid === myUid;
  const canStart = players.length >= 2;
  return `
    <section class="screen screen-online-lobby">
      <h2>部屋番号</h2>
      <div class="room-code">${escapeHtml(roomCode)}</div>
      <p class="lead">この番号を友達に伝えてください(現在 ${players.length}/${room.maxPlayers}人)</p>
      <ul class="player-list">${rows}</ul>
      ${
        isHost
          ? `<button class="btn btn-primary" ${canStart ? "" : "disabled"} onclick="App.startOnlineGame()">対戦を開始する</button>`
          : `<p class="lead">ホストが開始するのを待っています…</p>`
      }
      <button class="btn" onclick="App.leaveOnlineRoom()">退出する</button>
    </section>
  `;
}

function renderSetupScreen() {
  const cpuOptions = [1, 2, 3, 4, 5]
    .map((n) => `<option value="${n}">CPU ${n}人(合計${n + 1}人)</option>`)
    .join("");
  return `
    <section class="screen screen-setup">
      <h2>対戦の設定</h2>
      <label class="field">
        <span>あなたのニックネーム</span>
        <input id="nickname-input" type="text" maxlength="10" value="プレイヤー" />
      </label>
      <label class="field">
        <span>CPU人数</span>
        <select id="cpu-count-select">${cpuOptions}</select>
      </label>
      <button class="btn btn-primary" onclick="App.startGame()">この設定で始める</button>
      <button class="btn" onclick="App.goTitle()">戻る</button>
    </section>
  `;
}

function renderBoard(state) {
  const cells = BOARD_SQUARES.map((sq) => {
    const tokens = state.players
      .filter((p) => p.position === sq.index)
      .map((p) => `<span class="token" style="background:${p.color}" title="${escapeHtml(p.name)}"></span>`)
      .join("");
    return `
      <div class="cell cell-${sq.type}">
        <div class="cell-index">${sq.index}</div>
        <div class="cell-icon">${SQUARE_ICON[sq.type] || ""}</div>
        <div class="cell-label">${sq.label}</div>
        <div class="cell-tokens">${tokens}</div>
      </div>
    `;
  }).join("");
  return `<div class="board">${cells}</div>`;
}

function renderPlayerList(state) {
  const rows = state.players.map((p, i) => {
    const isTurn = i === state.currentTurnIndex && state.status === "playing";
    return `
      <li class="player-row ${isTurn ? "is-turn" : ""} ${p.finished ? "is-finished" : ""}">
        <span class="swatch" style="background:${p.color}"></span>
        <span class="p-name">${escapeHtml(p.name)}${p.isCPU ? "(CPU)" : ""}</span>
        <span class="p-job">${p.job ? escapeHtml(p.job.name) : "無職"}</span>
        <span class="p-money">${p.money}万円</span>
        ${p.finished ? '<span class="badge">ゴール</span>' : ""}
      </li>
    `;
  }).join("");
  return `<ul class="player-list">${rows}</ul>`;
}

function renderLog(entries) {
  const items = entries.slice(0, 40).map((e) => `<li class="log-${e.type}">${escapeHtml(e.text)}</li>`).join("");
  return `<ul class="log-list">${items}</ul>`;
}

function renderJobModal(pendingChoice, mode) {
  if (!pendingChoice) return "";
  const chooseFn = mode === "online" ? "App.chooseOnlineJob" : "App.chooseJob";
  const offerButtons = pendingChoice.offers
    .map((o, i) => `<button class="btn btn-offer" onclick="${chooseFn}(${i})">${escapeHtml(o.name)}(給料${o.salary}万円/回)</button>`)
    .join("");
  return `
    <div class="modal-backdrop">
      <div class="modal">
        <h3>就職の関門</h3>
        <p>どちらの仕事に就きますか？</p>
        ${offerButtons}
      </div>
    </div>
  `;
}

function renderGameScreen(state, log, humanId, mode) {
  const rollFn = mode === "online" ? "App.handleOnlineRoll" : "App.handleRoll";
  const turnPlayer = state.players[state.currentTurnIndex];
  const isHumanTurn = state.status === "playing" && turnPlayer && turnPlayer.id === humanId && !state.pendingChoice;
  const rollDisabled = !isHumanTurn;
  return `
    <section class="screen screen-game">
      <div class="turn-banner">${state.status === "playing" ? `${escapeHtml(turnPlayer.name)} の番です` : "ゲーム終了"}</div>
      ${renderBoard(state)}
      ${renderPlayerList(state)}
      <button id="roll-btn" class="btn btn-primary" ${rollDisabled ? "disabled" : ""} onclick="${rollFn}()">サイコロを振る</button>
      <h3>できごとログ</h3>
      ${renderLog(log)}
      ${renderJobModal(state.pendingChoice && state.pendingChoice.playerId === humanId ? state.pendingChoice : null, mode)}
    </section>
  `;
}

function renderResultScreen(state, mode) {
  const ranking = getRanking(state);
  const rows = ranking.map((p, i) => `
    <li class="result-row">
      <span class="result-rank">${i + 1}位</span>
      <span class="swatch" style="background:${p.color}"></span>
      <span class="p-name">${escapeHtml(p.name)}${p.isCPU ? "(CPU)" : ""}</span>
      <span class="p-job">${p.job ? escapeHtml(p.job.name) : "無職"}</span>
      <span class="p-money">${p.money}万円</span>
    </li>
  `).join("");
  const buttons = mode === "online"
    ? `<button class="btn btn-primary" onclick="App.leaveOnlineRoom()">タイトルへ戻る</button>`
    : `
      <button class="btn btn-primary" onclick="App.goSetup()">もう一度遊ぶ</button>
      <button class="btn" onclick="App.goTitle()">タイトルへ</button>
    `;
  return `
    <section class="screen screen-result">
      <h2>結果発表</h2>
      <ul class="result-list">${rows}</ul>
      ${buttons}
    </section>
  `;
}
