// ライフロード オリジナルゲームデータ
// 盤面・イベント・職業はすべてオリジナル(既存の市販ボードゲームの内容は使用しない)

// 各マスは「踏むたびに毎回変わる抽選」ではなく、市販の人生ゲームのように
// マスの位置ごとに固定のイベントを割り当てる(2026-08-09〜)。event/fortune/choiceの
// 具体的な中身は下のEVENT_CARDS/FORTUNE_CARDS/CHOICE_EVENTS(このマス数より多く用意してある
// 予備の内容ライブラリ)からeventCardIndex/fortuneCardIndex/choiceEventIndexで指定する。
// 「ひと休み」マスは、そのプレイヤー自身の次の自分の番を1回休みにする(game-engine.js参照)。
//
// この30マス配列は、ゲームモード導入(2026-08-11〜、短い/普通/長い=100/200/300マス)より前の
// セーブ・オンライン部屋を後方互換で開くためだけに残してある「レガシー盤面」。新規ゲームでは
// 使われず、setActiveBoard()がsquareCount===30(またはフィールド欠落)のときだけ採用する。
const LEGACY_BOARD_SQUARES_30 = [
  { index: 0, type: "start", label: "人生スタート" },
  { index: 1, type: "event", label: "できごと", eventCardIndex: 0 },
  { index: 2, type: "fortune", label: "運命の分かれ道", fortuneCardIndex: 0 },
  { index: 3, type: "job", label: "就職の関門" },
  { index: 4, type: "rest", label: "ひと休み" },
  { index: 5, type: "payday", label: "給料日" },
  { index: 6, type: "event", label: "できごと", eventCardIndex: 1 },
  { index: 7, type: "choice", label: "選択のとき", choiceEventIndex: 4 },
  { index: 8, type: "job", label: "スキルアップ研修" },
  { index: 9, type: "house-fire", label: "火事発生" },
  { index: 10, type: "payday", label: "給料日" },
  { index: 11, type: "fortune", label: "運命の分かれ道", fortuneCardIndex: 1 },
  { index: 12, type: "house-swap", label: "家の交換" },
  { index: 13, type: "rest", label: "ひと休み" },
  { index: 14, type: "payday", label: "給料日" },
  { index: 15, type: "job", label: "スキルアップ研修" },
  { index: 16, type: "choice", label: "選択のとき", choiceEventIndex: 8 },
  { index: 17, type: "marriage", label: "結婚" },
  { index: 18, type: "payday", label: "給料日" },
  { index: 19, type: "childbirth", label: "子どもが生まれる" },
  { index: 20, type: "fortune", label: "運命の分かれ道", fortuneCardIndex: 2 },
  { index: 21, type: "rest", label: "ひと休み" },
  { index: 22, type: "payday", label: "給料日" },
  { index: 23, type: "childbirth", label: "子どもが生まれる" },
  { index: 24, type: "job", label: "スキルアップ研修" },
  { index: 25, type: "house-market", label: "マイホーム購入" },
  { index: 26, type: "childbirth", label: "子どもが生まれる" },
  { index: 27, type: "payday", label: "給料日" },
  { index: 28, type: "fortune", label: "運命の分かれ道", fortuneCardIndex: 3 },
  { index: 29, type: "goal", label: "ゴール" },
];

// 「結婚」は、ロールの目がこのマスを通り過ぎる場合でも強制的にここで停止する
// (市販の人生ゲームの「止まる」マスと同じ挙動)。game-engine.jsのapplyRollで、
// この配列に含まれるtypeのマスが移動範囲内にあれば手前のものを優先して停止位置として採用する。
// 「子どもが生まれる」は授かりものなので強制停止にはせず、ちょうど着地したときだけ発生する
// (他のevent/fortuneマスと同じ扱い)。結婚マスより後ろに複数配置してある。
const FORCED_STOP_TYPES = ["marriage"];

// 結婚: 止まったプレイヤーは他の全プレイヤーからお祝い金をもらう(1人あたりの金額)。
// 出産: こちらは変更なしで、生まれた本人がお祝い金を払う固定額のまま。
const MARRIAGE_GIFT_PER_PLAYER = 10;
const CHILDBIRTH_GIFT_COST = 20;

// 株購入のチャンスは特定マスに「止まらなくても」「通り過ぎるだけ」で発生する
// (game-engine.jsのapplyRollで、移動範囲にこのインデックスが含まれるか判定する)。
// 対象は就職・選択・マイホーム購入マス以外(pendingChoiceの二重発生を避けるため)から選定している。
// これもLEGACY_BOARD_SQUARES_30専用の値(下記参照)。
const LEGACY_STOCK_TRIGGER_INDEXES_30 = [5, 11, 20, 26];

// ==================== ゲームモード別マス数拡張(2026-08-11〜) ====================
// BOARD_SQUARES/STOCK_TRIGGER_INDEXESは、以前は上記の30マス固定配列だったが、
// ゲームモード(短い/普通/長い=100/200/300マス)導入により「新しいゲーム開始のたびに
// setActiveBoard(squareCount)で差し替えるlet」に変更した。game-engine.js/board3d.js等の
// 既存コードはこの2つをグローバル(クラシックスクリプト共有スコープ)として直接参照して
// いるため、差し替え可能なletにしておけば呼び出し側の大部分は無改修で追従する。
let BOARD_SQUARES = LEGACY_BOARD_SQUARES_30;
let STOCK_TRIGGER_INDEXES = LEGACY_STOCK_TRIGGER_INDEXES_30;

// 選べるゲームモード。以前の相談で「20/40/60分の目安」として合意済みの数値(2026-08-09)。
const GAME_MODES = [
  { id: "short", label: "短い(100マス・目安20分)", squareCount: 100 },
  { id: "normal", label: "普通(200マス・目安40分)", squareCount: 200 },
  { id: "long", label: "長い(300マス・目安60分)", squareCount: 300 },
];

// LEGACY_BOARD_SQUARES_30から「単発の特殊マス」(結婚・火事・家の交換・マイホーム購入・
// 子どもが生まれる×3)を除いた、残り21マス分の並び順をそのまま抽出したテンプレート。
// 比率を新規に考案するのではなく、既存デザインのリズムをそのまま繰り返して長い盤面を作る。
const REGULAR_TYPE_TILE = [
  "event", "fortune", "job", "rest", "payday", "event", "choice", "job",
  "payday", "fortune", "rest", "payday", "job", "choice", "payday",
  "fortune", "rest", "payday", "job", "payday", "fortune",
];

const REGULAR_TYPE_LABELS = {
  event: "できごと",
  fortune: "運命の分かれ道",
  rest: "ひと休み",
  payday: "給料日",
  choice: "選択のとき",
  // jobだけは1マス目だけ「就職の関門」、2マス目以降は「スキルアップ研修」(生成時に個別付与)
};

// LEGACY_BOARD_SQUARES_30における「単発の特殊マス」の位置(0-28、末尾のgoalは除く)。
// squareCountに合わせてこの相対位置(index/29)を比例スケールして配置する。
const SPECIAL_SQUARE_TEMPLATE = [
  { type: "house-fire", label: "火事発生", originalIndex: 9 },
  { type: "house-swap", label: "家の交換", originalIndex: 12 },
  { type: "marriage", label: "結婚", originalIndex: 17 },
  { type: "childbirth", label: "子どもが生まれる", originalIndex: 19 },
  { type: "childbirth", label: "子どもが生まれる", originalIndex: 23 },
  { type: "house-market", label: "マイホーム購入", originalIndex: 25 },
  { type: "childbirth", label: "子どもが生まれる", originalIndex: 26 },
];

// pendingChoiceを返すマス種別(就職・選択・マイホーム購入)。株購入トリガーはこれらの
// マスには重ねない(pendingChoiceの二重発生を避けるため、既存の設計方針を踏襲)。
const PENDING_CHOICE_TYPES = ["job", "choice", "house-market"];

// squareCount(100/200/300等の任意マス数)から盤面を生成する。マス0=start、
// マスsquareCount-1=goalは固定、それ以外はREGULAR_TYPE_TILEを巡回させて埋めたあと、
// SPECIAL_SQUARE_TEMPLATEの位置を比例スケールして上書きする。
function buildBoardSquares(squareCount) {
  const lastIndex = squareCount - 1;
  const squares = new Array(squareCount);
  squares[0] = { index: 0, type: "start", label: "人生スタート" };
  squares[lastIndex] = { index: lastIndex, type: "goal", label: "ゴール" };

  let eventCounter = 0;
  let fortuneCounter = 0;
  let jobCount = 0;
  for (let i = 1; i < lastIndex; i++) {
    const type = REGULAR_TYPE_TILE[(i - 1) % REGULAR_TYPE_TILE.length];
    const square = { index: i, type, label: REGULAR_TYPE_LABELS[type] || "" };
    if (type === "event") {
      square.eventCardIndex = eventCounter % EVENT_CARDS.length;
      eventCounter++;
    } else if (type === "fortune") {
      square.fortuneCardIndex = fortuneCounter % FORTUNE_CARDS.length;
      fortuneCounter++;
    } else if (type === "job") {
      square.label = jobCount === 0 ? "就職の関門" : "スキルアップ研修";
      jobCount++;
    }
    squares[i] = square;
  }

  // 特殊マス(結婚・火事・家の交換・マイホーム購入・子どもが生まれる)を比例位置へ上書き配置。
  // 衝突(丸め誤差で同じindexになった場合)は後続のものを1マスずつ前方へずらして回避する。
  const usedSpecialIndexes = new Set();
  let choiceCounter = 0;
  SPECIAL_SQUARE_TEMPLATE.forEach((tmpl) => {
    let idx = Math.round((lastIndex * tmpl.originalIndex) / 29);
    idx = Math.max(1, Math.min(lastIndex - 1, idx));
    while (usedSpecialIndexes.has(idx) && idx < lastIndex - 1) idx++;
    usedSpecialIndexes.add(idx);
    squares[idx] = { index: idx, type: tmpl.type, label: tmpl.label };
  });
  // choiceマスはchoiceEventIndexが必要なため、特殊マス配置が終わったあと改めて全マスを
  // 走査して割り当てる(REGULAR_TYPE_TILEループの時点ではまだ特殊マス上書き前のため)
  for (let i = 1; i < lastIndex; i++) {
    if (squares[i].type === "choice") {
      squares[i].choiceEventIndex = choiceCounter % CHOICE_EVENTS.length;
      choiceCounter++;
    }
  }

  // 株購入トリガー: pendingChoiceを返さないマス種別(job/choice/house-market以外)から
  // LEGACY_BOARD_SQUARES_30と同じ密度(30マス中4箇所≒13%)で等間隔サンプリングする
  const eligible = [];
  for (let i = 1; i < lastIndex; i++) {
    if (!PENDING_CHOICE_TYPES.includes(squares[i].type)) eligible.push(i);
  }
  const desiredTriggerCount = Math.max(1, Math.round((squareCount * 4) / 30));
  const stockTriggerIndexes = [];
  for (let k = 0; k < desiredTriggerCount && eligible.length > 0; k++) {
    const pos = Math.floor((k * eligible.length) / desiredTriggerCount);
    stockTriggerIndexes.push(eligible[pos]);
  }

  return { squares, stockTriggerIndexes };
}

// 新しいゲーム(一人プレイ開始・セーブ再開・オンライン部屋参加)を始める前に必ず呼び、
// BOARD_SQUARES/STOCK_TRIGGER_INDEXES(と、game-engine.js側のGOAL_INDEX)を
// 指定マス数の盤面へ差し替える。squareCount===30(または未指定)は、モード導入前の
// セーブ・オンライン部屋を開くためのレガシー盤面フォールバックとして扱う。
function setActiveBoard(squareCount) {
  if (!squareCount || squareCount === 30) {
    BOARD_SQUARES = LEGACY_BOARD_SQUARES_30;
    STOCK_TRIGGER_INDEXES = LEGACY_STOCK_TRIGGER_INDEXES_30;
  } else if (BOARD_SQUARES.length !== squareCount) {
    const built = buildBoardSquares(squareCount);
    BOARD_SQUARES = built.squares;
    STOCK_TRIGGER_INDEXES = built.stockTriggerIndexes;
  }
  // game-engine.js側で`let`宣言されているGOAL_INDEXを再代入する。クラシックスクリプト
  // 同士は同じグローバルスコープを共有するため、game-data.js側からも参照・代入できる
  // (game-engine.jsが既にBOARD_SQUARES等をこの方式で参照しているのと同じパターン)。
  GOAL_INDEX = BOARD_SQUARES.length - 1;
}

const STOCK_PRICE_PER_SHARE = 3; // 万円/株
const STOCK_BUY_LOT = 10; // 1回の購入で買える株数(-30万円)

// 保有株数に応じて所持金が増減する(株価変動)。株を保有していないプレイヤーには適用しない
const STOCK_VALUE_EVENTS = [
  { text: "📈 保有株が値上がりした", perShare: 2 },
  { text: "📈 好決算のニュースで株価が急騰した", perShare: 3 },
  { text: "📉 保有株が値下がりした", perShare: -2 },
  { text: "📉 市場全体が下落し株価が下がった", perShare: -3 },
  { text: "📈 配当金が入った", perShare: 1 },
];

// マイホームの価格帯(6段階)。exclusive:trueは早い者勝ち(誰か1人が所有している間は
// 他のプレイヤーは選べない、game-engine.jsのhouse-market解決時に判定する)
const HOUSE_PRICE_TIERS = [
  { label: "中古アパート", price: 20, exclusive: false },
  { label: "新築アパート", price: 35, exclusive: false },
  { label: "中古一戸建て", price: 55, exclusive: false },
  { label: "新築一戸建て", price: 80, exclusive: false },
  { label: "デザイナーズ住宅", price: 120, exclusive: false },
  { label: "タワーマンション最上階", price: 200, exclusive: true },
];

// 火災保険に入っていた場合、家の価格に対してこの割合を保険金として受け取る(家は失う)
const FIRE_INSURANCE_PAYOUT_RATE = 0.7;

// 全員ゴール後の清算(runSettlement)で使う報酬定数
const CHILD_SETTLEMENT_REWARD = 15; // 万円/人
const STOCK_SETTLEMENT_PER_SHARE = 4; // 万円/株
const HOUSE_SETTLEMENT_MULTIPLIER = 1.5; // 家の購入価格に対する倍率(ゴール時点で所有している場合のみ)
// ゴールに到達した順番(finishOrder、1着から)に応じたボーナス。6人プレイまで対応
const GOAL_ORDER_REWARDS = [50, 35, 22, 12, 6, 0];

const JOB_OFFERS = [
  { name: "ラーメン職人", salary: 14 },
  { name: "Webデザイナー", salary: 18 },
  { name: "地方公務員", salary: 17 },
  { name: "営業スタッフ", salary: 20 },
  { name: "ITエンジニア", salary: 24 },
  { name: "お笑い芸人", salary: 12 },
  { name: "農家", salary: 15 },
  { name: "医師", salary: 30 },
];

const UNEMPLOYED_INCOME = 8; // まだ就職していない時の給料日収入(アルバイト収入扱い)
const SKILLUP_BONUS_MIN = 3;
const SKILLUP_BONUS_MAX = 8;

const EVENT_CARDS = [
  { text: "宝くじの3等が当たった！", delta: 30 },
  { text: "道でお金を拾って交番に届けたらお礼がもらえた", delta: 10 },
  { text: "フリマアプリで不用品が高く売れた", delta: 12 },
  { text: "友人の結婚式に招待されてご祝儀を包んだ", delta: -10 },
  { text: "スマホを落として画面が割れてしまった", delta: -8 },
  { text: "空き巣に入られて貯金箱が盗まれた", delta: -20 },
  { text: "確定申告で税金が還付された", delta: 9 },
  { text: "友人にお金を貸したが、なかなか返ってこない", delta: -15 },
  { text: "副業のアプリ開発がちょっとしたヒットに", delta: 18 },
  { text: "車の車検代がかさんでしまった", delta: -12 },
  { text: "資格試験に合格してお祝い金をもらった", delta: 7 },
  { text: "旅行先で財布を落としてしまった", delta: -14 },
  { text: "親戚からお小遣いをもらった", delta: 6 },
  { text: "台風で家の屋根を修理することになった", delta: -18 },
  { text: "懸賞に応募したら商品券が当たった", delta: 8 },
  { text: "飲み会つづきで出費がかさんだ", delta: -6 },
  // 人生の節目イベント
  { text: "会社から予想外のボーナスが支給された", delta: 20 },
  { text: "うっかり怪我をして入院することになった", delta: -18 },
  { text: "健康診断で再検査になり、通院費がかさんだ", delta: -6 },
  { text: "在宅ワークの成果が評価されて臨時手当が出た", delta: 10 },
  // 動物あるある(全プレイヤー共通、動物種を問わない)
  { text: "換毛期で抜け毛がすごく、掃除グッズを買い足した", delta: -4 },
  { text: "毛づやが良いとSNSで話題になり、企業案件の撮影依頼が来た", delta: 15 },
  { text: "近所の動物病院で健康診断を受けた", delta: -6 },
  { text: "しっぽを踏まれて痛い思いをしたが、お詫びに商品券をもらった", delta: 5 },
  { text: "公園のかけっこ大会に飛び入り参加して優勝した", delta: 10 },
  { text: "爪切りをサボっていたら家具を傷だらけにしてしまい、弁償することに", delta: -8 },
  { text: "ペット可物件のオーナーに気に入られて、お祝いのおやつをもらった", delta: 4 },
  { text: "耳掃除をサボっていたら耳を痛めてしまい、治療費がかかった", delta: -7 },
];

// 運命の分かれ道マス専用のカード群。「できごと」は日常の出来事、
// こちらは運・偶然・縁・ジンクスをテーマにして体験を分ける(2026-08-09)
const FORTUNE_CARDS = [
  { text: "神社で引いたおみくじが大吉だった", delta: 8 },
  { text: "宝くじ売り場の前で足が止まり、つい1枚買ったら当たった", delta: 15 },
  { text: "黒猫に道を横切られて、なんとなく縁起が悪い一日だった", delta: -6 },
  { text: "友達とのじゃんけんに勝って、奢ってもらえた", delta: 5 },
  { text: "ふらっと立ち寄ったゲームセンターで思わぬ大勝ちをした", delta: 10 },
  { text: "調子に乗って賭け事をしすぎて負けが込んでしまった", delta: -12 },
  { text: "四つ葉のクローバーを見つけて、いいことがありそうな予感がした", delta: 4 },
  { text: "厄年が気になってお祓いを受けることにした", delta: -7 },
  { text: "久しぶりに会った知人から思わぬ小遣いをもらった", delta: 6 },
  { text: "占いで「浪費に注意」と言われた通り、財布を落としてしまった", delta: -10 },
  { text: "ふらっと立ち寄った福引きで特賞が当たった", delta: 20 },
  { text: "運試しにビンゴ大会へ参加したが、外れて会費だけかかった", delta: -3 },
  { text: "流れ星に願い事をしたら、思いがけない臨時収入があった", delta: 9 },
  { text: "縁起のいい方角へ引っ越したら、なぜか調子が上向いた", delta: 7 },
];

// 選択式イベント(汎用choiceシステム)。就職の関門もこの汎用フォーマットに包んで使う
// (game-engine.jsのresolveSquareの"job"ケース参照)。outcomesは重み付きランダムで1つ選ばれる。
const CHOICE_EVENTS = [
  {
    title: "同僚の投資話",
    prompt: "同僚に投資話を持ちかけられた。10万円投資する？",
    options: [
      {
        label: "投資する",
        outcomes: [
          { weight: 1, delta: 30, resultText: "投資が大成功！+30万円" },
          { weight: 1, delta: -15, resultText: "投資に失敗した…-15万円" },
        ],
      },
      {
        label: "断る",
        outcomes: [{ weight: 1, delta: 0, resultText: "きっぱり断った。特に変化はなかった" }],
      },
    ],
  },
  {
    title: "資格取得のチャンス",
    prompt: "資格スクールの案内が届いた。5万円払って受講する？",
    options: [
      {
        label: "受講する",
        outcomes: [
          { weight: 2, delta: 18, resultText: "資格を取得し、手当がついた！+18万円" },
          { weight: 1, delta: -5, resultText: "受講したが挫折してしまった…-5万円" },
        ],
      },
      {
        label: "見送る",
        outcomes: [{ weight: 1, delta: 0, resultText: "今回は見送った。特に変化はなかった" }],
      },
    ],
  },
  {
    title: "週末の副業",
    prompt: "週末だけの副業に誘われた。挑戦する？",
    options: [
      {
        label: "挑戦する",
        outcomes: [
          { weight: 1, delta: 14, resultText: "副業がうまくいった！+14万円" },
          { weight: 1, delta: -4, resultText: "思ったより稼げず、交通費だけかさんだ…-4万円" },
        ],
      },
      {
        label: "やめておく",
        outcomes: [{ weight: 1, delta: 0, resultText: "ゆっくり休むことにした。特に変化はなかった" }],
      },
    ],
  },
  {
    title: "引っ越しの誘い",
    prompt: "家賃の安い町への引っ越しを勧められた。引っ越す？",
    options: [
      {
        label: "引っ越す",
        outcomes: [
          { weight: 1, delta: -8, resultText: "引っ越し費用がかかったが、身軽になった -8万円" },
          { weight: 1, delta: 12, resultText: "家賃が下がり、浮いたお金で生活が楽になった +12万円" },
        ],
      },
      {
        label: "今のまま住む",
        outcomes: [{ weight: 1, delta: 0, resultText: "住み慣れた町に残ることにした。特に変化はなかった" }],
      },
    ],
  },
  {
    title: "ペットを飼うか迷う",
    prompt: "動物保護施設で運命の出会いがあった。ペットを迎える？",
    options: [
      {
        label: "迎える",
        outcomes: [{ weight: 1, delta: -6, resultText: "新しい家族が増えた！(お迎え費用 -6万円)" }],
      },
      {
        label: "今回は見送る",
        outcomes: [{ weight: 1, delta: 0, resultText: "今回は見送った。特に変化はなかった" }],
      },
    ],
  },
  {
    title: "フリマアプリで出品",
    prompt: "不用品をフリマアプリに出品してみる？",
    options: [
      {
        label: "出品する",
        outcomes: [
          { weight: 3, delta: 6, resultText: "そこそこ売れた！+6万円" },
          { weight: 1, delta: -1, resultText: "梱包材代だけかかってしまった…-1万円" },
        ],
      },
      {
        label: "やめておく",
        outcomes: [{ weight: 1, delta: 0, resultText: "面倒なので見送った。特に変化はなかった" }],
      },
    ],
  },
  {
    title: "同窓会のお誘い",
    prompt: "久しぶりの同窓会に誘われた。参加する？",
    options: [
      {
        label: "参加する",
        outcomes: [
          { weight: 1, delta: -5, resultText: "楽しい時間を過ごせた(会費など -5万円)" },
          { weight: 1, delta: 9, resultText: "旧友とのビジネス話がまとまった！+9万円" },
        ],
      },
      {
        label: "欠席する",
        outcomes: [{ weight: 1, delta: 0, resultText: "自宅でゆっくり過ごした。特に変化はなかった" }],
      },
    ],
  },
  {
    title: "健康診断の結果",
    prompt: "健康診断でジム通いを勧められた。月会費を払って通う？",
    options: [
      {
        label: "ジムに通う",
        outcomes: [{ weight: 1, delta: -7, resultText: "体が引き締まった！(会費 -7万円)" }],
      },
      {
        label: "自己流で頑張る",
        outcomes: [
          { weight: 1, delta: 0, resultText: "特に変化はなかった" },
          { weight: 1, delta: 3, resultText: "無理せず続けられて健康グッズが当たった +3万円" },
        ],
      },
    ],
  },
  {
    title: "保険の窓口",
    prompt: "保険の窓口で火災保険を勧められた。加入する？(家を買った後に火事に遭っても、保険金を受け取れるようになる)",
    options: [
      {
        label: "火災保険に加入する(-8万円)",
        insurance: "fire",
        outcomes: [{ weight: 1, delta: -8, resultText: "火災保険に加入した(-8万円)" }],
      },
      {
        label: "加入しない",
        outcomes: [{ weight: 1, delta: 0, resultText: "今回は見送った" }],
      },
    ],
  },
];

const START_MONEY = 300; // 単位: 万円

const TOKEN_COLORS = ["#e4572e", "#2e86ab", "#5cb270", "#f4a300", "#8e5ea2", "#e05d9c"];

// room.js はESモジュールで読み込むため、classicスクリプト側のconst宣言と
// スコープが分かれていても確実に参照できるよう、必要な値をwindow経由でも公開しておく
window.LifeRoadData = { START_MONEY, TOKEN_COLORS };
