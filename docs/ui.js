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
function renderPauseMenuModal(mode) {
  const desc = mode === "online"
    ? "ルームから退室します。他のプレイヤーの対戦はそのまま続きます。"
    : mode === "snack"
      ? "進行状況を保存してタイトルに戻ります。続きは「おやつ集めモードの続きから」で再開できます。"
      : "進行状況を保存してタイトルに戻ります。続きは「続きから再開する」で再開できます。";
  return `
    <div class="modal-backdrop pause-menu-modal">
      <div class="modal">
        <h3>メニューに戻りますか？</h3>
        <p class="lead">${desc}</p>
        <button class="btn btn-primary" onclick="App.confirmPauseToTitle()">タイトルに戻る</button>
        <button class="btn" onclick="App.togglePauseMenu()">プレイに戻る</button>
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

// プレイヤー情報(名前・所持コイン・おやつ数)を画面四隅に表示する(2026-08-12、マリオパーティの
// 常時ステータス表示を参考に、単一プレイヤーの縦積みHUDから変更)。players[0]は必ず人間
// (startSnackGameのconfigs順)なので左上=自分、以降CPUを右上→左下→右下の順に配置する。
// 5人以上になることは無い(setup画面のCPU選択が最大3人=計4人)前提の簡易実装。
const SNACK_CORNER_POSITIONS = ["topleft", "topright", "bottomleft", "bottomright"];

function renderSnackHUD(state, me) {
  const roundsLeft = Math.max(0, state.totalRounds - state.round + 1);
  const corners = state.players
    .slice(0, SNACK_CORNER_POSITIONS.length)
    .map((p, i) => {
      const visual = p.avatar || { color: "#e4572e", speciesEmoji: null, costumeImage: null };
      const isActive = p.id === state.players[state.currentTurnIndex].id;
      return `
        <div class="snack-corner snack-corner-${SNACK_CORNER_POSITIONS[i]}${isActive ? " snack-corner-active" : ""}">
          ${renderAvatarBadge(visual, 30)}
          <div class="snack-corner-info">
            <span class="snack-corner-name">${escapeHtml(p.name)}${p.isCPU ? "(CPU)" : ""}</span>
            <span class="snack-corner-stats">🍪${p.snacks} 🪙${p.matchCoins}</span>
          </div>
        </div>
      `;
    })
    .join("");
  return `
    <div class="snack-round-badge">⏳ 残り${roundsLeft}ラウンド ・ 🎒${me.items.length}/${SNACK_ITEM_SLOT_LIMIT}</div>
    <div class="snack-corner-hud">${corners}</div>
  `;
}

function renderSnackItemList(player, usable) {
  if (!player.items.length) return `<p class="lead">アイテムは持っていません</p>`;
  const rows = player.items
    .map((itemId) => {
      const item = SNACK_ITEMS.find((it) => it.id === itemId);
      if (!item) return "";
      const actionHtml = usable ? `<button class="btn btn-offer" onclick="App.snackUseItem('${item.id}')">使う</button>` : "";
      return `
        <li class="player-row">
          ${renderItemIcon(item, 28)}
          <span class="p-name">${escapeHtml(item.name)}</span>
          ${actionHtml}
        </li>
      `;
    })
    .join("");
  return `<ul class="player-list">${rows}</ul>`;
}

function renderSnackHub(state, humanId, hub, showEndTurn) {
  const view = (hub && hub.view) || "menu";
  const me = state.players.find((p) => p.id === humanId);
  if (view === "spinning") {
    // 出目の表示自体は3Dマップ側(snack-board3d.jsのplayDiceRoll、頭上で回転→ジャンプで停止)が
    // 担当するため、ここは操作を止めるための軽い案内のみ表示する。
    return `
      <div class="turn-hub-modal">
        <div class="roulette-display">
          <p class="lead">🎲 サイコロを振っています…</p>
        </div>
      </div>
    `;
  }
  if (view === "items") {
    return `
      <div class="turn-hub-modal">
        <div class="turn-hub-card">
          <h3>アイテムを使う</h3>
          ${renderSnackItemList(me, true)}
          <button class="btn" onclick="App.showSnackHubView('menu')">戻る</button>
        </div>
      </div>
    `;
  }
  return `
    <div class="hub-bar">
      ${showEndTurn ? `<button class="hub-bar-btn" onclick="App.snackShowShop()"><span class="hub-bar-icon">🏪</span><span class="hub-bar-label">ショップ</span></button>` : ""}
      ${!showEndTurn ? `<button class="hub-bar-btn hub-bar-btn-primary" onclick="App.snackRoll()"><span class="hub-bar-icon">🎲</span><span class="hub-bar-label">サイコロ</span></button>` : ""}
      <button class="hub-bar-btn" onclick="App.showSnackHubView('items')"><span class="hub-bar-icon">🎒</span><span class="hub-bar-label">アイテム</span></button>
      <button class="hub-bar-btn" onclick="App.snackToggleLog()"><span class="hub-bar-icon">📜</span><span class="hub-bar-label">ログ</span></button>
      ${showEndTurn ? `<button class="hub-bar-btn hub-bar-btn-primary" onclick="App.snackEndTurn()"><span class="hub-bar-icon">➡️</span><span class="hub-bar-label">つぎへ</span></button>` : ""}
    </div>
  `;
}

function renderSnackBranchModal(state, isHumanTurn) {
  if (!state.pendingBranch) return "";
  const branchNode = findSnackNode(state.pendingBranch.nodeId);
  const player = state.players.find((p) => p.id === state.pendingBranch.playerId);
  if (!isHumanTurn) {
    return `
      <div class="modal-backdrop">
        <div class="modal">
          <div class="modal-telop">
            <h3>分かれ道</h3>
            <p>${escapeHtml(player.name)}が考え中…</p>
          </div>
        </div>
      </div>
    `;
  }
  const buttons = branchNode.nextNodeIds
    .map((nid, i) => {
      const isShortcut = i === 1;
      const label = isShortcut ? `近道(内周)へ進む(通行料 ${branchNode.tollCost}コイン)` : "そのまま外周を進む";
      return `<button class="btn btn-offer" onclick="App.snackChooseBranch('${nid}')">${label}</button>`;
    })
    .join("");
  return `
    <div class="modal-backdrop">
      <div class="modal">
        <div class="modal-telop">
          <h3>分かれ道</h3>
          <p>外周をそのまま進むか、近道の内周へ入るか選んでください。</p>
        </div>
        <p class="coin-display">🪙 所持コイン: ${state.players.find((p) => p.id === state.pendingBranch.playerId).matchCoins}</p>
        ${buttons}
      </div>
    </div>
  `;
}

function renderSnackSnackChoiceModal(state, isHumanTurn) {
  if (!state.pendingSnackChoice) return "";
  const player = state.players.find((p) => p.id === state.pendingSnackChoice.playerId);
  if (!isHumanTurn) {
    return `
      <div class="modal-backdrop">
        <div class="modal">
          <div class="modal-telop">
            <h3>🍪 おやつ発見！</h3>
            <p>${escapeHtml(player.name)}が考え中…</p>
          </div>
        </div>
      </div>
    `;
  }
  return `
    <div class="modal-backdrop">
      <div class="modal">
        <div class="modal-telop">
          <h3>🍪 おやつ発見！</h3>
          <p>${SNACK_SNACK_PRICE}コインで、おやつを手に入れますか？(所持コイン: ${player.matchCoins})</p>
        </div>
        <button class="btn btn-offer" onclick="App.snackChooseSnackPurchase(true)">買う(-${SNACK_SNACK_PRICE})</button>
        <button class="btn btn-offer" onclick="App.snackChooseSnackPurchase(false)">見送る</button>
      </div>
    </div>
  `;
}

function renderSnackStopChoiceModal(state, isHumanTurn) {
  if (!state.pendingStopChoice) return "";
  const pc = state.pendingStopChoice;
  const player = state.players.find((p) => p.id === pc.playerId);
  if (!isHumanTurn) {
    return `
      <div class="modal-backdrop">
        <div class="modal">
          <div class="modal-telop">
            <h3>${escapeHtml(pc.title)}</h3>
            <p>${escapeHtml(player.name)}が考え中…</p>
          </div>
        </div>
      </div>
    `;
  }
  const optionButtons = pc.options
    .map((o, i) => `<button class="btn btn-offer" onclick="App.snackChooseStopOption(${i})">${escapeHtml(o.label)}</button>`)
    .join("");
  return `
    <div class="modal-backdrop">
      <div class="modal">
        <div class="modal-telop">
          <h3>${escapeHtml(pc.title)}</h3>
          <p>${escapeHtml(pc.prompt)}</p>
        </div>
        ${optionButtons}
      </div>
    </div>
  `;
}

function renderSnackShopModal(me) {
  const cards = SNACK_ITEMS
    .map((it) => {
      const canBuy = me.items.length < SNACK_ITEM_SLOT_LIMIT && me.matchCoins >= it.price;
      const actionHtml = `<button class="btn btn-offer shop-card-btn" ${canBuy ? "" : "disabled"} onclick="App.snackBuyShopItem('${it.id}')">${buyButtonLabel(it.price, me.matchCoins)}</button>`;
      return renderShopCard({ iconHtml: renderItemIcon(it, 44), name: escapeHtml(it.name), badgeHtml: "", actionHtml, cardClass: !canBuy ? "shop-card-cant-afford" : "" });
    })
    .join("");
  return `
    <div class="modal-backdrop">
      <div class="modal">
        <h3>🏪 ショップ(アイテム所持: ${me.items.length}/${SNACK_ITEM_SLOT_LIMIT})</h3>
        <p class="coin-display">🪙 所持コイン: ${me.matchCoins}</p>
        <div class="shop-grid">${cards}</div>
        <button class="btn" onclick="App.showSnackHubView('menu')">閉じる</button>
      </div>
    </div>
  `;
}

function renderSnackGameScreen(snack, humanId, pauseMenuOpen) {
  const state = snack.state;
  const turnPlayer = state.players[state.currentTurnIndex];
  const isHumanTurn = turnPlayer.id === humanId;
  const hasPending = !!(state.pendingBranch || state.pendingSnackChoice || state.pendingStopChoice);
  const isCPUSpinning = !isHumanTurn && snack.hub && snack.hub.view === "spinning";
  const me = state.players.find((p) => p.id === humanId);
  const movementDone = !hasPending && turnPlayer.turnRolled && turnPlayer.remainingSteps === 0;
  const showHub = (isHumanTurn && !hasPending) || isCPUSpinning;
  return `
    <section class="screen screen-game screen-snack-game">
      ${renderSnackHUD(state, me)}
      ${showHub ? renderSnackHub(state, humanId, snack.hub, movementDone && isHumanTurn) : ""}
      ${renderSnackBranchModal(state, isHumanTurn)}
      ${renderSnackSnackChoiceModal(state, isHumanTurn)}
      ${renderSnackStopChoiceModal(state, isHumanTurn)}
      ${snack.hub && snack.hub.view === "shop" ? renderSnackShopModal(me) : ""}
      ${snack.logOpen ? renderSnackLogModal(snack.log) : ""}
      ${pauseMenuOpen ? renderPauseMenuModal("snack") : ""}
    </section>
  `;
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
