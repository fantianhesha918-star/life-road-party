// アニマルライフ「おやつ集めモード」フェーズ1(試作)のマップ・アイテム・イベントデータ
// 既存の人生ゲームモード(game-data.js)とは経済の単位・盤面構造が別物のため、
// 通貨・イベント・マップとも独立して新規定義する(既存データは一切変更しない)。

const SNACK_TOTAL_ROUNDS = 10; // 1ラウンド = 全員が1回ずつ動く(既存メモの確定定義)
const SNACK_START_COINS = 14;
const SNACK_SNACK_PRICE = 8;
// フェーズE(経済バランス再調整): 32マス化後もおやつが同時に1個(旧価格20・開始10コイン)
// だと、実機シミュレーション(CPUのみ・4人・100〜200試合)で「平均0.14〜0.16個/プレイヤー・
// 全員0個で終わる対局が57〜64%」という致命的な希少性になった。同時出現数・価格・開始コイン
// の3変数を組み合わせて50件以上のシミュレーションで比較した結果(詳細はlife-road-party/
// 作業状況.md参照)、同時出現数3・価格8・開始コイン14の組み合わせが2〜4人いずれでも
// 平均2.2〜2.7個/プレイヤー(目標1〜3の範囲内)・全員0個の対局0%を安定して達成した。
const SNACK_ACTIVE_SNACK_COUNT = 3;
const SNACK_BRANCH_TOLL = 5; // 内周(近道)へ入る際の通行料

// ラストスパート(仕様書14章FINAL_SPRINT)。「残り3ラウンド」からを対象とするので
// totalRounds(10)からのオフセットは2(=第8ラウンド開始から)。倍率は当初14章の「少し増やす」を
// 1.3倍と仮決めしていたが、後発のガブリオン仕様書6章が同じ第8〜10ラウンドの窓に対して
// 「仕事・コイン獲得額を1.5倍、端数は切り上げ」という明確な数値を与えたため、二重加算を避け
// この1.5倍に統一した(2つの別演出が同じ倍率を共有する形)。
const SNACK_FINAL_SPRINT_ROUND_OFFSET = 2;
const SNACK_FINAL_SPRINT_COIN_MULT = 1.5;

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
  { id: "snack-item-dice-plus1", name: "追加サイコロ+1個", price: 6, emoji: "🎲", image: "images/snack/items/item-dice-plus1.png", effect: "extraDice", value: 1 },
  { id: "snack-item-mischief-fruit", name: "いたずらの実", price: 7, emoji: "🍒", image: "images/snack/items/item-mischief-fruit.png", effect: "trap" },
  { id: "snack-item-sniff-grass", name: "鼻きき草", price: 5, emoji: "🌿", image: "images/snack/items/item-sniff-grass.png", effect: "hint" },
  { id: "snack-item-charm", name: "おまもり", price: 7, emoji: "🛡️", image: "images/snack/items/item-charm.png", effect: "guard" },
  { id: "snack-item-dice-plus2", name: "追加サイコロ+2個", price: 10, emoji: "🎲", image: "images/snack/items/item-dice-plus2.png", effect: "extraDice", value: 2 },
  { id: "snack-item-dice-plus3", name: "追加サイコロ+3個", price: 14, emoji: "🎲", image: "images/snack/items/item-dice-plus3.png", effect: "extraDice", value: 3 },
  { id: "snack-item-steal", name: "横取り袋", price: 9, emoji: "👝", image: "images/snack/items/item-steal.png", effect: "steal" },
  { id: "snack-item-warp", name: "ワープ玉", price: 12, emoji: "🔮", image: "images/snack/items/item-warp.png", effect: "warp" },
  { id: "snack-item-pushback", name: "押し戻しの実", price: 8, emoji: "🌰", image: "images/snack/items/item-pushback.png", effect: "pushback" },
  { id: "snack-item-aim-powder", name: "狙い目の粉", price: 8, emoji: "✨", image: "images/snack/items/item-aim-powder.png", effect: "forceRoll", value: 6 },
  { id: "snack-item-double-seed", name: "ダブルチャンスの種", price: 8, emoji: "🌱", image: "images/snack/items/item-double-seed.png", effect: "doubleGain" },
  { id: "snack-item-trade-ticket", name: "場所交換チケット", price: 10, emoji: "🎫", image: "images/snack/items/item-trade-ticket.png", effect: "tradePosition" },
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

// ==================== ノードグラフ(外周18+内周10+接続4=32停止マス) ====================
// Codexレビュー(2026-08-13)で、64ノード版(外周48+内周16)が見本マップ
// (08_全体マップ再現指針)の構図に遠く、おやつ取得も成立しないと指摘され、利用者の判断で
// 32マス(外周18+内周10+接続4)へ作り直した(第3弾)。接続マスは外周・内周と重複カウントしない
// 独立ノードとして新設し(利用者の正式仕様書「接続ノードは外周と内周で重複カウントせず」)、
// マップの広さ・マス間隔(rx/rz)自体は変えず、見た目の移動距離は3D側の中間ウェイポイント
// (snack-board3d.jsのhopPath、ゲームロジックには一切影響しない)で補う。
// 内周は一方通行の近道ではなく、それ自体が閉じたループ(外周と同心円の内側の輪)。
// 4箇所の分岐点(SNACK_BRANCH_OUTER_INDEXES)から接続マスへ入ると通行料(SNACK_BRANCH_TOLL)が
// かかり、接続マス→内周入口(SNACK_INNER_ENTRY_INDEXES)→内周を進んだ先(出口は入口から
// SNACK_INNER_EXIT_OFFSETノード先)で外周へ無料で戻れる(戻る際は分岐点からSNACK_OUTER_REJOIN_OFFSET
// ノード先の外周ノードへ合流)。

const SNACK_OUTER_COUNT = 18;
const SNACK_INNER_COUNT = 10;
const SNACK_BRANCH_OUTER_INDEXES = [2, 7, 11, 16]; // 接続マスへの入口(外周側、4方向)
const SNACK_INNER_ENTRY_INDEXES = [0, 3, 5, 8]; // 対応する内周側の入口(SNACK_BRANCH_OUTER_INDEXESと同じ並び順)
// 内周10ノードは分岐4箇所と間隔が近く、旧値(2)のままだと入口と出口が同じノードに重なる
// 組み合わせが生じたため1に短縮した。合計移動コスト(接続1+内周1+出口合流1=3歩)は
// 旧設計(内周2歩+出口合流1歩=3歩、外周直進が3歩で内周がむしろ1歩遅い)とほぼ同じ比率を保っている。
const SNACK_INNER_EXIT_OFFSET = 1;
const SNACK_OUTER_REJOIN_OFFSET = 3; // 出口が外周へ合流する際、対応する入口から何ノード先へ合流するか

// マスの種類(見本の「上=駅・商店・カフェ、右上〜右=役所・病院・学校、右下=住宅・庭・郵便局、
// 下=教会・結婚式広場、左=公園」という地区ゾーン)とは別に、3D側の建物配置だけに使う
// 見た目専用の分類。ゲームロジック(snack-engine.js/snack-cpu.js)はこの値を一切参照しない。
const SNACK_OUTER_ZONES = [
  { name: "station", from: 16, to: 1 }, // 上: 駅・スタート地点(wrap)
  { name: "civic", from: 2, to: 5 }, // 右上〜右: 役所・病院・学校
  { name: "residential", from: 6, to: 8 }, // 右下: 住宅・庭・郵便局
  { name: "church", from: 9, to: 12 }, // 下: 教会・結婚式広場
  { name: "park", from: 13, to: 15 }, // 左: 公園
];

function snackOuterZoneForIndex(i) {
  const zone = SNACK_OUTER_ZONES.find((z) => (z.from <= z.to ? i >= z.from && i <= z.to : i >= z.from || i <= z.to));
  return zone ? zone.name : "station";
}

// SNACK_OUTER_ZONESの表示名(日本語)。おやつ紹介ポップアップ(14章SNACK_REVEAL)でのみ使う
// 表示専用ラベルで、上のコメント通りゲームロジックへは影響しない。
const SNACK_ZONE_LABELS = {
  station: "駅前エリア",
  civic: "官公庁エリア",
  residential: "住宅エリア",
  church: "教会エリア",
  park: "公園エリア",
};

// 外周のマス種別(index→種別の上書き。指定の無いindexは"normal")。分岐4箇所(branch)は
// buildSnackStageNodes内で接続マス生成時にまとめて上書きするため、ここには含めない。
const SNACK_OUTER_TYPE_OVERRIDES = {
  0: "start",
  8: "job",
  13: "shop",
  5: "payday", 14: "payday",
  1: "coin", 9: "coin",
  4: "income",
  10: "choice",
  12: "expense",
  17: "item-box",
  6: "rest",
};
// 内周のマス種別パターン(既存の8種パターンをそのまま10ノードへ循環適用、ノード数非依存)
const SNACK_INNER_TYPE_PATTERN = ["normal", "normal", "expense", "normal", "item-box", "expense", "normal", "normal"];

// おやつ出現候補(外周3・内周2の計5箇所。32マス化に伴い、Phase Eの経済バランス調整で
// 同時出現数・価格とあわせて見直す前提の暫定値)。
const SNACK_CANDIDATE_OUTER_INDEXES = [4, 9, 14];
const SNACK_CANDIDATE_INNER_INDEXES = [2, 7];

function buildSnackStageNodes() {
  const nodes = [];
  // マップの広さ・マス間隔は64ノード版から変更しない(利用者指示: 浮島・道路長・移動距離感は維持)。
  const rx = 17;
  const rz = 12.5;
  for (let i = 0; i < SNACK_OUTER_COUNT; i++) {
    const theta = -Math.PI / 2 + (i / SNACK_OUTER_COUNT) * Math.PI * 2;
    nodes.push({
      id: `outer${i}`,
      position: { x: Math.cos(theta) * rx, z: Math.sin(theta) * rz },
      zone: "outer",
      buildingZone: snackOuterZoneForIndex(i),
      nodeType: SNACK_OUTER_TYPE_OVERRIDES[i] || "normal",
      nextNodeIds: [`outer${(i + 1) % SNACK_OUTER_COUNT}`],
      tollCost: 0,
      snackSpawnCandidate: SNACK_CANDIDATE_OUTER_INDEXES.includes(i),
      trap: false,
      gaburion: false,
    });
  }

  // 内周は外周と同心円の内側の輪。入口(SNACK_INNER_ENTRY_INDEXES)の角度が対応する
  // 外周の分岐点(SNACK_BRANCH_OUTER_INDEXES)と揃うよう、開始角をπ/4だけずらしてある。
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
      trap: false,
      gaburion: false,
    });
  }

  // 接続マス(4個、外周・内周と重複カウントしない独立ノード)。外周と内周の中間(スポーク上)に
  // 配置し、対応する外周の分岐点(SNACK_BRANCH_OUTER_INDEXES)から2本目の道としてつながる。
  // 通行料は入口である外周ノード側に持たせる(resolveSnackBranchが「今立っているノードの
  // tollCost」を参照する既存設計のため、接続マス自体のtollCostは0のままでよい)。
  SNACK_BRANCH_OUTER_INDEXES.forEach((outerIdx, k) => {
    const outerNode = nodes.find((n) => n.id === `outer${outerIdx}`);
    const innerNode = nodes.find((n) => n.id === `inner${SNACK_INNER_ENTRY_INDEXES[k]}`);
    const connectorId = `connector${k}`;
    outerNode.nodeType = "branch";
    outerNode.nextNodeIds.push(connectorId);
    outerNode.tollCost = SNACK_BRANCH_TOLL;
    nodes.push({
      id: connectorId,
      position: {
        x: (outerNode.position.x + innerNode.position.x) / 2,
        z: (outerNode.position.z + innerNode.position.z) / 2,
      },
      zone: "connector",
      buildingZone: outerNode.buildingZone,
      nodeType: "branch",
      nextNodeIds: [innerNode.id],
      tollCost: 0,
      snackSpawnCandidate: false,
      trap: false,
      gaburion: false,
    });
  });

  return nodes;
}

const SNACK_STAGE_NODES = buildSnackStageNodes();
const SNACK_START_NODE_ID = "outer0";

function findSnackNode(nodeId) {
  return SNACK_STAGE_NODES.find((n) => n.id === nodeId) || null;
}

// FINAL_THREE_TRANSFORM(ガブリオン仕様6章)が実行時にnodeType/gaburionを書き換えるため、
// 新規ゲーム開始のたびに「本来の姿」へ戻せるよう、モジュール読み込み時点(=誰もまだ何も
// 書き換えていない状態)のnodeTypeをスナップショットしておく(activeTrap/nextNodeIdsと
// 同じ「実行時ミューテート可能な共有ノード」パターンのためのリセット用データ)。
const SNACK_ORIGINAL_NODE_TYPES = new Map(SNACK_STAGE_NODES.map((n) => [n.id, n.nodeType]));

// ステージ固有ギミック(仕様書14章、水路の橋)。4箇所ある分岐(SNACK_BRANCH_OUTER_INDEXES)の
// うち1箇所(outer7=接続マスconnector1側の近道)を対象に、第6ラウンド開始からは近道側を閉鎖する
// 「特定ラウンドで一度だけ閉じる橋」として実装(仕様の「開閉」を毎ラウンド反復させると
// 経路探索・CPU判断・保存項目が複雑になるため、今回は一方向の閉鎖のみに絞った簡略版)。
// nextNodeIdsを直接ミューテートすることで、経路探索(BFS)・分岐判定・CPU判断・ルート選択UIの
// いずれも追加コード無しで閉鎖状態に追従する(既存のactiveTrapと同じ「実行時ミューテート可能な
// シングルトンノード」パターンを踏襲)。
const SNACK_GIMMICK_NODE_ID = "outer7";
const SNACK_GIMMICK_CLOSE_ROUND = 6;
const SNACK_GIMMICK_ORIGINAL_NEXT_IDS = Object.freeze(
  (findSnackNode(SNACK_GIMMICK_NODE_ID) ? findSnackNode(SNACK_GIMMICK_NODE_ID).nextNodeIds : []).slice()
);

// ガブリオンイベント(05_ガブリオンイベント確定仕様書)。仕様は「32マス中2箇所」を前提に
// 数を決めており、32マス化(第3弾)によりこの前提がそのまま成立するようになった
// (初期2箇所・第8ラウンドの変化上限4箇所は据え置き)。既存nodeTypeを上書きしない追加
// フラグとしてnode.gaburionを持たせる(activeTrap/snackSpawnCandidateと同じ方式)。
// 選定基準: スタート・分岐・ショップ・ギミック制御マス・おやつ出現候補マスと重複しない
// normal種別のノードを、外周上でなるべく離れた2箇所(outer3/outer15、約半周ずつ離れている)から選んだ。
const SNACK_GABURION_INITIAL_NODE_IDS = ["outer3", "outer15"];

SNACK_GABURION_INITIAL_NODE_IDS.forEach((id) => {
  const n = findSnackNode(id);
  if (n) n.gaburion = true;
});

const SNACK_GABURION_OUTCOMES = [
  { id: "COIN_LOSS", label: "コインちょうだい！", weight: 20 },
  { id: "ALL_PAY", label: "みんなでお支払い！", weight: 12 },
  { id: "ITEM_LOSS", label: "アイテムいただき！", weight: 10 },
  { id: "MOVE_BACK", label: "ちょっと戻って！", weight: 12 },
  { id: "SWAP_POSITION", label: "場所をチェンジ！", weight: 12 },
  { id: "SNACK_RELOCATE", label: "おやつをお引っ越し！", weight: 10 },
  { id: "CURSED_DIE", label: "しょんぼりサイコロ", weight: 10 },
  { id: "BONUS_COINS", label: "ガブリオン大失敗！", weight: 14 },
];

function snackCandidateNodeIds() {
  return SNACK_STAGE_NODES.filter((n) => n.snackSpawnCandidate).map((n) => n.id);
}
