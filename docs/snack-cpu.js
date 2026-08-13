// おやつ集めモード(試作)のCPU判断ロジック。
// 本格版で想定している8軸評価(Codexレビュー案)から、まずは
// 「おやつまでの距離」「所持コインと必要な支払い」「残りラウンド数」の3軸に絞った
// 簡易スコアリングで動かし、遊んでみてから調整する。

// nextNodeIds(一方通行)をたどるBFSで、fromからtoまでの最短歩数を求める。
// 到達不能ならInfinityを返す。
function snackGraphDistance(fromId, toId) {
  if (fromId === toId) return 0;
  const visited = new Set([fromId]);
  let frontier = [fromId];
  let dist = 0;
  while (frontier.length) {
    dist += 1;
    const next = [];
    for (const id of frontier) {
      const node = findSnackNode(id);
      for (const nid of node.nextNodeIds) {
        if (visited.has(nid)) continue;
        if (nid === toId) return dist;
        visited.add(nid);
        next.push(nid);
      }
    }
    frontier = next;
  }
  return Infinity;
}

// 分岐(外周を進み続けるか、通行料を払って内周のショートカットに入るか)の判断。
// 内周を使った場合に「おやつまでの歩数」がどれだけ縮むかと、通行料に見合うコインがあるかを見る。
// 戻り値を{choice, reason}にしているのは、仕様書14章「CPU判断理由の吹き出し」用に、
// 実際に使った評価材料(距離・所持金・残りラウンド)をそのまま一言テキスト化するため
// (後付けの説明文ではなく、上のif分岐が採用した理由をそのまま返す)。
function cpuChooseSnackBranch(state, player) {
  const branch = findSnackNode(state.pendingBranch.nodeId);
  const options = branch.nextNodeIds;
  if (options.length === 1) return { choice: options[0], reason: null };
  const [stayOuter, takeShortcut] = options;
  const distStay = snackGraphDistance(stayOuter, state.activeSnackNodeId);
  const distShortcut = snackGraphDistance(takeShortcut, state.activeSnackNodeId);
  const canAffordToll = player.matchCoins >= branch.tollCost;
  // 残りラウンドが少ないほど、多少無理をしてでも近道を優先する
  const roundsLeft = state.totalRounds - state.round + 1;
  const urgency = roundsLeft <= 3 ? 2 : 0;
  if (canAffordToll && distShortcut + urgency < distStay) {
    return { choice: takeShortcut, reason: `${branch.tollCost}コイン払っておやつまで近道` };
  }
  return {
    choice: stayOuter,
    reason: canAffordToll ? "外周のままでもおやつまで十分近いから外周へ" : "近道の通行料が足りないので外周へ",
  };
}

// おやつ購入は、コインが足りている限りCPUは原則購入する(本格版のような終盤の見送り判断は
// 試作では省略し、まずは「おやつを取り合う」という基本の駆け引きを検証する)。
function cpuDecideSnackPurchase() {
  return true;
}

// 所持アイテムを使うかどうかの簡易判断。手番の冒頭(ロール前)にだけ呼ばれる想定。
// - 追加サイコロ: おやつまでの距離が3以上あれば使う
// - おまもり: 妨害を受けていない限り温存する(guardChargesが0の時だけ使う判断はItem所持側で行う)
// - 鼻きき草・いたずらの実: 手元に余裕があれば早めに使い切る(在庫を腐らせない)
function cpuDecideItemToUse(state, player) {
  if (!player.items.length) return { choice: null, reason: null };
  const distToSnack = snackGraphDistance(player.currentNodeId, state.activeSnackNodeId);
  const diceItem = player.items.find((id) => {
    const item = SNACK_ITEMS.find((it) => it.id === id);
    return item && item.effect === "extraDice";
  });
  if (diceItem && distToSnack >= 3) {
    return { choice: diceItem, reason: "おやつまで遠いので追加サイコロを使う" };
  }
  const trapItem = player.items.find((id) => {
    const item = SNACK_ITEMS.find((it) => it.id === id);
    return item && item.effect === "trap";
  });
  if (trapItem) {
    return { choice: trapItem, reason: "先にいたずらの実を仕掛けておく" };
  }
  const hintItem = player.items.find((id) => {
    const item = SNACK_ITEMS.find((it) => it.id === id);
    return item && item.effect === "hint";
  });
  if (hintItem && distToSnack >= 4) {
    return { choice: hintItem, reason: "おやつの方角を確かめるため鼻きき草を使う" };
  }
  return { choice: null, reason: null };
}

window.LifeRoadSnackCPU = {
  snackGraphDistance,
  cpuChooseSnackBranch,
  cpuDecideSnackPurchase,
  cpuDecideItemToUse,
};
