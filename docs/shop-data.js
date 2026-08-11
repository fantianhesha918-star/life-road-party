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
];

// 全身コスチューム(帽子・アクセサリーの後継)。動物種ごとに体型へフィットさせた専用イラストを
// 1着につき6種類ぶん用意し、images[speciesId]で引く(docs/costumes/配下、Codex作成の実イラスト)。
// 未購入時はui.js側でシルエット表示、購入後はカラー表示に切り替える。
const COSTUME_ITEMS = [
  {
    id: "costume-kimono", category: "costume", name: "着物", price: 100, emoji: "👘",
    images: {
      "species-chinchilla-gray": "costumes/costume-kimono_chinchilla-gray.png",
      "species-chinchilla-white": "costumes/costume-kimono_chinchilla-white-pied.png",
      "species-dog-frenchie-white": "costumes/costume-kimono_dog-frenchie-white.png",
      "species-dog-frenchie-black": "costumes/costume-kimono_dog-frenchie-black.png",
      "species-cat-calico": "costumes/costume-kimono_cat-calico.png",
      "species-rabbit-white": "costumes/costume-kimono_rabbit-white.png",
    },
  },
  {
    id: "costume-suit", category: "costume", name: "スーツ", price: 110, emoji: "🤵",
    images: {
      "species-chinchilla-gray": "costumes/costume-suit_chinchilla-gray.png",
      "species-chinchilla-white": "costumes/costume-suit_chinchilla-white-pied.png",
      "species-dog-frenchie-white": "costumes/costume-suit_dog-frenchie-white.png",
      "species-dog-frenchie-black": "costumes/costume-suit_dog-frenchie-black.png",
      "species-cat-calico": "costumes/costume-suit_cat-calico.png",
      "species-rabbit-white": "costumes/costume-suit_rabbit-white.png",
    },
  },
  {
    id: "costume-ninja", category: "costume", name: "忍者", price: 100, emoji: "🥷",
    images: {
      "species-chinchilla-gray": "costumes/costume-ninja_chinchilla-gray.png",
      "species-chinchilla-white": "costumes/costume-ninja_chinchilla-white-pied.png",
      "species-dog-frenchie-white": "costumes/costume-ninja_dog-frenchie-white.png",
      "species-dog-frenchie-black": "costumes/costume-ninja_dog-frenchie-black.png",
      "species-cat-calico": "costumes/costume-ninja_cat-calico.png",
      "species-rabbit-white": "costumes/costume-ninja_rabbit-white.png",
    },
  },
  {
    id: "costume-bear-onesie", category: "costume", name: "くまの着ぐるみ", price: 90, emoji: "🧸",
    images: {
      "species-chinchilla-gray": "costumes/costume-bear-onesie_chinchilla-gray.png",
      "species-chinchilla-white": "costumes/costume-bear-onesie_chinchilla-white-pied.png",
      "species-dog-frenchie-white": "costumes/costume-bear-onesie_dog-frenchie-white.png",
      "species-dog-frenchie-black": "costumes/costume-bear-onesie_dog-frenchie-black.png",
      "species-cat-calico": "costumes/costume-bear-onesie_cat-calico.png",
      "species-rabbit-white": "costumes/costume-bear-onesie_rabbit-white.png",
    },
  },
];

// ターン中に「アイテムを使う」で消費する消耗品(所持数は複数持てる、使うと1つ減る)
// effect.min === effect.max の場合は固定額、異なる場合はその範囲でランダムな金額を得る
// imageはdocs/images/items/配下の実イラスト(Codex作成、背景透過)へのパス。絵文字より優先して表示する。
const CONSUMABLE_ITEMS = [
  { id: "item-money-ticket", category: "consumable", name: "臨時収入チケット", price: 20, emoji: "🎫", image: "images/items/item-money-ticket.png", effect: { min: 15, max: 15 } },
  { id: "item-fortune-charm", category: "consumable", name: "幸運のお守り", price: 35, emoji: "🍀", image: "images/items/item-fortune-charm.png", effect: { min: 5, max: 25 } },
  { id: "item-tax-shield", category: "consumable", name: "節税シール", price: 50, emoji: "🛡️", image: "images/items/item-tax-shield.png", effect: { min: 30, max: 30 } },
];

// 株券アイコン(購入可能な消耗品ではなく、保有株数の表示に使う実イラスト)
const STOCK_CERTIFICATE_IMAGE = "images/items/item-stock-certificate.png";

// キャラクターの動物種(全種すべて最初から無料所持)。avatarImageはdocs/avatars/配下の
// 実イラスト(Codex作成、背景透過)へのパス。アバターバッジ(ui.jsのrenderAvatarBadge)は
// このavatarImageがあれば絵文字より優先して表示する。
// shortNameは、キャラクター編集画面の3列カード(species-card、幅が狭く長い名前だと
// 3行に折り返ってしまう)専用の短縮表示名。無い場合はnameをそのまま使う。正式名(name)は
// ショップ一覧など横幅に余裕がある場所でこれまで通り使う(レビュー指摘対応、2026-08-11)。
const SPECIES_ITEMS = [
  { id: "species-chinchilla-gray", category: "species", name: "チンチラ(グレー)", price: 0, emoji: "🐹", avatarImage: "avatars/chinchilla-gray.png" },
  { id: "species-chinchilla-white", category: "species", name: "チンチラ(白パイド)", shortName: "チンチラ(白)", price: 0, emoji: "🐹", avatarImage: "avatars/chinchilla-white-pied.png" },
  { id: "species-dog-frenchie-white", category: "species", name: "いぬ(フレンチブルドッグ・白)", shortName: "フレブル(白)", price: 0, emoji: "🐶", avatarImage: "avatars/dog-frenchie-white.png" },
  { id: "species-dog-frenchie-black", category: "species", name: "いぬ(フレンチブルドッグ・黒)", shortName: "フレブル(黒)", price: 0, emoji: "🐶", avatarImage: "avatars/dog-frenchie-black.png" },
  { id: "species-cat-calico", category: "species", name: "ねこ(三毛猫)", price: 0, emoji: "🐱", avatarImage: "avatars/cat-calico.png" },
  { id: "species-rabbit-white", category: "species", name: "うさぎ(白)", price: 0, emoji: "🐰", avatarImage: "avatars/rabbit-white.png" },
  { id: "species-human-male", category: "species", name: "にんげん(男の子)", shortName: "にんげん(男)", price: 0, emoji: "🧑", avatarImage: "avatars/human-male.png" },
  { id: "species-human-female", category: "species", name: "にんげん(女の子)", shortName: "にんげん(女)", price: 0, emoji: "👧", avatarImage: "avatars/human-female.png" },
];

const ALL_ITEMS = [...FREE_COLOR_ITEMS, ...SHOP_ITEMS, ...COSTUME_ITEMS, ...CONSUMABLE_ITEMS, ...SPECIES_ITEMS];

const DEFAULT_EQUIPPED = { color: "color-red", species: "species-chinchilla-gray", costume: null };

const FREE_ITEM_IDS = [...FREE_COLOR_ITEMS.map((it) => it.id), ...SPECIES_ITEMS.map((it) => it.id)];

const GAME_REWARD_MONEY_PER_COIN = 10; // ゲーム内所持金10万円につき1コイン

window.LifeRoadShop = { ALL_ITEMS, COSTUME_ITEMS, CONSUMABLE_ITEMS, SPECIES_ITEMS, FREE_ITEM_IDS, DEFAULT_EQUIPPED, GAME_REWARD_MONEY_PER_COIN, STOCK_CERTIFICATE_IMAGE };
