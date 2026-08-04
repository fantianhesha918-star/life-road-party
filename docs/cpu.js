// ライフロード CPU(コンピューター)対戦ロジック
// 性格プリセットによって、就職の選択傾向が変わる

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

function cpuDecideJobOffer(offers, personality) {
  switch (personality) {
    case "steady":
      return offers[0].salary <= offers[1].salary ? 0 : 1;
    case "whimsical":
      return Math.random() < 0.5 ? 0 : 1;
    default:
      return offers[0].salary >= offers[1].salary ? 0 : 1;
  }
}

window.LifeRoadCPU = { CPU_PERSONALITIES, pickRandomPersonality, personalityLabel, cpuDecideJobOffer };
