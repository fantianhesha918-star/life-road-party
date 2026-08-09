// ライフロード 画面描画

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[c]));
}

function renderAvatarBadge(visual, size) {
  const px = size || 28;
  const speciesSize = Math.round(px * 0.7);
  const hatSize = Math.round(px * 0.55);
  const accSize = Math.round(px * 0.45);
  return `
    <span class="avatar-badge" style="width:${px}px;height:${px}px;background:${visual.color}">
      ${visual.speciesEmoji ? `<span class="avatar-species" style="font-size:${speciesSize}px">${visual.speciesEmoji}</span>` : ""}
      ${visual.hatEmoji ? `<span class="avatar-hat" style="font-size:${hatSize}px">${visual.hatEmoji}</span>` : ""}
      ${visual.accessoryEmoji ? `<span class="avatar-acc" style="font-size:${accSize}px">${visual.accessoryEmoji}</span>` : ""}
    </span>
  `;
}

function renderTitleScreen(hasSave, profile) {
  const visual = LifeRoadProfile.getAvatarVisual(profile.equipped);
  return `
    <section class="screen screen-title">
      <div class="title-profile-row">
        ${renderAvatarBadge(visual, 40)}
        <span class="coin-display">🪙 ${profile.coins}</span>
      </div>
      <p class="lead">友達と通信、または一人でCPUと対戦して遊べる、人生ゲーム風すごろくです。</p>
      ${hasSave ? `<button class="btn btn-primary" onclick="App.continueGame()">続きから再開する</button>` : ""}
      <button class="btn ${hasSave ? "" : "btn-primary"}" onclick="App.goSetup()">一人で遊ぶ(CPU対戦)</button>
      <button class="btn" onclick="App.goOnlineMenu()">友達と通信して遊ぶ</button>
      <button class="btn" onclick="App.goProfile()">キャラクターを編集</button>
      <button class="btn" onclick="App.goShop()">ショップ</button>
    </section>
  `;
}

function renderProfileScreen(profile) {
  const visual = LifeRoadProfile.getAvatarVisual(profile.equipped);
  const categories = [
    { key: "species", label: "動物の種類", allowNone: false },
    { key: "color", label: "色", allowNone: false },
    { key: "hat", label: "帽子", allowNone: true },
    { key: "accessory", label: "アクセサリー", allowNone: true },
  ];
  const sections = categories
    .map((cat) => {
      const owned = ALL_ITEMS.filter((it) => it.category === cat.key && profile.ownedItems.includes(it.id));
      const noneButton = cat.allowNone
        ? `<button class="btn item-btn ${!profile.equipped[cat.key] ? "item-equipped" : ""}" onclick="App.equipAvatarItem('${cat.key}', null)">なし</button>`
        : "";
      const itemButtons = owned
        .map((it) => {
          const isEquipped = profile.equipped[cat.key] === it.id;
          const preview = it.category === "color" ? `<span class="swatch" style="background:${it.value}"></span>` : it.emoji;
          return `<button class="btn item-btn ${isEquipped ? "item-equipped" : ""}" onclick="App.equipAvatarItem('${cat.key}', '${it.id}')">${preview} ${escapeHtml(it.name)}</button>`;
        })
        .join("");
      return `
        <div class="field">
          <h3>${cat.label}</h3>
          <div class="item-grid">${noneButton}${itemButtons}</div>
        </div>
      `;
    })
    .join("");
  return `
    <section class="screen screen-profile">
      <h2>キャラクターを編集</h2>
      <div class="avatar-preview">${renderAvatarBadge(visual, 72)}</div>
      <p class="coin-display">🪙 ${profile.coins}</p>
      ${sections}
      <button class="btn" onclick="App.goShop()">ショップへ</button>
      <button class="btn" onclick="App.goTitle()">タイトルへ戻る</button>
    </section>
  `;
}

function renderShopScreen(profile) {
  const categories = [
    { key: "color", label: "色" },
    { key: "hat", label: "帽子" },
    { key: "accessory", label: "アクセサリー" },
  ];
  const sections = categories
    .map((cat) => {
      const items = ALL_ITEMS.filter((it) => it.category === cat.key);
      const rows = items
        .map((it) => {
          const owned = profile.ownedItems.includes(it.id);
          const canBuy = !owned && profile.coins >= it.price;
          const preview = it.category === "color" ? `<span class="swatch" style="background:${it.value}"></span>` : it.emoji;
          const actionLabel = owned ? "所持済み" : `🪙${it.price} で購入`;
          return `
            <li class="player-row">
              <span>${preview}</span>
              <span class="p-name">${escapeHtml(it.name)}</span>
              <button class="btn btn-offer" ${owned || !canBuy ? "disabled" : ""} onclick="App.buyShopItem('${it.id}')">${actionLabel}</button>
            </li>
          `;
        })
        .join("");
      return `<div class="field"><h3>${cat.label}</h3><ul class="player-list">${rows}</ul></div>`;
    })
    .join("");
  const consumableRows = CONSUMABLE_ITEMS
    .map((it) => {
      const count = (profile.consumables && profile.consumables[it.id]) || 0;
      const canBuy = profile.coins >= it.price;
      return `
        <li class="player-row">
          <span>${it.emoji}</span>
          <span class="p-name">${escapeHtml(it.name)}${count > 0 ? `(所持${count}個)` : ""}</span>
          <button class="btn btn-offer" ${canBuy ? "" : "disabled"} onclick="App.buyShopItem('${it.id}')">🪙${it.price} で購入</button>
        </li>
      `;
    })
    .join("");
  const consumableSection = `<div class="field"><h3>消耗品(対戦中に使える)</h3><ul class="player-list">${consumableRows}</ul></div>`;
  return `
    <section class="screen screen-shop">
      <h2>ショップ</h2>
      <p class="coin-display">🪙 ${profile.coins}</p>
      ${sections}
      ${consumableSection}
      <button class="btn" onclick="App.goProfile()">キャラクター編集へ</button>
      <button class="btn" onclick="App.goTitle()">タイトルへ戻る</button>
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
      const visual = p.avatar || { color: "#999999", speciesEmoji: null, hatEmoji: null, accessoryEmoji: null };
      return `
        <li class="player-row">
          ${renderAvatarBadge(visual, 26)}
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

function renderPlayerList(state) {
  const rows = state.players.map((p, i) => {
    const isTurn = i === state.currentTurnIndex && state.status === "playing";
    const visual = p.avatar || { color: p.color, speciesEmoji: null, hatEmoji: null, accessoryEmoji: null };
    return `
      <li class="player-row ${isTurn ? "is-turn" : ""} ${p.finished ? "is-finished" : ""}">
        ${renderAvatarBadge(visual, 26)}
        <span class="p-name">${escapeHtml(p.name)}${p.isCPU ? `(CPU${LifeRoadCPU.personalityLabel(p.personality) ? "・" + LifeRoadCPU.personalityLabel(p.personality) : ""})` : ""}</span>
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

// 進行画面には常時表示せず、ログボタンから開くモーダルとして表示する。
// 自分の手番中はターンハブ(.turn-hub-modal、z-index20)からも開けるため、
// それより手前に表示されるよう専用クラス(log-modal、z-index25)を付ける。
function renderLogModal(entries) {
  return `
    <div class="modal-backdrop log-modal">
      <div class="modal">
        <h3>できごとログ</h3>
        ${renderLog(entries)}
        <button class="btn" onclick="App.toggleLog()">閉じる</button>
      </div>
    </div>
  `;
}

// cpuName有り=CPUが選択中の画面。人間が誤って押して二重確定させないよう、
// 選択肢はdisabledのまま見せるだけにする(押せる選択肢は人間自身の番のときのみ)。
function renderChoiceModal(pendingChoice, mode, cpuName) {
  if (!pendingChoice) return "";
  if (cpuName) {
    const optionItems = pendingChoice.options
      .map((o) => `<button class="btn btn-offer btn-disabled" disabled>${escapeHtml(o.label)}</button>`)
      .join("");
    return `
      <div class="modal-backdrop">
        <div class="modal">
          <div class="modal-telop">
            <h3>${escapeHtml(pendingChoice.title)}</h3>
            <p>${escapeHtml(cpuName)}が考え中…</p>
          </div>
          ${optionItems}
        </div>
      </div>
    `;
  }
  const chooseFn = mode === "online" ? "App.chooseOnlineOption" : "App.chooseOption";
  const optionButtons = pendingChoice.options
    .map((o, i) => `<button class="btn btn-offer" onclick="${chooseFn}(${i})">${escapeHtml(o.label)}</button>`)
    .join("");
  return `
    <div class="modal-backdrop">
      <div class="modal">
        <div class="modal-telop">
          <h3>${escapeHtml(pendingChoice.title)}</h3>
          <p>${escapeHtml(pendingChoice.prompt)}</p>
        </div>
        ${optionButtons}
      </div>
    </div>
  `;
}

// 選択イベントの結果を見せる一コマ演出。人間自身の選択(dismissFn有り)は
// 「つぎへ」を押すまでターンが進まない。CPUの選択(dismissFn無し)はApp側の
// タイマーで自動的に閉じるので、押せないことが分かるよう「…」だけ表示する。
function renderRevealCard(reveal, visual, dismissFn) {
  if (!reveal) return "";
  const deltaClass = reveal.delta > 0 ? "reveal-delta-positive" : reveal.delta < 0 ? "reveal-delta-negative" : "";
  const deltaText = reveal.delta ? `<p class="reveal-delta ${deltaClass}">${reveal.delta > 0 ? "+" : ""}${reveal.delta}万円</p>` : "";
  const actionHtml = dismissFn
    ? `<button class="btn btn-primary" onclick="${dismissFn}()">つぎへ</button>`
    : `<p class="lead">…</p>`;
  return `
    <div class="turn-hub-modal">
      <div class="turn-hub-card">
        <div class="turn-hub-avatar">${renderAvatarBadge(visual, 72)}</div>
        <p class="lead">${escapeHtml(reveal.text)}</p>
        ${deltaText}
        ${actionHtml}
      </div>
    </div>
  `;
}

// ゲーム画面ではヘッダーの「アニマルライフ」文字の代わりに手番表示を差し込む
// (App.syncHeader()がgame/online-game画面のときだけこれをヘッダーへ反映する)。
// overridePlayerIdは、ホップ移動アニメーション中に「まだ移動を演出しているプレイヤー」を
// 表示させ続けるための指定(state.currentTurnIndexは移動開始前に次の手番へ進んでしまうため)。
function renderHeaderTurnContent(state, overridePlayerId) {
  if (!state) return "アニマルライフ";
  if (state.status !== "playing") return "ゲーム終了";
  const turnPlayer = overridePlayerId
    ? state.players.find((p) => p.id === overridePlayerId)
    : state.players[state.currentTurnIndex];
  if (!turnPlayer) return "アニマルライフ";
  const visual = turnPlayer.avatar || { color: turnPlayer.color, speciesEmoji: null, hatEmoji: null, accessoryEmoji: null };
  return `${renderAvatarBadge(visual, 28)}<span>${escapeHtml(turnPlayer.name)} の番です</span>`;
}

function renderTurnHub(state, humanId, profile, hub) {
  const turnPlayer = state.players[state.currentTurnIndex];
  const visual = turnPlayer.avatar || { color: turnPlayer.color, speciesEmoji: null, hatEmoji: null, accessoryEmoji: null };
  const view = (hub && hub.view) || "menu";

  // 通常時(menu)は毎ターン表示される最も頻度の高い画面のため、マップを隠さない
  // 細い横並びバーにする(ルーレット操作等はサブ画面に遷移したときだけ大きいカードを使う)。
  if (view === "menu") {
    return `
      <div class="hub-bar">
        ${renderAvatarBadge(visual, 32)}
        <button class="hub-bar-btn hub-bar-btn-primary" onclick="App.spinRoulette()">
          <span class="hub-bar-icon">🎡</span><span class="hub-bar-label">ルーレット</span>
        </button>
        <button class="hub-bar-btn" onclick="App.showHubView('items')">
          <span class="hub-bar-icon">🎒</span><span class="hub-bar-label">アイテム</span>
        </button>
        <button class="hub-bar-btn" onclick="App.showHubView('status')">
          <span class="hub-bar-icon">📊</span><span class="hub-bar-label">ステータス</span>
        </button>
        <button class="hub-bar-btn" onclick="App.toggleLog()">
          <span class="hub-bar-icon">📜</span><span class="hub-bar-label">ログ</span>
        </button>
      </div>
    `;
  }

  let body;
  if (view === "spinning") {
    body = `
      <div class="roulette-display">
        <div class="roulette-wheel-wrap">
          <div class="roulette-pointer">▼</div>
          <div class="roulette-wheel"></div>
          <div class="roulette-wheel-number">${hub.spinNumber}</div>
        </div>
        <p class="lead">ルーレットが回転中…</p>
      </div>
    `;
  } else if (view === "status") {
    const me = state.players.find((p) => p.id === humanId);
    body = `
      ${renderPlayerList(state)}
      <p class="lead">${me.job ? `給料: ${me.job.salary}万円/回` : "まだ就職していません(給料日はアルバイト収入)"}</p>
      <button class="btn" onclick="App.showHubView('menu')">戻る</button>
    `;
  } else if (view === "items") {
    const owned = Object.entries(profile.consumables || {}).filter(([, count]) => count > 0);
    const rows = owned.length
      ? owned
          .map(([id, count]) => {
            const item = findShopItem(id);
            if (!item) return "";
            return `
              <li class="player-row">
                <span>${item.emoji}</span>
                <span class="p-name">${escapeHtml(item.name)}(所持${count}個)</span>
                <button class="btn btn-offer" onclick="App.useConsumable('${id}')">使う</button>
              </li>
            `;
          })
          .join("")
      : `<p class="lead">消耗品を持っていません。ショップで購入できます。</p>`;
    body = `
      <ul class="player-list">${rows}</ul>
      ${hub.itemMessage ? `<p class="coin-display">${escapeHtml(hub.itemMessage)}</p>` : ""}
      <button class="btn" onclick="App.showHubView('menu')">戻る</button>
    `;
  }

  return `
    <div class="turn-hub-modal">
      <div class="turn-hub-card">
        <div class="turn-hub-avatar">${renderAvatarBadge(visual, 72)}</div>
        <h3>${escapeHtml(turnPlayer.name)} のターン！</h3>
        ${body}
      </div>
    </div>
  `;
}

function renderGameScreen(state, log, humanId, mode, profile, hub, reveal, logOpen, hopping) {
  const turnPlayer = state.players[state.currentTurnIndex];
  const isCPUTurn = !!(turnPlayer && turnPlayer.id !== humanId);
  // state.currentTurnIndexはホップ移動が始まる前に次の手番へ進んでしまうため(applyRoll内で
  // 同期的に advanceTurn される)、hopping中は「まだ移動アニメーションを見せている最中」として
  // 操作バーを出さない(出さないと、CPUの移動中に人間側の手番が来たと誤認して操作できてしまう)。
  const isHumanTurn = state.status === "playing" && turnPlayer && !isCPUTurn && !state.pendingChoice && !reveal && !hopping;
  // CPUの手番中も「今何をしているか」が見えるよう、ルーレット演出(hub.view==="spinning")は
  // 主体を問わず表示する(アイテム/ステータス等の操作サブ画面は人間専用のまま)。
  const showCPUSpinning = isCPUTurn && !hopping && hub && hub.view === "spinning";
  // revealは選択確定(resolveChoice)後に作られるが、その時点でstate.currentTurnIndexは
  // 既に次の手番へ進んでいるため、誰の演出かはturnPlayerからではなくreveal.visual
  // (作成時に埋め込み済み)から判断する。reveal.interactiveがfalseのCPU分は
  // 「つぎへ」ボタンを出さず、App側のタイマーで自動的に閉じる。
  const dismissFn = !reveal || reveal.interactive === false ? null : mode === "online" ? "App.dismissOnlineReveal" : "App.dismissReveal";
  // 選択モーダルはキャラクターがマスに到着してから表示する(ホップ移動中は出さない)。
  // pendingChoiceは常に「今の手番のプレイヤー」のものなので、CPUの選択中も見せる
  // (ただし押せない表示にして、人間の誤操作による二重確定を防ぐ)。
  return `
    <section class="screen screen-game">
      ${isHumanTurn || showCPUSpinning ? renderTurnHub(state, humanId, profile, hub) : ""}
      ${!reveal && !hopping ? renderChoiceModal(state.pendingChoice, mode, isCPUTurn ? turnPlayer.name : null) : ""}
      ${renderRevealCard(reveal, reveal && reveal.visual, dismissFn)}
      ${logOpen ? renderLogModal(log) : ""}
    </section>
  `;
}

function renderResultScreen(state, mode, rewardCoins) {
  const ranking = getRanking(state);
  const rows = ranking.map((p, i) => {
    const visual = p.avatar || { color: p.color, speciesEmoji: null, hatEmoji: null, accessoryEmoji: null };
    return `
    <li class="result-row">
      <span class="result-rank">${i + 1}位</span>
      ${renderAvatarBadge(visual, 26)}
      <span class="p-name">${escapeHtml(p.name)}${p.isCPU ? `(CPU${LifeRoadCPU.personalityLabel(p.personality) ? "・" + LifeRoadCPU.personalityLabel(p.personality) : ""})` : ""}</span>
      <span class="p-job">${p.job ? escapeHtml(p.job.name) : "無職"}</span>
      <span class="p-money">${p.money}万円</span>
    </li>
  `;
  }).join("");
  const rewardHtml = typeof rewardCoins === "number" ? `<p class="coin-display">獲得コイン: +${rewardCoins} 🪙</p>` : "";
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
      ${rewardHtml}
      ${buttons}
    </section>
  `;
}
