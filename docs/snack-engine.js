// アニマルライフ「おやつ集めモード」フェーズ1(試作)のゲームロジック本体。
// 既存game-engine.jsと同じく、stateを直接ミューテートして結果entriesを返す同期的な設計。
// 通過イベント(就職・給料日)は移動の途中で即座に処理し、停止イベント(コイン・収入・支出・
// 選択・おやつ購入確認)は「その手番で歩数を使い切ったノード」でのみ発生させる(v1簡易仕様。
// 本格版で狙う「通過しただけでもおやつ確認が出る」挙動は、コアループの手応えを確認してから
// フェーズ2で検討する)。
// ショップも同様に「マス上を通過した時だけ」ではなく、手番の移動終了後は常にターンハブから
// 立ち寄れる扱いにして状態管理を単純化している(shopノード自体は見た目・雰囲気付けとして残す)。

function currentSnackPlayer(state) {
  return state.players[state.currentTurnIndex];
}

function rollSnackDice() {
  return 1 + Math.floor(Math.random() * 6);
}

function pickWeightedSnackOutcome(outcomes) {
  const total = outcomes.reduce((s, o) => s + o.weight, 0);
  let r = Math.random() * total;
  for (const o of outcomes) {
    if (r < o.weight) return o;
    r -= o.weight;
  }
  return outcomes[outcomes.length - 1];
}

function pickNewSnackLocation(excludeNodeId) {
  const candidates = snackCandidateNodeIds().filter((id) => id !== excludeNodeId);
  const pool = candidates.length ? candidates : snackCandidateNodeIds();
  return pool[Math.floor(Math.random() * pool.length)];
}

function createSnackState(playerConfigs) {
  SNACK_STAGE_NODES.forEach((n) => {
    n.activeTrap = null;
  });
  return {
    round: 1,
    totalRounds: SNACK_TOTAL_ROUNDS,
    currentTurnIndex: 0,
    status: "playing", // playing | finished
    activeSnackNodeId: pickNewSnackLocation(null),
    pendingBranch: null, // { playerId, nodeId }
    pendingSnackChoice: null, // { playerId, nodeId }
    pendingStopChoice: null, // { playerId, title, prompt, options }
    players: playerConfigs.map((p) => ({
      id: p.id,
      name: p.name,
      isCPU: !!p.isCPU,
      personality: p.personality || null,
      avatar: p.avatar || { color: "#e4572e", speciesEmoji: null, costumeImage: null },
      currentNodeId: SNACK_START_NODE_ID,
      remainingSteps: 0,
      matchCoins: SNACK_START_COINS,
      snacks: 0,
      job: null,
      items: [],
      totalStepsWalked: 0,
      guardCharges: 0,
      pendingExtraDice: 0,
      // 「まだロールしていない(サイコロ待ち)」と「移動・確認まで完了した(つぎへ待ち)」を
      // 区別するためのフラグ。remainingSteps===0だけではこの2状態を判別できないため必要
      // (再開(セーブ復元)時にも正しい画面を出すため、UI側の一時状態ではなくstateへ持たせる)。
      turnRolled: false,
    })),
  };
}

function getSnackRanking(state) {
  return [...state.players].sort((a, b) => {
    if (b.snacks !== a.snacks) return b.snacks - a.snacks;
    if (b.matchCoins !== a.matchCoins) return b.matchCoins - a.matchCoins;
    return b.totalStepsWalked - a.totalStepsWalked;
  });
}

// ==================== 移動 ====================

function applyTrapIfAny(state, player, node, entries) {
  if (!node.activeTrap || node.activeTrap === player.id) return;
  if (player.guardCharges > 0) {
    player.guardCharges -= 1;
    entries.push({ type: "info", text: "おまもりのおかげで、いたずらの実を回避した！" });
  } else {
    const penalty = Math.min(4, player.matchCoins);
    player.matchCoins -= penalty;
    entries.push({ type: "money", text: `いたずらの実にひっかかった！(-${penalty})`, delta: -penalty });
  }
  node.activeTrap = null;
}

// 通過時に発動する効果(就職・給料日)。ショップは見た目のみで通過効果は持たない(v1簡易仕様)。
function processPassEvent(state, player, node, entries) {
  if (node.nodeType === "job") {
    if (!player.job) {
      player.job = SNACK_JOB_RANKS[Math.floor(Math.random() * SNACK_JOB_RANKS.length)];
      entries.push({ type: "info", text: `『${player.job.name}』になった(給料${player.job.salary})` });
    }
  } else if (node.nodeType === "payday") {
    const income = player.job ? player.job.salary : SNACK_UNEMPLOYED_INCOME;
    player.matchCoins += income;
    entries.push({ type: "money", text: `給料日 +${income}`, delta: income });
  }
}

// 歩数を使い切ったノードでの、そのノード本来のタイプに応じた効果(おやつ確認より後に処理)
function applyNodeStopType(node, player, entries) {
  switch (node.nodeType) {
    case "coin":
      player.matchCoins += 3;
      entries.push({ type: "money", text: "コインマス +3", delta: 3 });
      return;
    case "income": {
      const ev = SNACK_INCOME_EVENTS[Math.floor(Math.random() * SNACK_INCOME_EVENTS.length)];
      player.matchCoins += ev.delta;
      entries.push({ type: "money", text: ev.text, delta: ev.delta });
      return;
    }
    case "expense": {
      const ev = SNACK_EXPENSE_EVENTS[Math.floor(Math.random() * SNACK_EXPENSE_EVENTS.length)];
      const delta = Math.max(-player.matchCoins, ev.delta);
      player.matchCoins += delta;
      entries.push({ type: "money", text: ev.text, delta });
      return;
    }
    case "rest":
      entries.push({ type: "info", text: "少し休憩した" });
      return;
    case "item-box":
      if (player.items.length < SNACK_ITEM_SLOT_LIMIT) {
        const item = SNACK_ITEMS[Math.floor(Math.random() * SNACK_ITEMS.length)];
        player.items.push(item.id);
        entries.push({ type: "info", text: `アイテム箱: 「${item.name}」を手に入れた` });
      } else {
        entries.push({ type: "info", text: "アイテム箱を見つけたが、持ち物がいっぱいだった" });
      }
      return;
    case "choice": {
      const ev = SNACK_CHOICE_EVENTS[Math.floor(Math.random() * SNACK_CHOICE_EVENTS.length)];
      // pendingStopChoiceはこの関数の呼び出し元(resolveStopEvent)のstateへ設定する必要があるため、
      // ここではイベント内容をentriesではなく戻り値で渡す
      return ev;
    }
    default:
      return;
  }
}

// 歩数を使い切ったノードで発生する停止イベントを解決する(おやつ確認はstepOntoNode側で
// 通過時に既に処理済みのため、ここではそのノード本来のタイプの効果のみを扱う)。
function resolveStopEvent(state, player, node, entries) {
  const choiceEvent = applyNodeStopType(node, player, entries);
  if (choiceEvent) {
    state.pendingStopChoice = { playerId: player.id, title: choiceEvent.title, prompt: choiceEvent.prompt, options: choiceEvent.options };
  }
}

function stepOntoNode(state, player, nodeId, entries) {
  player.currentNodeId = nodeId;
  player.remainingSteps -= 1;
  player.totalStepsWalked += 1;
  const node = findSnackNode(nodeId);
  applyTrapIfAny(state, player, node, entries);
  processPassEvent(state, player, node, entries);
  // おやつ出現地点は「止まった時だけ」ではなく通過した時点で確認する(design通り)。
  // 残り歩数があっても一旦ここで停止し、購入確認が済んでから移動を再開する。
  if (state.activeSnackNodeId === node.id) {
    if (player.matchCoins >= SNACK_SNACK_PRICE) {
      state.pendingSnackChoice = { playerId: player.id, nodeId: node.id };
      return;
    }
    entries.push({ type: "info", text: "おやつを見つけたが、コインが足りず買えなかった" });
  }
  if (player.remainingSteps === 0) {
    resolveStopEvent(state, player, node, entries);
  }
}

function continueSnackMovement(state, player, entries) {
  while (player.remainingSteps > 0 && !state.pendingBranch && !state.pendingSnackChoice && !state.pendingStopChoice) {
    const node = findSnackNode(player.currentNodeId);
    if (node.nextNodeIds.length > 1) {
      state.pendingBranch = { playerId: player.id, nodeId: node.id };
      return;
    }
    stepOntoNode(state, player, node.nextNodeIds[0], entries);
  }
}

function wrapUpSnackAction(state, player, entries) {
  const pending = state.pendingBranch ? "branch" : state.pendingSnackChoice ? "snack" : state.pendingStopChoice ? "choice" : null;
  return { entries, pending, movementDone: !pending && player.remainingSteps === 0 };
}

function rollSnackAndMove(state, roll) {
  const player = currentSnackPlayer(state);
  const entries = [];
  player.turnRolled = true;
  const extra = player.pendingExtraDice || 0;
  player.pendingExtraDice = 0;
  player.remainingSteps = roll + extra;
  if (extra) entries.push({ type: "info", text: `追加サイコロの効果で+${extra}` });
  continueSnackMovement(state, player, entries);
  return wrapUpSnackAction(state, player, entries);
}

function resolveSnackBranch(state, chosenNextNodeId) {
  const { playerId, nodeId } = state.pendingBranch;
  const player = state.players.find((p) => p.id === playerId);
  const branchNode = findSnackNode(nodeId);
  if (!branchNode.nextNodeIds.includes(chosenNextNodeId)) throw new Error("invalid branch choice");
  const entries = [];
  state.pendingBranch = null;
  if (chosenNextNodeId !== branchNode.nextNodeIds[0] && branchNode.tollCost > 0) {
    const toll = Math.min(branchNode.tollCost, player.matchCoins);
    player.matchCoins -= toll;
    entries.push({ type: "money", text: `近道の通行料 -${toll}`, delta: -toll });
  }
  stepOntoNode(state, player, chosenNextNodeId, entries);
  continueSnackMovement(state, player, entries);
  return wrapUpSnackAction(state, player, entries);
}

function resolveSnackChoice(state, buy) {
  const { playerId, nodeId } = state.pendingSnackChoice;
  const player = state.players.find((p) => p.id === playerId);
  const node = findSnackNode(nodeId);
  const entries = [];
  state.pendingSnackChoice = null;
  if (buy) {
    player.matchCoins -= SNACK_SNACK_PRICE;
    player.snacks += 1;
    entries.push({ type: "snack", text: "おやつを手に入れた！", delta: -SNACK_SNACK_PRICE });
    state.activeSnackNodeId = pickNewSnackLocation(node.id);
  } else {
    entries.push({ type: "info", text: "今回は見送った" });
  }
  if (player.remainingSteps === 0) {
    resolveStopEvent(state, player, node, entries);
  } else {
    continueSnackMovement(state, player, entries);
  }
  return wrapUpSnackAction(state, player, entries);
}

function resolveSnackStopChoice(state, optionIndex) {
  const { playerId } = state.pendingStopChoice;
  const player = state.players.find((p) => p.id === playerId);
  const option = state.pendingStopChoice.options[optionIndex];
  const outcome = pickWeightedSnackOutcome(option.outcomes);
  const entries = [];
  state.pendingStopChoice = null;
  if (outcome.delta) {
    const delta = Math.max(-player.matchCoins, outcome.delta);
    player.matchCoins += delta;
    entries.push({ type: "money", text: outcome.resultText, delta });
  } else {
    entries.push({ type: "info", text: outcome.resultText });
  }
  return wrapUpSnackAction(state, player, entries);
}

// 手番の移動・各種確認がすべて終わった後、明示的に呼ばれてはじめて次のプレイヤーへ進む
// (ショップ立ち寄り・アイテム使用はターンハブから任意に行えるため、自動では進めない)。
function endSnackTurn(state) {
  currentSnackPlayer(state).turnRolled = false;
  const total = state.players.length;
  const next = (state.currentTurnIndex + 1) % total;
  state.currentTurnIndex = next;
  if (next === 0) {
    state.round += 1;
    if (state.round > state.totalRounds) {
      state.status = "finished";
    }
  }
}

// ==================== ショップ・アイテム ====================

function buySnackShopItem(state, playerId, itemId) {
  const player = state.players.find((p) => p.id === playerId);
  const item = SNACK_ITEMS.find((it) => it.id === itemId);
  if (!item) return { ok: false, reason: "invalid-item" };
  if (player.items.length >= SNACK_ITEM_SLOT_LIMIT) return { ok: false, reason: "slots-full" };
  if (player.matchCoins < item.price) return { ok: false, reason: "insufficient-coins" };
  player.matchCoins -= item.price;
  player.items.push(item.id);
  return { ok: true };
}

function useSnackItem(state, playerId, itemId) {
  const player = state.players.find((p) => p.id === playerId);
  const idx = player.items.indexOf(itemId);
  if (idx === -1) return { ok: false, reason: "not-owned" };
  const item = SNACK_ITEMS.find((it) => it.id === itemId);
  const entries = [];
  switch (item.effect) {
    case "extraDice":
      player.pendingExtraDice = (player.pendingExtraDice || 0) + item.value;
      entries.push({ type: "info", text: "次のサイコロの出目に+1される" });
      break;
    case "trap": {
      const node = findSnackNode(player.currentNodeId);
      const targetId = node.nextNodeIds[0];
      const targetNode = findSnackNode(targetId);
      if (targetNode) {
        targetNode.activeTrap = player.id;
        entries.push({ type: "info", text: "少し先にいたずらの実を仕掛けた" });
      }
      break;
    }
    case "hint": {
      const snackNode = findSnackNode(state.activeSnackNodeId);
      entries.push({ type: "info", text: `鼻きき草: 今のおやつは「${snackNode.zone === "inner" ? "内周(近道)" : "外周"}」側にあるにおいがする` });
      break;
    }
    case "guard":
      player.guardCharges = (player.guardCharges || 0) + 1;
      entries.push({ type: "info", text: "おまもりを身につけた(次の妨害を1回無効化)" });
      break;
    default:
      break;
  }
  player.items.splice(idx, 1);
  return { ok: true, entries };
}
