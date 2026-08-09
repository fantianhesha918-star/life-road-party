// ライフロード オリジナルゲームデータ
// 盤面・イベント・職業はすべてオリジナル(既存の市販ボードゲームの内容は使用しない)

const BOARD_SQUARES = [
  { index: 0, type: "start", label: "人生スタート" },
  { index: 1, type: "event", label: "できごと" },
  { index: 2, type: "fortune", label: "運命の分かれ道" },
  { index: 3, type: "job", label: "就職の関門" },
  { index: 4, type: "rest", label: "ひと休み" },
  { index: 5, type: "payday", label: "給料日" },
  { index: 6, type: "event", label: "できごと" },
  { index: 7, type: "choice", label: "選択のとき" },
  { index: 8, type: "job", label: "スキルアップ研修" },
  { index: 9, type: "event", label: "できごと" },
  { index: 10, type: "payday", label: "給料日" },
  { index: 11, type: "fortune", label: "運命の分かれ道" },
  { index: 12, type: "event", label: "できごと" },
  { index: 13, type: "rest", label: "ひと休み" },
  { index: 14, type: "payday", label: "給料日" },
  { index: 15, type: "job", label: "スキルアップ研修" },
  { index: 16, type: "choice", label: "選択のとき" },
  { index: 17, type: "event", label: "できごと" },
  { index: 18, type: "payday", label: "給料日" },
  { index: 19, type: "event", label: "できごと" },
  { index: 20, type: "fortune", label: "運命の分かれ道" },
  { index: 21, type: "rest", label: "ひと休み" },
  { index: 22, type: "payday", label: "給料日" },
  { index: 23, type: "event", label: "できごと" },
  { index: 24, type: "job", label: "スキルアップ研修" },
  { index: 25, type: "choice", label: "選択のとき" },
  { index: 26, type: "event", label: "できごと" },
  { index: 27, type: "payday", label: "給料日" },
  { index: 28, type: "fortune", label: "運命の分かれ道" },
  { index: 29, type: "goal", label: "ゴール" },
];

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
];

const FORTUNE_MIN = -10;
const FORTUNE_MAX = 10;

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
];

const START_MONEY = 300; // 単位: 万円

const TOKEN_COLORS = ["#e4572e", "#2e86ab", "#5cb270", "#f4a300", "#8e5ea2", "#e05d9c"];

// room.js はESモジュールで読み込むため、classicスクリプト側のconst宣言と
// スコープが分かれていても確実に参照できるよう、必要な値をwindow経由でも公開しておく
window.LifeRoadData = { START_MONEY, TOKEN_COLORS };
