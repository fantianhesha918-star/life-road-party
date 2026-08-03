// ライフロード プレイヤープロフィール(端末ローカル保存: コイン・所持アイテム・装備)
// 通信モードでは、装備中の見た目だけを対局参加時に部屋データへ送る(コイン等は送らない)

const PROFILE_KEY = "liferoad_profile_v1";

function defaultProfile() {
  return {
    coins: 0,
    ownedItems: [...FREE_ITEM_IDS],
    equipped: { ...DEFAULT_EQUIPPED },
    gamesPlayed: 0,
  };
}

function loadProfile() {
  try {
    const raw = localStorage.getItem(PROFILE_KEY);
    if (!raw) return defaultProfile();
    const parsed = JSON.parse(raw);
    return {
      coins: typeof parsed.coins === "number" ? parsed.coins : 0,
      ownedItems: Array.isArray(parsed.ownedItems)
        ? Array.from(new Set([...parsed.ownedItems, ...FREE_ITEM_IDS]))
        : [...FREE_ITEM_IDS],
      equipped: { ...DEFAULT_EQUIPPED, ...(parsed.equipped || {}) },
      gamesPlayed: typeof parsed.gamesPlayed === "number" ? parsed.gamesPlayed : 0,
    };
  } catch (e) {
    return defaultProfile();
  }
}

function saveProfile(profile) {
  try {
    localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
  } catch (e) {
    // 保存できなくても致命的ではないので無視
  }
}

function findShopItem(itemId) {
  return ALL_ITEMS.find((it) => it.id === itemId) || null;
}

function purchaseItem(profile, itemId) {
  const item = findShopItem(itemId);
  if (!item) return { ok: false, reason: "item-not-found" };
  if (profile.ownedItems.includes(itemId)) return { ok: false, reason: "already-owned" };
  if (profile.coins < item.price) return { ok: false, reason: "insufficient-coins" };
  profile.coins -= item.price;
  profile.ownedItems.push(itemId);
  return { ok: true };
}

// category: "color" | "hat" | "accessory"。hat/accessoryはitemId=nullで「なし」にできる
function equipItem(profile, category, itemId) {
  if (itemId !== null) {
    if (!profile.ownedItems.includes(itemId)) return { ok: false, reason: "not-owned" };
    const item = findShopItem(itemId);
    if (!item || item.category !== category) return { ok: false, reason: "category-mismatch" };
  } else if (category === "color") {
    return { ok: false, reason: "color-required" }; // 色は「なし」にできない
  }
  profile.equipped[category] = itemId;
  return { ok: true };
}

// 対局終了時の報酬計算(finalMoney: そのプレイヤーのゲーム内最終所持金)
function computeGameReward(finalMoney) {
  return Math.max(0, Math.floor(finalMoney / GAME_REWARD_MONEY_PER_COIN));
}

function applyGameReward(profile, finalMoney) {
  const reward = computeGameReward(finalMoney);
  profile.coins += reward;
  profile.gamesPlayed += 1;
  return reward;
}

function getAvatarVisual(equipped) {
  const colorItem = findShopItem(equipped.color) || findShopItem(DEFAULT_EQUIPPED.color);
  const hatItem = equipped.hat ? findShopItem(equipped.hat) : null;
  const accItem = equipped.accessory ? findShopItem(equipped.accessory) : null;
  return {
    color: colorItem ? colorItem.value : "#999999",
    hatEmoji: hatItem ? hatItem.emoji : null,
    accessoryEmoji: accItem ? accItem.emoji : null,
  };
}

window.LifeRoadProfile = {
  loadProfile,
  saveProfile,
  purchaseItem,
  equipItem,
  computeGameReward,
  applyGameReward,
  getAvatarVisual,
  findShopItem,
};
