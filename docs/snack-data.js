// アニマルライフ「おやつ集めモード」フェーズ1(試作)のマップ・アイテム・イベントデータ
// 既存の人生ゲームモード(game-data.js)とは経済の単位・盤面構造が別物のため、
// 通貨・イベント・マップとも独立して新規定義する(既存データは一切変更しない)。

const SNACK_TOTAL_ROUNDS = 10; // 1ラウンド = 全員が1回ずつ動く(既存メモの確定定義)
const SNACK_START_COINS = 10;
const SNACK_SNACK_PRICE = 20;
const SNACK_BRANCH_TOLL = 5; // 内周(近道)へ入る際の通行料

// ラストスパート(仕様書14章FINAL_SPRINT)。「残り3ラウンド」からを対象とするので
// totalRounds(10)からのオフセットは2(=第8ラウンド開始から)。倍率は仕様書に具体数値が
// 無かったため「少し増やす」の解釈として控えめな1.3倍を採用。
const SNACK_FINAL_SPRINT_ROUND_OFFSET = 2;
const SNACK_FINAL_SPRINT_COIN_MULT = 1.3;

// 職業ランク(A〜E)。人生ゲームモードのJOB_OFFERSとは通貨単位が違う別経済のため専用に用意。
const SNACK_JOB_RANKS = [
  { name: "パンやさん", rank: "A", salary: 12 },
  { name: "かいしゃいん", rank: "B", salary: 11 },
  { name: "ざっかやさん", rank: "C", salary: 10 },
  { name: "ゆうびんはいたつ", rank: "D", salary: 9 },
  { name: "みならい", rank: "E", salary: 8 },
];
const SNACK_UNEMPLOYED_INCOME = 4;

// 停止時に発動する収入/支出/選択イベント(試作用の小さな束、必要に応じて増やす)
const SNACK_INCOME_EVENTS = [
  { text: "道でコインを拾った", delta: 5 },
  { text: "お手伝いをしてお駄賃をもらった", delta: 6 },
  { text: "落とし物を届けてお礼をもらった", delta: 7 },
  { text: "お店の手伝いで臨時収入", delta: 6 },
];
const SNACK_EXPENSE_EVENTS = [
  { text: "うっかり忘れ物をして買い直した", delta: -3 },
  { text: "水たまりに落ちて服がよごれた(クリーニング代)", delta: -4 },
  { text: "おなかがすいて出店で軽食を買った", delta: -3 },
];
// 選択イベント: 安全側(低リスク低リターン) / 挑戦側(高リスク高リターン、失敗もある)
const SNACK_CHOICE_EVENTS = [
  {
    title: "近道か、まわり道か",
    prompt: "細い橋を渡れば近道だが、足を滑らせるかもしれない。安全に回り道する？",
    options: [
      { label: "安全に回り道する", outcomes: [{ weight: 1, delta: 2, resultText: "無事に回り道できた(+2)" }] },
      {
        label: "近道の橋を渡る",
        outcomes: [
          { weight: 1, delta: 8, resultText: "うまく渡り切って近道できた(+8)" },
          { weight: 1, delta: -5, resultText: "足を滑らせてコインを落とした(-5)" },
        ],
      },
    ],
  },
  {
    title: "屋台のお宝箱",
    prompt: "屋台で「お宝箱」を見つけた。開けてみる？",
    options: [
      { label: "開けずにそのまま進む", outcomes: [{ weight: 1, delta: 0, resultText: "何もせず進んだ" }] },
      {
        label: "開けてみる",
        outcomes: [
          { weight: 1, delta: 9, resultText: "当たり！コインがざくざく出てきた(+9)" },
          { weight: 1, delta: -3, resultText: "ハズレ、掃除代がかかった(-3)" },
        ],
      },
    ],
  },
];

// アイテムショップ(フェーズ1は4種のみ、matchCoins専用の別経済)
const SNACK_ITEMS = [
  { id: "snack-item-dice-plus1", name: "追加サイコロ+1個", price: 6, emoji: "🎲", effect: "extraDice", value: 1 },
  { id: "snack-item-mischief-fruit", name: "いたずらの実", price: 7, emoji: "🍒", effect: "trap" },
  { id: "snack-item-sniff-grass", name: "鼻きき草", price: 5, emoji: "🌿", effect: "hint" },
  { id: "snack-item-charm", name: "おまもり", price: 7, emoji: "🛡️", effect: "guard" },
];
const SNACK_ITEM_SLOT_LIMIT = 3;

// P1〜P4固定色(座席番号ベース、行動順が変わっても不変。素材説明書のカラーコードそのまま)
const SNACK_PLAYER_COLORS = [
  { seatNumber: 1, label: "P1", main: "#2F80ED", dark: "#1557A0", mark: "🐾" },
  { seatNumber: 2, label: "P2", main: "#EB5757", dark: "#9B2C2C", mark: "⭐" },
  { seatNumber: 3, label: "P3", main: "#9B51E0", dark: "#63319A", mark: "🍃" },
  { seatNumber: 4, label: "P4", main: "#27AE60", dark: "#176B3B", mark: "🌸" },
];

function snackPlayerColor(seatNumber) {
  return SNACK_PLAYER_COLORS[(seatNumber - 1 + SNACK_PLAYER_COLORS.length) % SNACK_PLAYER_COLORS.length];
}

// ==================== ノードグラフ(外周48+内周16=64ノード) ====================
// Codex連携チャットが試作着手前に用意していたマップ見本(map-stage1-animal-town-ring-park.png)・
// 引き継ぎ書(ClaudeCode向け_マップ制作引き継ぎ.md)に沿って、外周48+内周16ノード・
// 4方向の外周⇄内周接続に作り直したもの(2026-08-12、初版は見本を参照せず外周24+内周8・
// 分岐1箇所の簡易版で実装していたことが判明し、見た目を見本相当に近づけるため再設計した)。
// 内周は一方通行の近道ではなく、それ自体が閉じたループ(外周と同心円の内側の輪)。
// 4箇所の分岐点(SNACK_BRANCH_OUTER_INDEXES)で内周へ入ると通行料(SNACK_BRANCH_TOLL)がかかり、
// 内周を進んだ先の4箇所(出口は入口から2ノード先、SNACK_INNER_EXIT_OFFSET)で外周へ無料で
// 戻れる(戻る際は入口から3ノード先の外周ノードへ合流し、近道した分だけ進む)。

const SNACK_OUTER_COUNT = 48;
const SNACK_INNER_COUNT = 16;
const SNACK_BRANCH_OUTER_INDEXES = [6, 18, 30, 42]; // 内周への入口(4方向、各90度おき)
const SNACK_INNER_ENTRY_INDEXES = [0, 4, 8, 12]; // 対応する内周側の入口(SNACK_BRANCH_OUTER_INDEXESと同じ並び順)
const SNACK_INNER_EXIT_OFFSET = 2; // 入口から何ノード進んだ内周ノードに外周への出口を用意するか
const SNACK_OUTER_REJOIN_OFFSET = 3; // 出口が外周へ合流する際、対応する入口から何ノード先へ合流するか

// マスの種類(見本の「北西=駅、北=オフィス/ショップ、東=学校/病院/集合住宅、南=教会/住宅、
// 西=公園」という方角ゾーン)とは別に、3D側の建物配置だけに使う見た目専用の分類。
// ゲームロジック(snack-engine.js/snack-cpu.js)はこの値を一切参照しない。
const SNACK_OUTER_ZONES = [
  { name: "station", from: 44, to: 3 }, // 北西: 駅・スタート地点(wrap)
  { name: "office", from: 4, to: 11 }, // 北: 就職センター・ショップA
  { name: "school", from: 12, to: 21 }, // 東: 学校・病院・集合住宅
  { name: "church", from: 22, to: 33 }, // 南: 教会・住宅・ショップB
  { name: "park", from: 34, to: 43 }, // 西: 公園
];

function snackOuterZoneForIndex(i) {
  const zone = SNACK_OUTER_ZONES.find((z) => (z.from <= z.to ? i >= z.from && i <= z.to : i >= z.from || i <= z.to));
  return zone ? zone.name : "station";
}

// SNACK_OUTER_ZONESの表示名(日本語)。おやつ紹介ポップアップ(14章SNACK_REVEAL)でのみ使う
// 表示専用ラベルで、上のコメント通りゲームロジックへは影響しない。
const SNACK_ZONE_LABELS = {
  station: "駅前エリア",
  office: "オフィス街",
  school: "学校エリア",
  church: "教会エリア",
  park: "公園エリア",
};

// 外周のマス種別(index→種別の上書き。指定の無いindexは"normal")。
// 現行(24ノード)の構成比を48ノードへ比例拡大しつつ、見本のゾーン配置
// (北=ショップA、南=ショップB、就職センターは北)に寄せて配置した。
const SNACK_OUTER_TYPE_OVERRIDES = {
  0: "start",
  6: "branch", 18: "branch", 30: "branch", 42: "branch",
  8: "job",
  10: "shop", 26: "shop",
  5: "payday", 17: "payday", 29: "payday", 41: "payday",
  2: "coin", 14: "coin", 20: "coin", 25: "coin", 37: "coin", 45: "coin",
  9: "income", 33: "income",
  13: "choice", 38: "choice",
  21: "rest", 40: "rest",
  24: "expense", 44: "expense",
  3: "item-box", 16: "item-box", 28: "item-box", 39: "item-box",
};
// 内周のマス種別パターン(元の8ノード版のパターンを2周させて16ノード分にする)
const SNACK_INNER_TYPE_PATTERN = ["normal", "normal", "expense", "normal", "item-box", "expense", "normal", "normal"];

// おやつ出現候補(見本の「外周8・内周2」に合わせ、5ゾーンへ均等に散らした)
const SNACK_CANDIDATE_OUTER_INDEXES = [1, 7, 12, 19, 23, 31, 35, 43];
const SNACK_CANDIDATE_INNER_INDEXES = [3, 11];

function buildSnackStageNodes() {
  const nodes = [];
  // 本編(board3d.js)のSQUARE_SPACING=2.2相当のマス間隔になるよう半径を設定
  // (2026-08-12、旧値だとマス間隔が本編より広く間延びして見えたため調整)。
  const rx = 17;
  const rz = 12.5;
  for (let i = 0; i < SNACK_OUTER_COUNT; i++) {
    const theta = -Math.PI / 2 + (i / SNACK_OUTER_COUNT) * Math.PI * 2;
    const branchPos = SNACK_BRANCH_OUTER_INDEXES.indexOf(i);
    const nextNodeIds = [`outer${(i + 1) % SNACK_OUTER_COUNT}`];
    if (branchPos !== -1) nextNodeIds.push(`inner${SNACK_INNER_ENTRY_INDEXES[branchPos]}`);
    nodes.push({
      id: `outer${i}`,
      position: { x: Math.cos(theta) * rx, z: Math.sin(theta) * rz },
      zone: "outer",
      buildingZone: snackOuterZoneForIndex(i),
      nodeType: SNACK_OUTER_TYPE_OVERRIDES[i] || "normal",
      nextNodeIds,
      tollCost: branchPos !== -1 ? SNACK_BRANCH_TOLL : 0,
      snackSpawnCandidate: SNACK_CANDIDATE_OUTER_INDEXES.includes(i),
      trap: false,
    });
  }

  // 内周は外周と同心円の内側の輪。入口(SNACK_INNER_ENTRY_INDEXES)の角度が対応する
  // 外周の分岐点(SNACK_BRANCH_OUTER_INDEXES)と揃うよう、開始角をπ/4だけずらしてある
  // (外周index6の角度=-π/4、内周index0の角度もこの式なら-π/4になり、接続の道が
  // 短い直線で結べる。詳細はsnack-board3d.jsの接続リボン描画コメント参照)。
  const innerRx = rx * 0.4;
  const innerRz = rz * 0.4;
  const exitInnerIndexes = SNACK_INNER_ENTRY_INDEXES.map((k) => (k + SNACK_INNER_EXIT_OFFSET) % SNACK_INNER_COUNT);
  for (let i = 0; i < SNACK_INNER_COUNT; i++) {
    const theta = -Math.PI / 4 + (i / SNACK_INNER_COUNT) * Math.PI * 2;
    const nextNodeIds = [`inner${(i + 1) % SNACK_INNER_COUNT}`];
    const exitPos = exitInnerIndexes.indexOf(i);
    let tollCost = 0;
    if (exitPos !== -1) {
      const rejoinOuter = (SNACK_BRANCH_OUTER_INDEXES[exitPos] + SNACK_OUTER_REJOIN_OFFSET) % SNACK_OUTER_COUNT;
      nextNodeIds.push(`outer${rejoinOuter}`);
    }
    nodes.push({
      id: `inner${i}`,
      position: { x: Math.cos(theta) * innerRx, z: Math.sin(theta) * innerRz },
      zone: "inner",
      nodeType: SNACK_INNER_TYPE_PATTERN[i % SNACK_INNER_TYPE_PATTERN.length],
      nextNodeIds,
      tollCost,
      snackSpawnCandidate: SNACK_CANDIDATE_INNER_INDEXES.includes(i),
      trap: i === 6 || i === 14, // 内周の2箇所を罠を仕掛けやすい危険な近道の位置づけに(元は1箇所を比例拡大)
    });
  }

  return nodes;
}

const SNACK_STAGE_NODES = buildSnackStageNodes();
const SNACK_START_NODE_ID = "outer0";

function findSnackNode(nodeId) {
  return SNACK_STAGE_NODES.find((n) => n.id === nodeId) || null;
}

// ステージ固有ギミック(仕様書14章、水路の橋)。4箇所ある分岐(SNACK_BRANCH_OUTER_INDEXES)の
// うち1箇所(outer6=北エリアの近道)を対象に、第6ラウンド開始からは近道側を閉鎖する
// 「特定ラウンドで一度だけ閉じる橋」として実装(仕様の「開閉」を毎ラウンド反復させると
// 経路探索・CPU判断・保存項目が複雑になるため、今回は一方向の閉鎖のみに絞った簡略版)。
// nextNodeIdsを直接ミューテートすることで、経路探索(BFS)・分岐判定・CPU判断・ルート選択UIの
// いずれも追加コード無しで閉鎖状態に追従する(既存のactiveTrapと同じ「実行時ミューテート可能な
// シングルトンノード」パターンを踏襲)。
const SNACK_GIMMICK_NODE_ID = "outer6";
const SNACK_GIMMICK_CLOSE_ROUND = 6;
const SNACK_GIMMICK_ORIGINAL_NEXT_IDS = Object.freeze(
  (findSnackNode(SNACK_GIMMICK_NODE_ID) ? findSnackNode(SNACK_GIMMICK_NODE_ID).nextNodeIds : []).slice()
);

function snackCandidateNodeIds() {
  return SNACK_STAGE_NODES.filter((n) => n.snackSpawnCandidate).map((n) => n.id);
}
