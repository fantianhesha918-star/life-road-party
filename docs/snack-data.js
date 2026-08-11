// アニマルライフ「おやつ集めモード」フェーズ1(試作)のマップ・アイテム・イベントデータ
// 既存の人生ゲームモード(game-data.js)とは経済の単位・盤面構造が別物のため、
// 通貨・イベント・マップとも独立して新規定義する(既存データは一切変更しない)。

const SNACK_TOTAL_ROUNDS = 10; // 1ラウンド = 全員が1回ずつ動く(既存メモの確定定義)
const SNACK_START_COINS = 10;
const SNACK_SNACK_PRICE = 20;
const SNACK_BRANCH_TOLL = 5; // 内周(近道)へ入る際の通行料

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

// ==================== ノードグラフ(外周24+内周8=32ノード) ====================
// 外周はぐるりと1周する安全ルート、内周は8番ノード(分岐点)から20番ノードへ抜ける
// 有料の近道(通行料はSNACK_BRANCH_TOLL)。内周は一方通行のショートカットとして扱う
// (本格版のような外周⇄内周を複数箇所で行き来する構造ではなく、試作では
// 「1箇所の分岐で近道するか選び、抜けた先で外周へ合流する」というシンプルな形にする)。

const SNACK_OUTER_TYPES = [
  "start", "normal", "job", "coin", "normal", "payday", "shop", "normal",
  "branch", "income", "normal", "choice", "normal", "rest", "coin", "expense",
  "normal", "item-box", "payday", "normal", "normal", "normal", "item-box", "coin",
];
const SNACK_INNER_TYPES = ["normal", "normal", "expense", "normal", "item-box", "expense", "normal", "normal"];

// おやつ出現候補(6箇所、最低4ノード以上離す)
const SNACK_CANDIDATE_OUTER_INDEXES = [1, 4, 7, 12, 21];
const SNACK_CANDIDATE_INNER_INDEXES = [3];

const SNACK_BRANCH_OUTER_INDEX = 8; // 内周への入口(分岐+有料ゲート)
const SNACK_MERGE_OUTER_INDEX = 20; // 内周から外周へ合流する地点

function buildSnackStageNodes() {
  const nodes = [];
  const outerCount = SNACK_OUTER_TYPES.length;
  const rx = 9;
  const rz = 6.5;
  for (let i = 0; i < outerCount; i++) {
    const theta = -Math.PI / 2 + (i / outerCount) * Math.PI * 2;
    const isCandidate = SNACK_CANDIDATE_OUTER_INDEXES.includes(i);
    nodes.push({
      id: `outer${i}`,
      position: { x: Math.cos(theta) * rx, z: Math.sin(theta) * rz },
      zone: "outer",
      nodeType: SNACK_OUTER_TYPES[i],
      nextNodeIds: i === SNACK_BRANCH_OUTER_INDEX ? [`outer${(i + 1) % outerCount}`, "inner0"] : [`outer${(i + 1) % outerCount}`],
      tollCost: i === SNACK_BRANCH_OUTER_INDEX ? SNACK_BRANCH_TOLL : 0,
      snackSpawnCandidate: isCandidate,
      trap: false,
    });
  }

  const innerCount = SNACK_INNER_TYPES.length;
  const from = nodes.find((n) => n.id === `outer${SNACK_BRANCH_OUTER_INDEX}`).position;
  const to = nodes.find((n) => n.id === `outer${SNACK_MERGE_OUTER_INDEX}`).position;
  for (let i = 0; i < innerCount; i++) {
    // 分岐点→合流点を結ぶ滑らかな弧(中心側へわずかに膨らませ、外周とは別ルートに見せる)
    const t = (i + 1) / (innerCount + 1);
    const bowZ = Math.sin(t * Math.PI) * 2.5;
    const isCandidate = SNACK_CANDIDATE_INNER_INDEXES.includes(i);
    nodes.push({
      id: `inner${i}`,
      position: { x: from.x + (to.x - from.x) * t, z: from.z + (to.z - from.z) * t + bowZ },
      zone: "inner",
      nodeType: SNACK_INNER_TYPES[i],
      nextNodeIds: i === innerCount - 1 ? [`outer${SNACK_MERGE_OUTER_INDEX}`] : [`inner${i + 1}`],
      tollCost: 0,
      snackSpawnCandidate: isCandidate,
      trap: i === 1, // 内周の1箇所だけ罠を仕掛けやすい(危険な近道、という位置づけ)
    });
  }

  return nodes;
}

const SNACK_STAGE_NODES = buildSnackStageNodes();
const SNACK_START_NODE_ID = "outer0";

function findSnackNode(nodeId) {
  return SNACK_STAGE_NODES.find((n) => n.id === nodeId) || null;
}

function snackCandidateNodeIds() {
  return SNACK_STAGE_NODES.filter((n) => n.snackSpawnCandidate).map((n) => n.id);
}
