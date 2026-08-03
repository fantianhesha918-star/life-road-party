// ライフロード CPU(コンピューター)対戦ロジック
// MVPでは「提示された仕事のうち給料が高い方を選ぶ」程度のシンプルな意思決定のみ

function cpuDecideJobOffer(offers) {
  if (offers[0].salary >= offers[1].salary) return 0;
  return 1;
}
