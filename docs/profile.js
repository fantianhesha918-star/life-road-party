// ライフロード プレイヤープロフィール(端末ローカル保存: コイン・所持アイテム・装備)
// 通信モードでは、装備中の見た目だけを対局参加時に部屋データへ送る(コイン等は送らない)

const PROFILE_KEY = "liferoad_profile_v1";

function defaultProfile() {
  return {
    coins: 0,
    ownedItems: [...FREE_ITEM_IDS],
    equipped: { ...DEFAULT_EQUIPPED },
    consumables: {},
    gamesPlayed: 0,
    totalCoinsEarned: 0,
    firstPlaceCount: 0,
    bestMoney: 0,
  };
}

function loadProfile() {
  try {
    const raw = localStorage.getItem(PROFILE_KEY);
    if (!raw) return defaultProfile();
    const parsed = JSON.parse(raw);
    const consumables = {};
    if (parsed.consumables && typeof parsed.consumables === "object") {
      for (const [id, count] of Object.entries(parsed.consumables)) {
        if (typeof count === "number" && count > 0 && findShopItem(id)) consumables[id] = count;
      }
    }
    return {
      coins: typeof parsed.coins === "number" ? parsed.coins : 0,
      ownedItems: Array.isArray(parsed.ownedItems)
        ? Array.from(new Set([...parsed.ownedItems, ...FREE_ITEM_IDS]))
        : [...FREE_ITEM_IDS],
      equipped: { ...DEFAULT_EQUIPPED, ...(parsed.equipped || {}) },
      consumables,
      gamesPlayed: typeof parsed.gamesPlayed === "number" ? parsed.gamesPlayed : 0,
      totalCoinsEarned: typeof parsed.totalCoinsEarned === "number" ? parsed.totalCoinsEarned : 0,
      firstPlaceCount: typeof parsed.firstPlaceCount === "number" ? parsed.firstPlaceCount : 0,
      bestMoney: typeof parsed.bestMoney === "number" ? parsed.bestMoney : 0,
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
  if (item.category === "consumable") {
    if (profile.coins < item.price) return { ok: false, reason: "insufficient-coins" };
    profile.coins -= item.price;
    profile.consumables[itemId] = (profile.consumables[itemId] || 0) + 1;
    return { ok: true };
  }
  if (profile.ownedItems.includes(itemId)) return { ok: false, reason: "already-owned" };
  if (profile.coins < item.price) return { ok: false, reason: "insufficient-coins" };
  profile.coins -= item.price;
  profile.ownedItems.push(itemId);
  return { ok: true };
}

// 消耗品を1つ使う。所持数を減らし、効果(所持金の増減額)を返す
function useConsumableItem(profile, itemId) {
  const item = findShopItem(itemId);
  if (!item || item.category !== "consumable") return { ok: false, reason: "item-not-found" };
  const count = profile.consumables[itemId] || 0;
  if (count <= 0) return { ok: false, reason: "not-owned" };
  if (count <= 1) {
    delete profile.consumables[itemId];
  } else {
    profile.consumables[itemId] = count - 1;
  }
  const { min, max } = item.effect;
  const delta = min === max ? min : randIntInclusive(min, max);
  return { ok: true, item, delta };
}

function randIntInclusive(min, max) {
  return min + Math.floor(Math.random() * (max - min + 1));
}

// category: "color" | "species" | "costume"。costumeはitemId=nullで「なし」にできる
function equipItem(profile, category, itemId) {
  if (itemId !== null) {
    if (!profile.ownedItems.includes(itemId)) return { ok: false, reason: "not-owned" };
    const item = findShopItem(itemId);
    if (!item || item.category !== category) return { ok: false, reason: "category-mismatch" };
  } else if (category === "color" || category === "species") {
    return { ok: false, reason: category === "color" ? "color-required" : "species-required" }; // 色・種は「なし」にできない
  }
  profile.equipped[category] = itemId;
  return { ok: true };
}

// 対局終了時の報酬計算(finalMoney: そのプレイヤーのゲーム内最終所持金)
function computeGameReward(finalMoney) {
  return Math.max(0, Math.floor(finalMoney / GAME_REWARD_MONEY_PER_COIN));
}

function applyGameReward(profile, finalMoney, isFirstPlace) {
  const reward = computeGameReward(finalMoney);
  profile.coins += reward;
  profile.gamesPlayed += 1;
  profile.totalCoinsEarned += reward;
  profile.bestMoney = Math.max(profile.bestMoney, finalMoney);
  if (isFirstPlace) profile.firstPlaceCount += 1;
  return reward;
}

function getAvatarVisual(equipped) {
  const colorItem = findShopItem(equipped.color) || findShopItem(DEFAULT_EQUIPPED.color);
  const speciesItem = findShopItem(equipped.species) || findShopItem(DEFAULT_EQUIPPED.species);
  const costumeItem = equipped.costume ? findShopItem(equipped.costume) : null;
  const costumeImage = costumeItem && speciesItem ? costumeItem.images[speciesItem.id] || null : null;
  return {
    color: colorItem ? colorItem.value : "#999999",
    speciesId: speciesItem ? speciesItem.id : null,
    speciesEmoji: speciesItem ? speciesItem.emoji : null,
    costumeId: costumeItem ? costumeItem.id : null,
    costumeImage,
  };
}

window.LifeRoadProfile = {
  loadProfile,
  saveProfile,
  purchaseItem,
  useConsumableItem,
  equipItem,
  computeGameReward,
  applyGameReward,
  getAvatarVisual,
  findShopItem,
};
