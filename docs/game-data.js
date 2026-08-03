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
  { index: 7, type: "fortune", label: "運命の分かれ道" },
  { index: 8, type: "job", label: "スキルアップ研修" },
  { index: 9, type: "event", label: "できごと" },
  { index: 10, type: "payday", label: "給料日" },
  { index: 11, type: "fortune", label: "運命の分かれ道" },
  { index: 12, type: "event", label: "できごと" },
  { index: 13, type: "rest", label: "ひと休み" },
  { index: 14, type: "payday", label: "給料日" },
  { index: 15, type: "job", label: "スキルアップ研修" },
  { index: 16, type: "fortune", label: "運命の分かれ道" },
  { index: 17, type: "event", label: "できごと" },
  { index: 18, type: "payday", label: "給料日" },
  { index: 19, type: "event", label: "できごと" },
  { index: 20, type: "fortune", label: "運命の分かれ道" },
  { index: 21, type: "rest", label: "ひと休み" },
  { index: 22, type: "payday", label: "給料日" },
  { index: 23, type: "event", label: "できごと" },
  { index: 24, type: "job", label: "スキルアップ研修" },
  { index: 25, type: "fortune", label: "運命の分かれ道" },
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

const START_MONEY = 300; // 単位: 万円

const TOKEN_COLORS = ["#e4572e", "#2e86ab", "#5cb270", "#f4a300", "#8e5ea2", "#e05d9c"];
