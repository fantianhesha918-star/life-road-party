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

// speciesIdから実イラスト(docs/avatars/、shop-data.jsのSPECIES_ITEMS.avatarImage)を引く。
// 絵文字より優先して使う(見つからない場合は従来通り絵文字にフォールバック)。
function findAvatarImage(speciesId) {
  if (!speciesId) return null;
  const item = SPECIES_ITEMS.find((it) => it.id === speciesId);
  return (item && item.avatarImage) || null;
}

function renderAvatarBadge(visual, size) {
  const px = size || 28;
  const speciesSize = Math.round(px * 0.7);
  const avatarImage = visual.costumeImage || findAvatarImage(visual.speciesId);
  const speciesVisual = avatarImage
    ? `<img class="avatar-species-img" src="${avatarImage}" alt="" />`
    : visual.speciesEmoji
    ? `<span class="avatar-species" style="font-size:${speciesSize}px">${visual.speciesEmoji}</span>`
    : "";
  return `
    <span class="avatar-badge" style="width:${px}px;height:${px}px;background:${visual.color}">
      ${speciesVisual}
    </span>
  `;
}

// 消耗品アイテムのアイコン表示。item.image(Codex作成の実イラスト)があれば絵文字より優先する。
function renderItemIcon(item, size) {
  const px = size || 26;
  if (item && item.image) {
    return `<img class="item-icon-img" src="${item.image}" alt="" style="width:${px}px;height:${px}px;" />`;
  }
  return `<span style="font-size:${Math.round(px * 0.85)}px">${(item && item.emoji) || ""}</span>`;
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
      ${App.hasSnackSave() ? `<button class="btn btn-primary" onclick="App.continueSnackGame()">🍪 おやつ集めモードの続きから</button>` : ""}
      <button class="btn" onclick="App.goSnackSetup()">🍪 おやつ集めモード(試作)で遊ぶ</button>
      <button class="btn" onclick="App.goProfile()">キャラクターを編集</button>
      <button class="btn" onclick="App.goShop()">ショップ</button>
      <button class="btn" onclick="App.goHelp()">📖 遊び方</button>
      <button class="btn" onclick="App.goStats()">📊 記録</button>
      <button class="btn" onclick="App.goSettings()">⚙️ 設定</button>
    </section>
  `;
}

function renderSettingsScreen(audioSettings) {
  return `
    <section class="screen screen-settings">
      <h2>設定</h2>
      <div class="field">
        <h3>BGM</h3>
        <label class="settings-toggle-row">
          <span>BGMを再生する</span>
          <input type="checkbox" ${audioSettings.bgmOn ? "checked" : ""} onchange="App.setAudioSetting('bgmOn', this.checked)" />
        </label>
        <label class="field">
          <span>BGM音量(${Math.round(audioSettings.bgmVolume * 100)}%)</span>
          <input type="range" min="0" max="100" value="${Math.round(audioSettings.bgmVolume * 100)}" ${audioSettings.bgmOn ? "" : "disabled"} oninput="App.setAudioSetting('bgmVolume', this.value / 100)" />
        </label>
      </div>
      <div class="field">
        <h3>効果音</h3>
        <label class="settings-toggle-row">
          <span>効果音を再生する</span>
          <input type="checkbox" ${audioSettings.seOn ? "checked" : ""} onchange="App.setAudioSetting('seOn', this.checked)" />
        </label>
        <label class="field">
          <span>効果音音量(${Math.round(audioSettings.seVolume * 100)}%)</span>
          <input type="range" min="0" max="100" value="${Math.round(audioSettings.seVolume * 100)}" ${audioSettings.seOn ? "" : "disabled"} oninput="App.setAudioSetting('seVolume', this.value / 100)" />
        </label>
        <button class="btn" onclick="App.testPlaySe()">🔊 効果音をテスト再生</button>
      </div>
      <button class="btn" onclick="App.goTitle()">タイトルへ戻る</button>
    </section>
  `;
}

function renderHelpScreen() {
  return `
    <section class="screen screen-help">
      <h2>遊び方</h2>
      <div class="field">
        <h3>基本ルール</h3>
        <p class="lead">ルーレット(1〜10)を回してマスを進み、ゴールを目指す人生ゲーム風すごろくです。就職・結婚・出産・マイホーム購入・株の売買など、人生の出来事を体験しながらお金を増やしていきます。全員がゴールしたあと、こども・株・マイホームなどの清算を経て最終的な所持金の多い順に順位が決まります。</p>
      </div>
      <div class="field">
        <h3>遊び方の流れ</h3>
        <p class="lead">1. 自分の番になったら「🎡ルーレット」を回してマスを進みます。<br>2. 止まったマスの内容(できごと・給料日・選択肢など)がテロップで表示されます。選べるマスでは選択肢から1つ選んでください。<br>3. 「🎒アイテム」で購入済みの消耗品を、「📊ステータス」で自分の状況を確認できます。</p>
      </div>
      <div class="field">
        <h3>主なマスの種類</h3>
        <p class="lead">💼 就職・できごと・運命の分かれ道(選択あり)・給料日・ひと休み(1回休み)・💍結婚(お祝い金を受け取る)・👶 こども誕生・🏠 マイホーム購入・🔥 火災・🔁 家の交換・💹 株の売買、などがあります。</p>
      </div>
      <div class="field">
        <h3>キャラクター・ショップ</h3>
        <p class="lead">タイトル画面の「キャラクターを編集」で見た目(動物の種類・色・コスチューム)を変更できます。「ショップ」では対戦後にもらえるコイン🪙で色・コスチューム・消耗品アイテムを購入できます。</p>
      </div>
      <button class="btn" onclick="App.goTitle()">タイトルへ戻る</button>
    </section>
  `;
}

function renderStatsScreen(stats) {
  return `
    <section class="screen screen-stats">
      <h2>記録</h2>
      <ul class="player-list">
        <li class="player-row"><span class="p-name">プレイ回数</span><span class="p-money">${stats.gamesPlayed}回</span></li>
        <li class="player-row"><span class="p-name">獲得コイン累計</span><span class="p-money">🪙${stats.totalCoinsEarned}</span></li>
        <li class="player-row"><span class="p-name">ゴール1位の回数</span><span class="p-money">${stats.firstPlaceCount}回</span></li>
        <li class="player-row"><span class="p-name">最高所持金</span><span class="p-money">${stats.bestMoney}万円</span></li>
      </ul>
      <button class="btn" onclick="App.goTitle()">タイトルへ戻る</button>
    </section>
  `;
}

// 動物の種類選択カード。角丸の正方形にアイコンを大きめに表示する専用レイアウト
// (色の小さなチップ選択とは別の見た目にして、一番大事な選択であることを目立たせる)。
function renderSpeciesCard(item, isEquipped) {
  const iconHtml = item.avatarImage
    ? `<img class="species-card-img" src="${item.avatarImage}" alt="" />`
    : `<span class="species-card-emoji">${item.emoji}</span>`;
  return `
    <button class="species-card ${isEquipped ? "species-card-selected" : ""}" onclick="App.equipAvatarItem('species', '${item.id}')" title="${escapeHtml(item.name)}">
      <span class="species-card-icon">${iconHtml}</span>
      <span class="species-card-name">${escapeHtml(item.shortName || item.name)}</span>
    </button>
  `;
}

// 所持中コスチュームの装備切替カード(現在選択中の動物種に合わせたイラストを表示)。
function renderCostumeEquipCard(item, speciesId, isEquipped) {
  const img = item.images[speciesId];
  const iconHtml = img ? `<img class="item-icon-img" src="${img}" alt="" />` : `<span class="shop-item-emoji">${item.emoji}</span>`;
  const badgeHtml = isEquipped ? `<span class="badge badge-equipped">装着中</span>` : "";
  const actionHtml = isEquipped
    ? `<button class="btn btn-offer shop-card-btn" onclick="App.equipAvatarItem('costume', null)">解除する</button>`
    : `<button class="btn btn-offer shop-card-btn" onclick="App.equipAvatarItem('costume', '${item.id}')">装備する</button>`;
  return renderShopCard({ iconHtml, name: escapeHtml(item.name), badgeHtml, actionHtml });
}

function renderProfileScreen(profile) {
  const visual = LifeRoadProfile.getAvatarVisual(profile.equipped);
  const speciesOwned = SPECIES_ITEMS.filter((it) => profile.ownedItems.includes(it.id));
  const speciesSection = `
    <div class="field">
      <h3>動物の種類</h3>
      <div class="species-grid">${speciesOwned.map((it) => renderSpeciesCard(it, profile.equipped.species === it.id)).join("")}</div>
    </div>
  `;
  const colorOwned = ALL_ITEMS.filter((it) => it.category === "color" && profile.ownedItems.includes(it.id));
  const colorButtons = colorOwned
    .map((it) => {
      const isEquipped = profile.equipped.color === it.id;
      return `<button class="btn item-btn ${isEquipped ? "item-equipped" : ""}" onclick="App.equipAvatarItem('color', '${it.id}')"><span class="swatch" style="background:${it.value}"></span> ${escapeHtml(it.name)}</button>`;
    })
    .join("");
  const colorSection = `<div class="field"><h3>色</h3><div class="item-grid">${colorButtons}</div></div>`;

  const costumeOwned = COSTUME_ITEMS.filter((it) => profile.ownedItems.includes(it.id));
  const costumeCards = costumeOwned.length
    ? costumeOwned.map((it) => renderCostumeEquipCard(it, profile.equipped.species, profile.equipped.costume === it.id)).join("")
    : `<p class="lead shop-grid-empty">まだコスチュームを持っていません。ショップで購入できます。</p>`;
  const costumeSection = `<div class="field"><h3>コスチューム</h3><div class="shop-grid">${costumeCards}</div></div>`;

  return `
    <section class="screen screen-profile">
      <h2>キャラクターを編集</h2>
      <div class="avatar-preview">${renderAvatarBadge(visual, 72)}</div>
      <p class="coin-display">🪙 ${profile.coins}</p>
      ${speciesSection}
      ${colorSection}
      ${costumeSection}
      <button class="btn" onclick="App.goShop()">ショップへ</button>
      <button class="btn" onclick="App.goTitle()">タイトルへ戻る</button>
    </section>
  `;
}

function renderShopToast(toast) {
  if (!toast) return "";
  return `
    <div class="shop-toast">
      ${renderItemIcon(toast, 32)}
      <span>「${escapeHtml(toast.name)}」を手に入れた！</span>
    </div>
  `;
}

// 購入ボタンのラベル。コイン不足の場合は「あと◯」を添えて、コイン獲得の目標を
// 見た目だけで判断できるようにする(レビュー指摘対応、2026-08-11)。
function buyButtonLabel(price, coins) {
  const shortage = price - coins;
  return shortage > 0 ? `🪙${price}<span class="shop-card-shortage">あと${shortage}</span>` : `🪙${price}`;
}

// ショップの1アイテムを、角丸の正方形アイコン+名前+購入ボタンのカードとして描画する
// (キャラクター選択画面のspecies-cardと同じ視覚言語で統一感を持たせる)。
function renderShopCard({ iconHtml, name, badgeHtml, actionHtml, disabled, cardClass }) {
  return `
    <div class="shop-card ${cardClass || ""}">
      <span class="shop-card-icon">${iconHtml}</span>
      <span class="shop-card-name">${name}${badgeHtml || ""}</span>
      ${actionHtml}
    </div>
  `;
}

function renderShopScreen(profile, shopToast) {
  const colorItems = ALL_ITEMS.filter((it) => it.category === "color");
  const colorCards = colorItems
    .map((it) => {
      const owned = profile.ownedItems.includes(it.id);
      const equipped = profile.equipped.color === it.id;
      const canBuy = !owned && profile.coins >= it.price;
      const iconHtml = `<span class="swatch swatch-lg" style="background:${it.value}"></span>`;
      const badgeHtml = equipped ? `<span class="badge badge-equipped">装着中</span>` : owned ? `<span class="badge">所持済み</span>` : "";
      const actionHtml = owned
        ? `<button class="btn btn-offer shop-card-btn" disabled>所持済み</button>`
        : `<button class="btn btn-offer shop-card-btn" ${canBuy ? "" : "disabled"} onclick="App.buyShopItem('${it.id}')">${buyButtonLabel(it.price, profile.coins)}</button>`;
      return renderShopCard({ iconHtml, name: escapeHtml(it.name), badgeHtml, actionHtml, cardClass: !owned && !canBuy ? "shop-card-cant-afford" : "" });
    })
    .join("");
  const colorSection = `<div class="field"><h3>🎨 色</h3><div class="shop-grid">${colorCards}</div></div>`;

  // コスチューム: 現在選択中の動物種のイラストで表示。未購入はシルエット、購入済みはカラー表示。
  const speciesId = profile.equipped.species;
  const costumeCards = COSTUME_ITEMS
    .map((it) => {
      const owned = profile.ownedItems.includes(it.id);
      const equipped = profile.equipped.costume === it.id;
      const canBuy = !owned && profile.coins >= it.price;
      const img = it.images[speciesId];
      const iconHtml = img
        ? `<img class="item-icon-img ${owned ? "" : "costume-silhouette"}" src="${img}" alt="" />`
        : `<span class="shop-item-emoji">${it.emoji}</span>`;
      const badgeHtml = equipped ? `<span class="badge badge-equipped">装着中</span>` : owned ? `<span class="badge">所持済み</span>` : "";
      const actionHtml = owned
        ? equipped
          ? `<button class="btn btn-offer shop-card-btn" disabled>装着中</button>`
          : `<button class="btn btn-offer shop-card-btn" onclick="App.equipAvatarItem('costume', '${it.id}')">装備する</button>`
        : `<button class="btn btn-offer shop-card-btn" ${canBuy ? "" : "disabled"} onclick="App.buyShopItem('${it.id}')">${buyButtonLabel(it.price, profile.coins)}</button>`;
      return renderShopCard({ iconHtml, name: escapeHtml(it.name), badgeHtml, actionHtml, cardClass: !owned && !canBuy ? "shop-card-cant-afford" : "" });
    })
    .join("");
  const costumeSection = `<div class="field"><h3>👘 コスチューム</h3><div class="shop-grid">${costumeCards}</div></div>`;

  const sections = colorSection + costumeSection;
  const consumableCards = CONSUMABLE_ITEMS
    .map((it) => {
      const count = (profile.consumables && profile.consumables[it.id]) || 0;
      const canBuy = profile.coins >= it.price;
      const badgeHtml = count > 0 ? `<span class="badge">所持${count}個</span>` : "";
      const actionHtml = `<button class="btn btn-offer shop-card-btn" ${canBuy ? "" : "disabled"} onclick="App.buyShopItem('${it.id}')">${buyButtonLabel(it.price, profile.coins)}</button>`;
      return renderShopCard({ iconHtml: renderItemIcon(it, 44), name: escapeHtml(it.name), badgeHtml, actionHtml, cardClass: !canBuy ? "shop-card-cant-afford" : "" });
    })
    .join("");
  const consumableSection = `<div class="field"><h3>🎒 消耗品(対戦中に使える)</h3><div class="shop-grid">${consumableCards}</div></div>`;
  return `
    <section class="screen screen-shop">
      ${renderShopToast(shopToast)}
      <h2>ショップ</h2>
      <p class="coin-display coin-display-lg">🪙 ${profile.coins}</p>
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
  const onlineModeOptions = GAME_MODES
    .map((m) => `<option value="${m.squareCount}" ${m.id === "short" ? "selected" : ""}>${m.label}</option>`)
    .join("");
  const cpuCountOptions = [0, 1, 2, 3, 4, 5]
    .map((n) => `<option value="${n}" ${n === 0 ? "selected" : ""}>CPU ${n}人</option>`)
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
        <label class="field">
          <span>マス数(モード)</span>
          <select id="online-mode-select">${onlineModeOptions}</select>
        </label>
        <label class="field">
          <span>CPU人数(友達が少ない時に混ぜられます)</span>
          <select id="online-cpu-count-select">${cpuCountOptions}</select>
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
      const tags = [uid === room.hostUid ? "ホスト" : null, uid === myUid ? "あなた" : null, p.isCPU ? "CPU" : null]
        .filter(Boolean)
        .join("・");
      const visual = p.avatar || { color: "#999999", speciesEmoji: null, costumeImage: null };
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
  const roomMode = GAME_MODES.find((m) => m.squareCount === room.squareCount);
  const modeLabel = roomMode ? roomMode.label : "30マス(旧仕様)";
  return `
    <section class="screen screen-online-lobby">
      <h2>部屋番号</h2>
      <div class="room-code">${escapeHtml(roomCode)}</div>
      <p class="lead">この番号を友達に伝えてください(現在 ${players.length}/${room.maxPlayers}人)</p>
      <p class="lead">モード: ${escapeHtml(modeLabel)}</p>
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
  const modeOptions = GAME_MODES
    .map((m) => `<option value="${m.squareCount}" ${m.id === "short" ? "selected" : ""}>${m.label}</option>`)
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
      <label class="field">
        <span>マス数(モード)</span>
        <select id="mode-select">${modeOptions}</select>
      </label>
      <button class="btn btn-primary" onclick="App.startGame()">この設定で始める</button>
      <button class="btn" onclick="App.goTitle()">戻る</button>
    </section>
  `;
}

function renderPlayerList(state) {
  const rows = state.players.map((p, i) => {
    const isTurn = i === state.currentTurnIndex && state.status === "playing";
    const visual = p.avatar || { color: p.color, speciesEmoji: null, costumeImage: null };
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

// pendingChoice.prompt(給料日/株価変動/質問文などが\n区切りで連結された文字列)を、
// 1行ずつ別のp要素に分けて表示する(レビュー指摘: 全部が1つの段落に連結されて読みづらい件の対応)。
// 「+◯万円」「-◯万円」を含む行は、reveal演出カードと同じ緑/赤で色分けする。
function renderPromptLines(prompt) {
  return prompt
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const deltaClass = /[+＋]\d+万円/.test(line)
        ? "telop-line-positive"
        : /-\d+万円/.test(line)
          ? "telop-line-negative"
          : "";
      return `<p class="telop-line ${deltaClass}">${escapeHtml(line)}</p>`;
    })
    .join("");
}

// cpuName有り=CPUが選択中の画面。人間が誤って押して二重確定させないよう、
// 選択肢はdisabledのまま見せるだけにする(押せる選択肢は人間自身の番のときのみ)。
function renderChoiceModal(pendingChoice, mode, cpuName, coins) {
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
          ${renderPromptLines(pendingChoice.prompt)}
        </div>
        ${typeof coins === "number" ? `<p class="coin-display">🪙 所持コイン: ${coins}</p>` : ""}
        <button class="btn" onclick="App.toggleStatusPeek()">📊 自分の状況を確認</button>
        ${optionButtons}
      </div>
    </div>
  `;
}

// 選択画面(renderChoiceModal)の「状況を確認」ボタンから開く、所持金・アイテム等の
// 読み取り専用の確認ウィンドウ。選択そのものには影響しない(閉じるだけ)。
function renderStatusPeekModal(player, profile) {
  if (!player) return "";
  const houseTier = player.housePrice > 0 ? HOUSE_PRICE_TIERS.find((t) => t.price === player.housePrice) : null;
  const consumables = Object.entries((profile && profile.consumables) || {}).filter(([, count]) => count > 0);
  const itemRows = consumables.length
    ? consumables
        .map(([id, count]) => {
          const item = findShopItem(id);
          if (!item) return "";
          return `<li class="player-row">${renderItemIcon(item, 26)}<span class="p-name">${escapeHtml(item.name)}</span><span class="p-money">${count}個</span></li>`;
        })
        .join("")
    : `<li class="player-row"><span class="p-name lead">アイテムは持っていません</span></li>`;
  return `
    <div class="modal-backdrop status-peek-modal">
      <div class="modal">
        <h3>${escapeHtml(player.name)} の状況</h3>
        <p class="lead">💰 所持金: ${player.money}万円</p>
        <p class="lead">${player.job ? `💼 ${escapeHtml(player.job.name)}(給料${player.job.salary}万円/回)` : "💼 まだ就職していません"}</p>
        <p class="lead"><img class="inline-icon" src="${STOCK_CERTIFICATE_IMAGE}" alt="" /> 保有株: ${player.stockShares || 0}株</p>
        <p class="lead">🏠 マイホーム: ${houseTier ? escapeHtml(houseTier.label) : "まだ持っていません"}</p>
        <p class="lead">🛡️ 火災保険: ${player.insurance === "fire" ? "加入中" : "未加入"}</p>
        <p class="lead">👶 こども: ${player.children || 0}人</p>
        <ul class="player-list">${itemRows}</ul>
        <button class="btn btn-primary" onclick="App.toggleStatusPeek()">閉じる</button>
      </div>
    </div>
  `;
}

// 選択・できごと・運命の分かれ道・給料日・ひと休みなど、マスに止まった結果を見せる
// 一コマ演出。人間自身の結果(dismissFn有り)は「つぎへ」を押すまでターンが進まない。
// CPUの結果(dismissFn無し)はApp側のタイマーで自動的に閉じるので、押せないことが
// 分かるよう「…」だけ表示する。テロップ枠(telop-frame.png)で本文を囲み、選択モーダルの
// プロンプト表示と統一感を持たせる。
// ゴール到達時、finishOrder(何着か)に応じた大きめのメダルバッジ演出
function renderFinishRankBadge(order) {
  const medal = order === 1 ? "🥇" : order === 2 ? "🥈" : order === 3 ? "🥉" : "🏁";
  const rankClass = order === 1 ? "finish-rank-gold" : order === 2 ? "finish-rank-silver" : order === 3 ? "finish-rank-bronze" : "finish-rank-other";
  return `
    <div class="finish-rank-badge ${rankClass}">
      <span class="finish-rank-medal">${medal}</span>
      <span class="finish-rank-num">${order}着</span>
    </div>
  `;
}

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
        ${reveal.finishOrder ? renderFinishRankBadge(reveal.finishOrder) : ""}
        <div class="turn-hub-avatar">${renderAvatarBadge(visual, 72)}</div>
        <div class="modal-telop">
          <p class="lead">${escapeHtml(reveal.text)}</p>
          ${deltaText}
        </div>
        ${actionHtml}
      </div>
    </div>
  `;
}

// 手番切り替え時に一瞬だけ中央に表示するポップアップ(アバター+名前、自動で消える)
function renderTurnPopup(popup) {
  if (!popup) return "";
  return `
    <div class="turn-popup">
      <div class="turn-popup-card">
        ${renderAvatarBadge(popup.visual, 56)}
        <p>${escapeHtml(popup.name)} のターン</p>
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
  const visual = turnPlayer.avatar || { color: turnPlayer.color, speciesEmoji: null, costumeImage: null };
  return `${renderAvatarBadge(visual, 28)}<span>${escapeHtml(turnPlayer.name)} の番です</span>`;
}

function renderTurnHub(state, humanId, profile, hub) {
  const turnPlayer = state.players[state.currentTurnIndex];
  const visual = turnPlayer.avatar || { color: turnPlayer.color, speciesEmoji: null, costumeImage: null };
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
          <div class="roulette-wheel${hub.spinning ? " is-spinning" : ""}"></div>
          <div class="roulette-wheel-number">${hub.spinNumber}</div>
        </div>
        <p class="lead">${hub.spinning ? "ルーレットが回転中…" : "ルーレット、止まった！"}</p>
      </div>
    `;
  } else if (view === "status") {
    const me = state.players.find((p) => p.id === humanId);
    body = `
      ${renderPlayerList(state)}
      <p class="lead">${me.job ? `給料: ${me.job.salary}万円/回` : "まだ就職していません(給料日はアルバイト収入)"}</p>
      <p class="lead"><img class="inline-icon" src="${STOCK_CERTIFICATE_IMAGE}" alt="" /> 保有株: ${me.stockShares || 0}株</p>
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
                ${renderItemIcon(item, 28)}
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

// 手番プレイヤー以外の所持金変動(結婚のお祝い金の徴収など)を、画面上部に一定時間だけ
// 積み上げ表示するトースト。App.showMoneyToasts()がsetTimeoutで自動的に消す。
function renderMoneyToasts(toasts) {
  if (!toasts || !toasts.length) return "";
  const items = toasts
    .map((t) => {
      const deltaClass = t.delta > 0 ? "reveal-delta-positive" : "reveal-delta-negative";
      return `
        <div class="money-toast">
          ${t.visual ? renderAvatarBadge(t.visual, 28) : ""}
          <span class="p-name">${escapeHtml(t.name)}</span>
          <span class="money-toast-delta ${deltaClass}">${t.delta > 0 ? "+" : ""}${t.delta}万円</span>
        </div>
      `;
    })
    .join("");
  return `<div class="money-toast-stack">${items}</div>`;
}

// ヘッダーの中断ボタンから開く「メニューに戻りますか？」確認モーダル。soloは自動保存される旨、
// onlineは自分だけ退室し他プレイヤーの対戦は続く旨を、それぞれ違う文言で伝える。
// snackSpeed: mode==="snack"のときだけ使う現在の演出速度設定("standard"/"fast"/"fastest")。
function renderPauseMenuModal(mode, snackSpeed) {
  const desc = mode === "online"
    ? "ルームから退室します。他のプレイヤーの対戦はそのまま続きます。"
    : mode === "snack"
      ? "進行状況を保存してタイトルに戻ります。続きは「おやつ集めモードの続きから」で再開できます。"
      : "進行状況を保存してタイトルに戻ります。続きは「続きから再開する」で再開できます。";
  const speedSection = mode === "snack" ? renderSnackSpeedSelector(snackSpeed) : "";
  const vibrationSection = mode === "snack" ? renderSnackVibrationToggle(LifeRoadAudio.loadAudioSettings().vibrationOn) : "";
  return `
    <div class="modal-backdrop pause-menu-modal">
      <div class="modal">
        <h3>メニューに戻りますか？</h3>
        <p class="lead">${desc}</p>
        ${speedSection}
        ${vibrationSection}
        <button class="btn btn-primary" onclick="App.confirmPauseToTitle()">タイトルに戻る</button>
        <button class="btn" onclick="App.togglePauseMenu()">プレイに戻る</button>
      </div>
    </div>
  `;
}

// おやつ集めモードの演出速度設定(標準/はやい/最速)。ポーズメニュー内の3択ボタン。
function renderSnackSpeedSelector(current) {
  const options = [
    { id: "standard", label: "標準" },
    { id: "fast", label: "はやい" },
    { id: "fastest", label: "最速" },
  ];
  const buttons = options
    .map(
      (o) =>
        `<button class="snack-speed-btn${o.id === current ? " snack-speed-btn-active" : ""}" onclick="App.setSnackSpeed('${o.id}')">${o.label}</button>`
    )
    .join("");
  return `
    <div class="snack-speed-selector">
      <p class="snack-speed-label">演出速度</p>
      <div class="snack-speed-buttons">${buttons}</div>
    </div>
  `;
}

// 振動オン/オフ切り替え(仕様書「振動オフ設定必須」)。Vibration API非対応端末でも
// 設定自体は保存できる(実際の振動が鳴らないだけで、切り替え操作はエラーにならない)。
function renderSnackVibrationToggle(vibrationOn) {
  return `
    <div class="snack-speed-selector">
      <p class="snack-speed-label">振動</p>
      <div class="snack-speed-buttons">
        <button class="snack-speed-btn${vibrationOn ? " snack-speed-btn-active" : ""}" onclick="App.setSnackVibration(true)">ON</button>
        <button class="snack-speed-btn${vibrationOn ? "" : " snack-speed-btn-active"}" onclick="App.setSnackVibration(false)">OFF</button>
      </div>
    </div>
  `;
}

function renderGameScreen(state, log, humanId, mode, profile, hub, reveal, logOpen, hopping, turnPopup, statusPeekOpen, moneyToasts, pauseMenuOpen) {
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
      ${renderTurnPopup(turnPopup)}
      ${renderMoneyToasts(moneyToasts)}
      ${isHumanTurn || showCPUSpinning ? renderTurnHub(state, humanId, profile, hub) : ""}
      ${!reveal && !hopping ? renderChoiceModal(state.pendingChoice, mode, isCPUTurn ? turnPlayer.name : null, profile.coins) : ""}
      ${renderRevealCard(reveal, reveal && reveal.visual, dismissFn)}
      ${logOpen ? renderLogModal(log) : ""}
      ${statusPeekOpen ? renderStatusPeekModal(state.players.find((p) => p.id === humanId), profile) : ""}
      ${pauseMenuOpen ? renderPauseMenuModal(mode) : ""}
    </section>
  `;
}

// 全員ゴール後の清算(runSettlement)の内訳を、結果画面で開閉式に確認できるようにする
function renderSettlementBreakdown(settlement) {
  if (!settlement || !settlement.total) return "";
  const rows = [
    settlement.child ? `<li>👶 こども清算 +${settlement.child}万円</li>` : "",
    settlement.stock ? `<li>💹 株の清算 +${settlement.stock}万円</li>` : "",
    settlement.house ? `<li>🏠 マイホーム清算 +${settlement.house}万円</li>` : "",
    settlement.goalOrder ? `<li>🏁 ゴール到達順ボーナス +${settlement.goalOrder}万円</li>` : "",
  ]
    .filter(Boolean)
    .join("");
  if (!rows) return "";
  return `
    <details class="settlement-detail">
      <summary>清算の内訳(合計 +${settlement.total}万円)</summary>
      <ul class="settlement-list">${rows}</ul>
    </details>
  `;
}

function renderResultScreen(state, mode, rewardCoins) {
  const ranking = getRanking(state);
  const rows = ranking.map((p, i) => {
    const visual = p.avatar || { color: p.color, speciesEmoji: null, costumeImage: null };
    return `
    <li class="result-row">
      <span class="result-rank">${i + 1}位</span>
      ${renderAvatarBadge(visual, 26)}
      <span class="p-name">${escapeHtml(p.name)}${p.isCPU ? `(CPU${LifeRoadCPU.personalityLabel(p.personality) ? "・" + LifeRoadCPU.personalityLabel(p.personality) : ""})` : ""}</span>
      <span class="p-job">${p.job ? escapeHtml(p.job.name) : "無職"}</span>
      <span class="p-money">${p.money}万円</span>
      ${renderSettlementBreakdown(p.settlement)}
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

// ==================== おやつ集めモード(フェーズ1試作) ====================

function renderSnackSetupScreen() {
  const cpuOptions = [1, 2, 3].map((n) => `<option value="${n}">CPU ${n}人(合計${n + 1}人)</option>`).join("");
  return `
    <section class="screen screen-setup">
      <h2>🍪 おやつ集めモード(試作)</h2>
      <p class="lead">周回・分岐マップでおやつを取り合う、マリオパーティ風の新モードです。全${SNACK_TOTAL_ROUNDS}ラウンドで、おやつ数の多いプレイヤーが優勝(同数なら所持コイン、さらに同額なら歩いたマス数で決定)。</p>
      <label class="field">
        <span>あなたのニックネーム</span>
        <input id="snack-nickname-input" type="text" maxlength="10" value="プレイヤー" />
      </label>
      <label class="field">
        <span>CPU人数</span>
        <select id="snack-cpu-count-select">${cpuOptions}</select>
      </label>
      <button class="btn btn-primary" onclick="App.startSnackGame()">この設定で始める</button>
      <button class="btn" onclick="App.goTitle()">戻る</button>
    </section>
  `;
}

function renderSnackLogModal(entries) {
  return `
    <div class="modal-backdrop log-modal">
      <div class="modal">
        <h3>できごとログ</h3>
        ${renderLog(entries)}
        <button class="btn" onclick="App.snackToggleLog()">閉じる</button>
      </div>
    </div>
  `;
}

// P1〜P4固定色+4隅HUD+ポップアップ式ターン進行UI(2026-08-12、Codex連携チャットの確定仕様書
// 「ClaudeCode向け_おやつ集めモード統合仕様書.md」に基づく全面刷新)。
// 下部固定メニューバー(旧.hub-bar)は廃止し、3Dマップを全画面表示した上で、
// App.snack.phase(状態マシン、app.js参照)に応じた単一のポップアップだけを重ねる構成にした。
const SNACK_CORNER_POSITIONS = ["topleft", "topright", "bottomleft", "bottomright"];
const SNACK_ACTION_ICONS = {
  dice: "images/snack/action-dice.png",
  item: "images/snack/action-item.png",
  log: "images/snack/action-log.png",
  map: "images/snack/action-map.png",
  next: "images/snack/action-next.png",
};

function snackColorVars(seatNumber) {
  const c = snackPlayerColor(seatNumber);
  return `--p-color:${c.main};--p-color-dark:${c.dark}`;
}

function renderSnackMedallion(seatNumber) {
  const c = snackPlayerColor(seatNumber);
  return `<div class="snack-medallion" style="${snackColorVars(seatNumber)}"><span class="snack-medallion-label">${c.label}</span><span class="snack-medallion-mark">${c.mark}</span></div>`;
}

// ポップアップ内の選択肢1行(popup-choice-button.png)。disabled時はタップ不可+理由文を表示する
// (バグB対応: 近道の通行料が足りない場合にここでボタンを無効化する)。
function renderSnackChoiceRow({ iconSrc, iconEmoji, label, sublabel, onclick, disabled, disabledReason, primary }) {
  const icon = iconSrc
    ? `<img class="snack-choice-icon" src="${iconSrc}" alt="" />`
    : `<span class="snack-choice-icon snack-choice-icon-emoji">${iconEmoji || ""}</span>`;
  const cls = ["snack-choice-row", primary ? "snack-choice-row-primary" : "", disabled ? "snack-choice-row-disabled" : ""].filter(Boolean).join(" ");
  const sub = disabled && disabledReason
    ? `<span class="snack-choice-sublabel snack-choice-shortfall">${escapeHtml(disabledReason)}</span>`
    : sublabel
      ? `<span class="snack-choice-sublabel">${escapeHtml(sublabel)}</span>`
      : "";
  return `
    <button class="${cls}" ${disabled ? "disabled" : ""} onclick="${disabled ? "" : onclick}">
      ${icon}
      <span class="snack-choice-text">
        <span class="snack-choice-label">${escapeHtml(label)}</span>
        ${sub}
      </span>
      <span class="snack-choice-arrow">›</span>
    </button>
  `;
}

// 選択肢一覧ポップアップ(popup-choice-frame.png)。ターン開始メニュー/アイテム一覧/
// ルート選択/購入確認/次の行動など、選択が必要な全phaseで共通に使う。
function renderSnackPopupChoice({ phaseKey, seatNumber, title, subtitle, rowsHtml, closable, onClose }) {
  return `
    <div class="modal-backdrop snack-popup-backdrop">
      <div class="snack-popup-choice snack-popup-anim" style="${seatNumber ? snackColorVars(seatNumber) : ""}" data-key="${phaseKey}">
        ${seatNumber ? renderSnackMedallion(seatNumber) : ""}
        ${title ? `<h3 class="snack-popup-title">${escapeHtml(title)}</h3>` : ""}
        ${subtitle ? `<p class="snack-popup-subtitle">${escapeHtml(subtitle)}</p>` : ""}
        <div class="snack-popup-list">${rowsHtml}</div>
        ${closable ? `<button class="snack-popup-close" onclick="${onClose}">✕</button>` : ""}
      </div>
    </div>
  `;
}

// 結果表示ポップアップ(popup-result-frame.png)。行動結果・アイテム使用確認など
// 「1つの内容+次への案内」を見せるphaseで使う。
function renderSnackPopupResult({ phaseKey, seatNumber, title, bodyHtml, footerHtml }) {
  return `
    <div class="modal-backdrop snack-popup-backdrop">
      <div class="snack-popup-result snack-popup-anim" style="${seatNumber ? snackColorVars(seatNumber) : ""}" data-key="${phaseKey}">
        ${title ? `<h3 class="snack-popup-title">${escapeHtml(title)}</h3>` : ""}
        <div class="snack-popup-result-body">${bodyHtml}</div>
        ${footerHtml ? `<div class="snack-popup-footer">${footerHtml}</div>` : ""}
      </div>
    </div>
  `;
}

function snackNextButton(label, onclick) {
  return `<button class="snack-next-btn" onclick="${onclick}"><img src="${SNACK_ACTION_ICONS.next}" alt=""/><span>${escapeHtml(label)}</span></button>`;
}

// ==================== 4隅HUD(player-status-hud.png、P1〜P4固定色) ====================

function renderSnackHUD(state, humanId, rankChangeFx) {
  const roundsLeft = Math.max(0, state.totalRounds - state.round + 1);
  const me = state.players.find((p) => p.id === humanId);
  const ranking = getSnackRanking(state);
  const currentId = currentSnackPlayer(state).id;
  const changeById = new Map((rankChangeFx ? rankChangeFx.changes : []).map((c) => [c.playerId, c]));
  const cards = state.players
    .slice()
    .sort((a, b) => a.seatNumber - b.seatNumber)
    .slice(0, SNACK_CORNER_POSITIONS.length)
    .map((p) => {
      const visual = p.avatar || { color: "#e4572e", speciesEmoji: null, costumeImage: null };
      const isActive = p.id === currentId;
      const color = snackPlayerColor(p.seatNumber);
      const rank = ranking.findIndex((r) => r.id === p.id) + 1;
      const corner = SNACK_CORNER_POSITIONS[p.seatNumber - 1] || "topleft";
      const change = changeById.get(p.id);
      const rankFxClass = change ? ` snack-hud-rank-${change.direction}` : "";
      return `
        <div class="snack-hud-corner snack-hud-corner-${corner}">
          <div class="snack-hud-card${isActive ? " snack-hud-active" : ""}" style="${snackColorVars(p.seatNumber)}">
            <div class="snack-hud-face">${renderAvatarBadge(visual, 40)}</div>
            <div class="snack-hud-rank${rankFxClass}">${change && change.direction === "crown" ? "👑" : ""}${rank}</div>
            <div class="snack-hud-name">${escapeHtml(p.name)}${p.isCPU ? "(CPU)" : ""}</div>
            <div class="snack-hud-snacks">🍪${p.snacks}</div>
            <div class="snack-hud-coins">🪙${p.matchCoins}</div>
            <div class="snack-hud-seat-badge">${color.label}${color.mark}</div>
          </div>
        </div>
      `;
    })
    .join("");
  // ラストスパート(仕様書14章FINAL_SPRINT)中は残りラウンド表示を終盤色で強調する。
  const sprintClass = isSnackFinalSprint(state) ? " snack-round-badge-sprint" : "";
  return `
    <div class="snack-round-badge${sprintClass}">⏳ 残り${roundsLeft}ラウンド ・ 🎒${me.items.length}/${SNACK_ITEM_SLOT_LIMIT}</div>
    <div class="snack-hud-layer">${cards}</div>
  `;
}

// 順位変動(仕様書14章RANK_CHANGE)の一言テキスト。四隅HUDの数字は上のrenderSnackHUDが
// 直接アニメーションさせるので、ここでは変化理由を短く伝えるトースト1件だけを画面下部に出す
// (複数人が同時に変動しても、人間プレイヤー優先→無ければ先頭の変化のみを表示して情報量を絞る)。
function renderSnackRankToast(rankChangeFx, state, humanId) {
  if (!rankChangeFx || !rankChangeFx.changes.length) return "";
  const change = rankChangeFx.changes.find((c) => c.playerId === humanId) || rankChangeFx.changes[0];
  const player = state.players.find((p) => p.id === change.playerId);
  if (!player) return "";
  const text =
    change.direction === "crown"
      ? `${escapeHtml(player.name)} 1位に浮上！`
      : `${escapeHtml(player.name)} ${change.fromRank + 1}位から${change.toRank + 1}位へ`;
  return `<div class="snack-rank-toast">${text}</div>`;
}

// ==================== マップ紹介フライスルー ====================

function renderSnackMapIntroOverlay() {
  return `
    <div class="snack-intro-overlay">
      <button class="snack-intro-skip" onclick="App.snackSkipMapIntro()">スキップ ›</button>
    </div>
  `;
}

// ==================== 行動順決めサイコロ ====================

function renderSnackOrderRollPopup(snack, state, humanId) {
  const or = snack.orderRoll;
  const rows = or.ids
    .map((id) => {
      const p = state.players.find((pp) => pp.id === id);
      const rolled = Object.prototype.hasOwnProperty.call(or.rolls, id);
      const value = rolled ? or.rolls[id] : "?";
      return `
        <li class="snack-order-row" style="${snackColorVars(p.seatNumber)}">
          <span class="snack-order-seat">${snackPlayerColor(p.seatNumber).label}</span>
          <span class="p-name">${escapeHtml(p.name)}${p.isCPU ? "(CPU)" : ""}</span>
          <span class="snack-order-value">${value}</span>
        </li>
      `;
    })
    .join("");
  const nextUnrolledId = or.ids.find((id) => !Object.prototype.hasOwnProperty.call(or.rolls, id));
  const isHumanTurn = nextUnrolledId === humanId;
  const footer = isHumanTurn
    ? snackNextButton("サイコロを振る", "App.snackRollForOrder()")
    : nextUnrolledId
      ? `<p class="lead">${escapeHtml(state.players.find((p) => p.id === nextUnrolledId).name)}が振っています…</p>`
      : "";
  return `
    <div class="modal-backdrop snack-popup-backdrop">
      <div class="snack-popup-choice snack-popup-anim" data-key="${snack.phase}">
        <h3 class="snack-popup-title">${or.isTie ? "同点の振り直し！" : "順番を決めよう！"}</h3>
        <ul class="snack-order-list">${rows}</ul>
        <div class="snack-popup-footer">${footer}</div>
      </div>
    </div>
  `;
}

function renderSnackOrderResultPopup(snack, state) {
  const rows = snack.orderRoll.finalOrder
    .map((id, i) => {
      const p = state.players.find((pp) => pp.id === id);
      return `
        <li class="snack-order-row" style="${snackColorVars(p.seatNumber)}">
          <span class="snack-order-rank">${i + 1}番</span>
          <span class="snack-order-seat">${snackPlayerColor(p.seatNumber).label}</span>
          <span class="p-name">${escapeHtml(p.name)}${p.isCPU ? "(CPU)" : ""}</span>
        </li>
      `;
    })
    .join("");
  return `
    <div class="modal-backdrop snack-popup-backdrop">
      <div class="snack-popup-choice snack-popup-anim" data-key="ORDER_RESULT">
        <h3 class="snack-popup-title">行動順が決まりました！</h3>
        <ul class="snack-order-list">${rows}</ul>
      </div>
    </div>
  `;
}

// ==================== おやつ紹介(SNACK_REVEAL) ====================

function renderSnackRevealTelop(snack) {
  const reveal = snack.reveal;
  if (!reveal) return "";
  const zoneText = reveal.zoneLabel ? `${reveal.zoneLabel}・${reveal.ringLabel}` : reveal.ringLabel;
  return `
    <div class="snack-telop-backdrop snack-telop-backdrop-dark" onclick="App.snackSkipReveal()">
      <div class="snack-telop-card snack-reveal">
        <h2 class="snack-telop-title">🍪 おやつを発見！</h2>
        <p class="snack-telop-sub">${escapeHtml(zoneText)}</p>
        <p class="snack-reveal-price">🪙${reveal.price}コインで購入できます</p>
      </div>
    </div>
  `;
}

// ==================== ラウンド・ターン切替テロップ ====================

function renderSnackRoundIntroTelop(snack) {
  const ri = snack.roundIntro;
  const title = ri.isFinal ? "最終ラウンド！" : ri.isFinalSprintStart ? "ラストスパート！" : `第${ri.round}ラウンド！`;
  return `
    <div class="snack-telop-backdrop snack-telop-backdrop-dark" onclick="App.snackSkipTelop()">
      <div class="snack-telop-card snack-round-intro${ri.isFinalSprintStart || ri.isFinal ? " snack-round-intro-sprint" : ""}">
        <h2 class="snack-telop-title">${title}</h2>
        <p class="snack-telop-sub">残り${Math.max(0, snack.state.totalRounds - snack.state.round + 1)}ラウンド</p>
        ${ri.gimmickWarning ? `<p class="snack-gimmick-warning">🌉 ${escapeHtml(ri.gimmickWarning)}</p>` : ""}
        ${ri.midResult ? renderSnackMidResultBlock(ri.midResult) : ""}
      </div>
    </div>
  `;
}

// 中間順位(仕様書14章MID_RESULT)。第5ラウンド終了時(=第6ラウンド開始時)・残り3ラウンド開始時・
// 最終ラウンド開始時のみ、ラウンド開始テロップに重ねて簡易順位表を表示する。
function renderSnackMidResultBlock(midResult) {
  const rows = midResult.ranking
    .map(
      (r) => `
        <li class="snack-mid-result-row">
          <span class="snack-mid-result-rank">${r.rank}位</span>
          <span class="snack-mid-result-name">${escapeHtml(r.name)}</span>
          <span class="snack-mid-result-snacks">🍪${r.snacks}</span>
          <span class="snack-mid-result-coins">🪙${r.coins}</span>
          <span class="snack-mid-result-diff">${r.rank === 1 ? "" : `1位差${r.diffFromTop}`}</span>
        </li>
      `
    )
    .join("");
  return `
    <div class="snack-mid-result">
      <p class="snack-mid-result-heading">中間順位</p>
      <ul class="snack-mid-result-list">${rows}</ul>
      ${midResult.snackZoneLabel ? `<p class="snack-mid-result-spot">おやつは${escapeHtml(midResult.snackZoneLabel)}にあるよ</p>` : ""}
    </div>
  `;
}

function renderSnackPlayerIntroTelop(snack, state) {
  const player = state.players.find((p) => p.id === snack.playerIntro.playerId);
  const visual = player.avatar || { color: "#e4572e", speciesEmoji: null, costumeImage: null };
  const color = snackPlayerColor(player.seatNumber);
  return `
    <div class="snack-telop-backdrop" onclick="App.snackSkipTelop()">
      <div class="snack-telop-card snack-player-intro" style="${snackColorVars(player.seatNumber)}">
        ${renderAvatarBadge(visual, 56)}
        <p class="snack-telop-seat">${color.label} ${color.mark}</p>
        <h2 class="snack-telop-title">${escapeHtml(player.name)}${player.isCPU ? "(CPU)" : ""}のターン！</h2>
      </div>
    </div>
  `;
}

// ==================== ターン中のポップアップ(サイコロ/アイテム/マップ/ログ) ====================

function renderSnackTurnMenuPopup(state, humanId) {
  const player = state.players.find((p) => p.id === humanId);
  const rows = [
    renderSnackChoiceRow({ iconSrc: SNACK_ACTION_ICONS.dice, label: "サイコロを振る", sublabel: "移動する", onclick: "App.snackRoll()", primary: true }),
    renderSnackChoiceRow({ iconSrc: SNACK_ACTION_ICONS.item, label: "アイテム", sublabel: `所持 ${player.items.length}/${SNACK_ITEM_SLOT_LIMIT}`, onclick: "App.snackOpenItemSelect()" }),
    renderSnackChoiceRow({ iconSrc: SNACK_ACTION_ICONS.map, label: "マップ確認", onclick: "App.snackOpenMapOverview()" }),
    renderSnackChoiceRow({ iconSrc: SNACK_ACTION_ICONS.log, label: "ログを見る", onclick: "App.snackToggleLog()" }),
  ].join("");
  return renderSnackPopupChoice({ phaseKey: "TURN_MENU", seatNumber: player.seatNumber, title: `${escapeHtml(player.name)}のターン`, rowsHtml: rows });
}

function renderSnackNextActionPopup(state, humanId) {
  const player = state.players.find((p) => p.id === humanId);
  const rows = [
    renderSnackChoiceRow({ iconSrc: SNACK_ACTION_ICONS.next, label: "ショップへ入る", onclick: "App.snackOpenShop()" }),
    renderSnackChoiceRow({ iconSrc: SNACK_ACTION_ICONS.item, label: "アイテムを確認する", sublabel: `所持 ${player.items.length}/${SNACK_ITEM_SLOT_LIMIT}`, onclick: "App.snackOpenItemSelect()" }),
    renderSnackChoiceRow({ iconSrc: SNACK_ACTION_ICONS.map, label: "マップを確認する", onclick: "App.snackOpenMapOverview()" }),
    renderSnackChoiceRow({ iconSrc: SNACK_ACTION_ICONS.log, label: "ログを見る", onclick: "App.snackToggleLog()" }),
    renderSnackChoiceRow({ iconSrc: SNACK_ACTION_ICONS.next, label: "ターンを終了する", onclick: "App.snackEndTurn()", primary: true }),
  ].join("");
  return renderSnackPopupChoice({ phaseKey: "NEXT_ACTION", seatNumber: player.seatNumber, title: "次の行動を選んでください", rowsHtml: rows });
}

function renderSnackItemSelectPopup(state, humanId) {
  const player = state.players.find((p) => p.id === humanId);
  const rows = player.items.length
    ? player.items
        .map((itemId) => {
          const item = SNACK_ITEMS.find((it) => it.id === itemId);
          if (!item) return "";
          return renderSnackChoiceRow({ iconEmoji: item.emoji, label: item.name, onclick: `App.snackOpenItemConfirm('${item.id}')` });
        })
        .join("")
    : `<p class="lead">アイテムは持っていません</p>`;
  return renderSnackPopupChoice({ phaseKey: "ITEM_SELECT", seatNumber: player.seatNumber, title: "アイテム", rowsHtml: rows, closable: true, onClose: "App.snackCloseItemSelect()" });
}

const SNACK_ITEM_EFFECT_DESCRIPTIONS = {
  extraDice: (item) => `次のサイコロの出目に+${item.value}`,
  trap: () => "少し先に足止めの罠を仕掛ける",
  hint: () => "次のおやつが外周側か内周側かを教えてくれる",
  guard: () => "妨害を1回防いでくれる",
};

function renderSnackItemConfirmPopup(state, humanId, itemId) {
  const player = state.players.find((p) => p.id === humanId);
  const item = SNACK_ITEMS.find((it) => it.id === itemId);
  if (!item) return "";
  const desc = (SNACK_ITEM_EFFECT_DESCRIPTIONS[item.effect] || (() => ""))(item);
  const body = `
    <div class="snack-item-confirm">
      ${renderItemIcon(item, 56)}
      <p class="snack-item-confirm-name">${escapeHtml(item.name)}</p>
      <p class="snack-item-confirm-desc">${escapeHtml(desc)}</p>
    </div>
  `;
  return renderSnackPopupResult({
    phaseKey: "ITEM_CONFIRM",
    seatNumber: player.seatNumber,
    title: "使いますか？",
    bodyHtml: body,
    footerHtml: `${snackNextButton("使う", "App.snackConfirmUseItem()")}<button class="btn" onclick="App.snackCancelItemConfirm()">やめる</button>`,
  });
}

function renderSnackShopPopup(state, humanId) {
  const me = state.players.find((p) => p.id === humanId);
  const cards = SNACK_ITEMS.map((it) => {
    const canBuy = me.items.length < SNACK_ITEM_SLOT_LIMIT && me.matchCoins >= it.price;
    const actionHtml = `<button class="btn btn-offer shop-card-btn" ${canBuy ? "" : "disabled"} onclick="App.snackBuyShopItem('${it.id}')">${buyButtonLabel(it.price, me.matchCoins)}</button>`;
    return renderShopCard({ iconHtml: renderItemIcon(it, 44), name: escapeHtml(it.name), badgeHtml: "", actionHtml, cardClass: !canBuy ? "shop-card-cant-afford" : "" });
  }).join("");
  const body = `<p class="coin-display">🪙 所持コイン: ${me.matchCoins}(アイテム所持 ${me.items.length}/${SNACK_ITEM_SLOT_LIMIT})</p><div class="shop-grid">${cards}</div>`;
  return renderSnackPopupChoice({ phaseKey: "SHOP_SELECT", seatNumber: me.seatNumber, title: "🏪 ショップ", rowsHtml: body, closable: true, onClose: "App.snackCloseShop()" });
}

// ==================== 移動中の分岐・おやつ購入・停止イベント選択 ====================
// pending*は常に現在の手番プレイヤー自身のものであり、CPUの分はここへ来る前に
// maybeRunSnackCPUTurnが自動解決するため、これらは人間の手番でのみ描画される。

function renderSnackRouteSelectPopup(state) {
  const player = currentSnackPlayer(state);
  const branchNode = findSnackNode(state.pendingBranch.nodeId);
  const rows = branchNode.nextNodeIds
    .map((nid, i) => {
      const isShortcut = i === 1;
      if (!isShortcut) {
        return renderSnackChoiceRow({ iconEmoji: "➡️", label: "そのまま外周を進む", onclick: `App.snackChooseBranch('${nid}')`, primary: true });
      }
      const afford = canAffordSnackToll(player, branchNode);
      return renderSnackChoiceRow({
        iconEmoji: "🌀",
        label: "近道(内周)へ進む",
        sublabel: afford ? `通行料 ${branchNode.tollCost}コイン` : null,
        onclick: `App.snackChooseBranch('${nid}')`,
        disabled: !afford,
        disabledReason: !afford ? `あと${branchNode.tollCost - player.matchCoins}コイン足りません` : null,
      });
    })
    .join("");
  return renderSnackPopupChoice({ phaseKey: "ROUTE_SELECT", seatNumber: player.seatNumber, title: "分かれ道", subtitle: `所持コイン: ${player.matchCoins}`, rowsHtml: rows });
}

function renderSnackPurchaseConfirmPopup(state) {
  const player = currentSnackPlayer(state);
  const afford = player.matchCoins >= SNACK_SNACK_PRICE;
  const rows = [
    renderSnackChoiceRow({
      iconEmoji: "🍪",
      label: `買う(-${SNACK_SNACK_PRICE})`,
      onclick: "App.snackChooseSnackPurchase(true)",
      primary: true,
      disabled: !afford,
      disabledReason: !afford ? `あと${SNACK_SNACK_PRICE - player.matchCoins}コイン足りません` : null,
    }),
    renderSnackChoiceRow({ iconEmoji: "🚶", label: "見送る", onclick: "App.snackChooseSnackPurchase(false)" }),
  ].join("");
  return renderSnackPopupChoice({ phaseKey: "SNACK_PURCHASE_CONFIRM", seatNumber: player.seatNumber, title: "🍪 おやつ発見！", subtitle: `所持コイン: ${player.matchCoins}`, rowsHtml: rows });
}

function renderSnackStopChoicePopup(state) {
  const player = currentSnackPlayer(state);
  const pc = state.pendingStopChoice;
  const rows = pc.options
    .map((o, i) => renderSnackChoiceRow({ iconEmoji: "🎯", label: o.label, onclick: `App.snackChooseStopOption(${i})` }))
    .join("");
  return renderSnackPopupChoice({ phaseKey: "STOP_CHOICE", seatNumber: player.seatNumber, title: pc.title, subtitle: pc.prompt, rowsHtml: rows });
}

// ==================== 行動結果ポップアップ(行動者+効果を明示表示) ====================

function renderSnackActionResultPopup(snack) {
  const actor = snack.lastActionActor;
  const entries = snack.lastActionEntries || [];
  const rows = entries.length
    ? entries
        .map((e) => {
          const cls = e.type === "money" ? (e.delta > 0 ? "snack-result-positive" : "snack-result-negative") : e.type === "snack" ? "snack-result-snack" : "";
          return `<li class="${cls}">${escapeHtml(e.text)}</li>`;
        })
        .join("")
    : `<li>とくに変化はなかった</li>`;
  const body = `
    ${actor ? `<p class="snack-result-actor">${escapeHtml(actor.name)}${actor.isCPU ? "(CPU)" : ""}の行動</p>` : ""}
    <ul class="snack-result-list">${rows}</ul>
  `;
  return renderSnackPopupResult({
    phaseKey: "ACTION_RESULT",
    seatNumber: actor ? actor.seatNumber : null,
    title: "行動結果",
    bodyHtml: body,
    footerHtml: snackNextButton("次へ", "App.snackDismissActionResult()"),
  });
}

// ==================== マップ全体表示・ズーム確認 ====================

function renderSnackMapViewOverlay(snack, state) {
  const isZoom = snack.phase === "MAP_ZOOM";
  const hint = isZoom && !state.mapZoomHintShown
    ? `<div class="snack-map-pan-hint"><img src="images/snack/map-pan-hint.png" alt=""/><p>ドラッグしてマップを動かせます</p></div>`
    : "";
  return `
    <div class="snack-map-view-overlay">
      <div class="snack-map-view-toolbar">
        <button class="snack-map-view-btn${!isZoom ? " snack-map-view-btn-active" : ""}" onclick="App.snackOpenMapOverview()"><img src="images/snack/map-overview.png" alt="全体表示"/></button>
        <button class="snack-map-view-btn${isZoom ? " snack-map-view-btn-active" : ""}" onclick="App.snackOpenMapZoom()"><img src="images/snack/map-zoom.png" alt="ズーム表示"/></button>
        <button class="snack-map-view-back" onclick="App.snackCloseMapView()">戻る</button>
      </div>
      ${hint}
    </div>
  `;
}

// ==================== CPUの手番中(非ブロッキング表示) ====================

function renderSnackCPUTurnOverlay(snack, state) {
  const player = currentSnackPlayer(state);
  const color = snackPlayerColor(player.seatNumber);
  const showLog = snack.lastActionActor && snack.lastActionActor.seatNumber === player.seatNumber;
  const lines = showLog ? (snack.lastActionEntries || []).map((e) => `<li>${escapeHtml(e.text)}</li>`).join("") : "";
  // CPU判断理由の吹き出し(仕様書14章)。分岐・アイテム使用など、実際にCPUが評価に
  // 使った材料(距離・所持金・残りラウンド)をそのまま短い一言にして表示する。
  const reasonHtml = snack.cpuReason ? `<p class="snack-cpu-reason-bubble">💭 ${escapeHtml(snack.cpuReason)}</p>` : "";
  return `
    <div class="snack-cpu-turn-overlay" style="${snackColorVars(player.seatNumber)}">
      <p class="snack-cpu-turn-label">${color.label} ${escapeHtml(player.name)}が考え中…</p>
      ${reasonHtml}
      ${lines ? `<ul class="snack-cpu-turn-log">${lines}</ul>` : ""}
    </div>
  `;
}

// ==================== 画面全体の組み立て ====================

function renderSnackGameScreen(snack, humanId, pauseMenuOpen) {
  const state = snack.state;
  let popupHtml = "";
  switch (snack.phase) {
    case "MAP_INTRO":
      popupHtml = renderSnackMapIntroOverlay();
      break;
    case "SNACK_REVEAL":
      popupHtml = renderSnackRevealTelop(snack);
      break;
    case "ORDER_ROLL":
    case "ORDER_TIE_ROLL":
      popupHtml = renderSnackOrderRollPopup(snack, state, humanId);
      break;
    case "ORDER_RESULT":
      popupHtml = renderSnackOrderResultPopup(snack, state);
      break;
    case "ROUND_INTRO":
      popupHtml = renderSnackRoundIntroTelop(snack);
      break;
    case "PLAYER_INTRO":
      popupHtml = renderSnackPlayerIntroTelop(snack, state);
      break;
    case "TURN_MENU":
      popupHtml = renderSnackTurnMenuPopup(state, humanId);
      break;
    case "ITEM_SELECT":
      popupHtml = renderSnackItemSelectPopup(state, humanId);
      break;
    case "ITEM_CONFIRM":
      popupHtml = renderSnackItemConfirmPopup(state, humanId, snack.pendingItemId);
      break;
    case "SHOP_SELECT":
      popupHtml = renderSnackShopPopup(state, humanId);
      break;
    case "ROLLING":
      popupHtml = `<div class="snack-rolling-overlay"><p class="lead">🎲 サイコロを振っています…</p></div>`;
      break;
    case "ROUTE_SELECT":
      popupHtml = renderSnackRouteSelectPopup(state);
      break;
    case "SNACK_PURCHASE_CONFIRM":
      popupHtml = renderSnackPurchaseConfirmPopup(state);
      break;
    case "STOP_CHOICE":
      popupHtml = renderSnackStopChoicePopup(state);
      break;
    case "ACTION_RESULT":
      popupHtml = renderSnackActionResultPopup(snack);
      break;
    case "NEXT_ACTION":
      popupHtml = renderSnackNextActionPopup(state, humanId);
      break;
    case "MAP_OVERVIEW":
    case "MAP_ZOOM":
      popupHtml = renderSnackMapViewOverlay(snack, state);
      break;
    case "CPU_TURN":
      popupHtml = renderSnackCPUTurnOverlay(snack, state);
      break;
    case "MOVING":
    default:
      popupHtml = "";
  }
  return `
    <section class="screen screen-game screen-snack-game">
      ${renderSnackHUD(state, humanId, snack.rankChangeFx)}
      ${renderSnackRankToast(snack.rankChangeFx, state, humanId)}
      ${renderSnackRemainingSteps(snack)}
      ${popupHtml}
      ${snack.logOpen ? renderSnackLogModal(snack.log) : ""}
      ${pauseMenuOpen ? renderPauseMenuModal("snack", snack.speed) : ""}
    </section>
  `;
}

// 移動演出中(MOVING、人間・CPUどちらの手番でも)、画面上部へ残り歩数を表示する
// (仕様書14章「1マスずつの移動」)。this.snack.remainingStepsが立っている間だけ表示する。
function renderSnackRemainingSteps(snack) {
  const rs = snack.remainingSteps;
  if (!rs) return "";
  const left = Math.max(0, rs.total - rs.done);
  if (left <= 0) return "";
  return `<div class="snack-remaining-steps">残り${left}歩</div>`;
}

function renderSnackResultScreen(state, humanId) {
  const ranking = getSnackRanking(state);
  const rows = ranking
    .map((p, i) => {
      const visual = p.avatar || { color: "#e4572e", speciesEmoji: null, costumeImage: null };
      return `
        <li class="result-row">
          <span class="result-rank">${i + 1}位</span>
          ${renderAvatarBadge(visual, 26)}
          <span class="p-name">${escapeHtml(p.name)}${p.isCPU ? "(CPU)" : ""}</span>
          <span class="p-money">🍪${p.snacks} 🪙${p.matchCoins}</span>
        </li>
      `;
    })
    .join("");
  return `
    <section class="screen screen-result">
      <h2>おやつ集め結果発表</h2>
      <ul class="result-list">${rows}</ul>
      <button class="btn btn-primary" onclick="App.goSnackSetup()">もう一度遊ぶ</button>
      <button class="btn" onclick="App.goTitle()">タイトルへ</button>
    </section>
  `;
}
