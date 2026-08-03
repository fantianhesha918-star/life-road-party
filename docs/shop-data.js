// ライフロード ショップ・アバターアイテムのオリジナルデータ

// 無料の基本色(最初から所持済み、game-data.jsのTOKEN_COLORSと対応)
const FREE_COLOR_ITEMS = [
  { id: "color-red", category: "color", name: "レッド", price: 0, value: "#e4572e" },
  { id: "color-blue", category: "color", name: "ブルー", price: 0, value: "#2e86ab" },
  { id: "color-green", category: "color", name: "グリーン", price: 0, value: "#5cb270" },
  { id: "color-orange", category: "color", name: "オレンジ", price: 0, value: "#f4a300" },
  { id: "color-purple", category: "color", name: "パープル", price: 0, value: "#8e5ea2" },
  { id: "color-pink", category: "color", name: "ピンク", price: 0, value: "#e05d9c" },
];

// コインで購入できるプレミアムアイテム
const SHOP_ITEMS = [
  { id: "color-gold", category: "color", name: "ゴールド", price: 80, value: "#d4af37" },
  { id: "color-neon", category: "color", name: "ネオングリーン", price: 80, value: "#39ff14" },
  { id: "color-sky", category: "color", name: "スカイブルー", price: 60, value: "#7fd8ff" },

  { id: "hat-cap", category: "hat", name: "キャップ", price: 30, emoji: "🧢" },
  { id: "hat-tophat", category: "hat", name: "シルクハット", price: 50, emoji: "🎩" },
  { id: "hat-grad", category: "hat", name: "卒業帽", price: 60, emoji: "🎓" },
  { id: "hat-crown", category: "hat", name: "王冠", price: 150, emoji: "👑" },

  { id: "acc-sunglasses", category: "accessory", name: "サングラス", price: 40, emoji: "🕶️" },
  { id: "acc-bowtie", category: "accessory", name: "蝶ネクタイ", price: 40, emoji: "🎀" },
  { id: "acc-ring", category: "accessory", name: "指輪", price: 70, emoji: "💍" },
  { id: "acc-star", category: "accessory", name: "スターバッジ", price: 90, emoji: "⭐" },
];

const ALL_ITEMS = [...FREE_COLOR_ITEMS, ...SHOP_ITEMS];

const DEFAULT_EQUIPPED = { color: "color-red", hat: null, accessory: null };

const FREE_ITEM_IDS = FREE_COLOR_ITEMS.map((it) => it.id);

const GAME_REWARD_MONEY_PER_COIN = 10; // ゲーム内所持金10万円につき1コイン

window.LifeRoadShop = { ALL_ITEMS, FREE_ITEM_IDS, DEFAULT_EQUIPPED, GAME_REWARD_MONEY_PER_COIN };
