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

// ターン中に「アイテムを使う」で消費する消耗品(所持数は複数持てる、使うと1つ減る)
// effect.min === effect.max の場合は固定額、異なる場合はその範囲でランダムな金額を得る
const CONSUMABLE_ITEMS = [
  { id: "item-money-ticket", category: "consumable", name: "臨時収入チケット", price: 20, emoji: "🎫", effect: { min: 15, max: 15 } },
  { id: "item-fortune-charm", category: "consumable", name: "幸運のお守り", price: 35, emoji: "🍀", effect: { min: 5, max: 25 } },
  { id: "item-tax-shield", category: "consumable", name: "節税シール", price: 50, emoji: "🛡️", effect: { min: 30, max: 30 } },
];

// キャラクターの動物種(全種すべて最初から無料所持)。イラスト未準備のため絵文字で代用中。
// 実イラストが揃ったら`emoji`を画像パスに差し替える想定
const SPECIES_ITEMS = [
  { id: "species-chinchilla-gray", category: "species", name: "チンチラ(グレー)", price: 0, emoji: "🐹" },
  { id: "species-chinchilla-white", category: "species", name: "チンチラ(白パイド)", price: 0, emoji: "🐹" },
  { id: "species-dog-frenchie-white", category: "species", name: "いぬ(フレンチブルドッグ・白)", price: 0, emoji: "🐶" },
  { id: "species-dog-frenchie-black", category: "species", name: "いぬ(フレンチブルドッグ・黒)", price: 0, emoji: "🐶" },
  { id: "species-cat-calico", category: "species", name: "ねこ(三毛猫)", price: 0, emoji: "🐱" },
  { id: "species-rabbit-white", category: "species", name: "うさぎ(白)", price: 0, emoji: "🐰" },
];

const ALL_ITEMS = [...FREE_COLOR_ITEMS, ...SHOP_ITEMS, ...CONSUMABLE_ITEMS, ...SPECIES_ITEMS];

const DEFAULT_EQUIPPED = { color: "color-red", species: "species-chinchilla-gray", hat: null, accessory: null };

const FREE_ITEM_IDS = [...FREE_COLOR_ITEMS.map((it) => it.id), ...SPECIES_ITEMS.map((it) => it.id)];

const GAME_REWARD_MONEY_PER_COIN = 10; // ゲーム内所持金10万円につき1コイン

window.LifeRoadShop = { ALL_ITEMS, CONSUMABLE_ITEMS, SPECIES_ITEMS, FREE_ITEM_IDS, DEFAULT_EQUIPPED, GAME_REWARD_MONEY_PER_COIN };
