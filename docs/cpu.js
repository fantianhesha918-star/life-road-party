// ライフロード CPU(コンピューター)対戦ロジック
// 性格プリセットによって、選択式イベント(就職を含む)の選択傾向が変わる

const CPU_PERSONALITIES = [
  { id: "ambitious", label: "野心家", description: "給料の高い仕事を選ぶ" },
  { id: "steady", label: "堅実家", description: "無理をせず、給料が控えめな仕事を選ぶ" },
  { id: "whimsical", label: "気まぐれ屋", description: "気分次第でランダムに仕事を選ぶ" },
];

function pickRandomPersonality() {
  const p = CPU_PERSONALITIES[Math.floor(Math.random() * CPU_PERSONALITIES.length)];
  return p.id;
}

function personalityLabel(personalityId) {
  const p = CPU_PERSONALITIES.find((x) => x.id === personalityId);
  return p ? p.label : "";
}

// optionのoutcomesから期待値(delta×weightの加重平均)を求める
function expectedDelta(option) {
  const total = option.outcomes.reduce((s, o) => s + o.weight, 0);
  return option.outcomes.reduce((s, o) => s + o.delta * o.weight, 0) / total;
}

// optionのoutcomesのばらつき(分散)を求める。steady(堅実家)が手堅い選択肢を選ぶために使う
function outcomeVariance(option) {
  const mean = expectedDelta(option);
  const total = option.outcomes.reduce((s, o) => s + o.weight, 0);
  return option.outcomes.reduce((s, o) => s + o.weight * (o.delta - mean) ** 2, 0) / total;
}

// optionの「良さ」を1つの数値にする。就職の選択肢(option.jobあり)は給料そのもの、
// 一般の選択イベントはoutcomesの期待値で比較する
function scoreOption(option) {
  return option.job ? option.job.salary : expectedDelta(option);
}

// pendingChoice.optionsの中からCPUが選ぶ番号を決める(就職・一般の選択イベント共通)
function cpuDecideOption(pendingChoice, personality) {
  const options = pendingChoice.options;
  if (personality === "whimsical") {
    return Math.floor(Math.random() * options.length);
  }
  if (personality === "steady") {
    // 就職なら最も給料が低い(=無理をしない)、一般イベントなら最もばらつきが小さい(=手堅い)方を選ぶ
    const steadyScore = (o) => (o.job ? o.job.salary : outcomeVariance(o));
    return options.reduce((bestI, o, i) => (steadyScore(o) <= steadyScore(options[bestI]) ? i : bestI), 0);
  }
  // ambitious(野心家)、既定値
  return options.reduce((bestI, o, i) => (scoreOption(o) >= scoreOption(options[bestI]) ? i : bestI), 0);
}

window.LifeRoadCPU = { CPU_PERSONALITIES, pickRandomPersonality, personalityLabel, cpuDecideOption };
