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
      <button class="btn btn-disabled" disabled>友達と通信して遊ぶ(準備中)</button>
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

function renderJobModal(pendingChoice) {
  if (!pendingChoice) return "";
  const offerButtons = pendingChoice.offers
    .map((o, i) => `<button class="btn btn-offer" onclick="App.chooseJob(${i})">${escapeHtml(o.name)}(給料${o.salary}万円/回)</button>`)
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

function renderGameScreen(state, log, humanId) {
  const human = state.players.find((p) => p.id === humanId);
  const turnPlayer = state.players[state.currentTurnIndex];
  const isHumanTurn = state.status === "playing" && turnPlayer && turnPlayer.id === humanId && !state.pendingChoice;
  const rollDisabled = !isHumanTurn;
  return `
    <section class="screen screen-game">
      <div class="turn-banner">${state.status === "playing" ? `${escapeHtml(turnPlayer.name)} の番です` : "ゲーム終了"}</div>
      ${renderBoard(state)}
      ${renderPlayerList(state)}
      <button id="roll-btn" class="btn btn-primary" ${rollDisabled ? "disabled" : ""} onclick="App.handleRoll()">サイコロを振る</button>
      <h3>できごとログ</h3>
      ${renderLog(log)}
      ${renderJobModal(state.pendingChoice && state.pendingChoice.playerId === humanId ? state.pendingChoice : null)}
    </section>
  `;
}

function renderResultScreen(state) {
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
  return `
    <section class="screen screen-result">
      <h2>結果発表</h2>
      <ul class="result-list">${rows}</ul>
      <button class="btn btn-primary" onclick="App.goSetup()">もう一度遊ぶ</button>
      <button class="btn" onclick="App.goTitle()">タイトルへ</button>
    </section>
  `;
}
