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
  // ステージギミック(橋)も新規ゲーム開始のたびに開いた状態へ戻す(activeTrapと同じ理由:
  // SNACK_STAGE_NODESはモジュールロード時に1回だけ作られる共有配列なので、前回のプレイで
  // 閉じたままにしておくと次のゲームの序盤ラウンドにまで閉鎖が残ってしまう)。
  const gimmickNode = findSnackNode(SNACK_GIMMICK_NODE_ID);
  if (gimmickNode) gimmickNode.nextNodeIds = SNACK_GIMMICK_ORIGINAL_NEXT_IDS.slice();
  return {
    round: 1,
    totalRounds: SNACK_TOTAL_ROUNDS,
    currentTurnIndex: 0,
    status: "playing", // playing | finished
    activeSnackNodeId: pickNewSnackLocation(null),
    pendingBranch: null, // { playerId, nodeId }
    pendingSnackChoice: null, // { playerId, nodeId }
    pendingStopChoice: null, // { playerId, title, prompt, options }
    // 行動順決めサイコロ・マップ紹介は新規開始時に1回だけ行う演出。再開時にやり直さないよう
    // stateへ保存する(セーブは{state,log,humanId}を丸ごと保存する既存パターンにそのまま乗る)。
    turnOrderDecided: false,
    mapIntroDone: false,
    mapZoomHintShown: false,
    players: playerConfigs.map((p, i) => ({
      id: p.id,
      name: p.name,
      isCPU: !!p.isCPU,
      personality: p.personality || null,
      avatar: p.avatar || { color: "#e4572e", speciesEmoji: null, costumeImage: null },
      // 座席番号(P1〜P4)。生成順=人間が常に1(既存の「先頭は人間」慣習を踏襲)。
      // 行動順決めサイコロでplayers配列自体を並び替えても、この値は不変(仕様6章の要件)。
      seatNumber: i + 1,
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

// 行動順決めサイコロの結果を確定させる。playersを渡された順に並び替えるだけで、
// currentTurnIndexベースの既存ターン進行ロジック(endSnackTurn等)は変更不要
// (配列の物理順=プレイ順という前提を維持したまま、色/HUDはseatNumberで別管理する設計)。
function finalizeSnackTurnOrder(state, orderedPlayerIds) {
  const byId = new Map(state.players.map((p) => [p.id, p]));
  state.players = orderedPlayerIds.map((id) => byId.get(id));
  state.currentTurnIndex = 0;
  state.turnOrderDecided = true;
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

// ラストスパート(仕様書14章FINAL_SPRINT)判定。残り3ラウンド(totalRounds-2ラウンド目)からを対象とする。
function isSnackFinalSprint(state) {
  return state.round >= state.totalRounds - SNACK_FINAL_SPRINT_ROUND_OFFSET;
}

function applySnackFinalSprintBonus(state, baseAmount) {
  return isSnackFinalSprint(state) ? Math.round(baseAmount * SNACK_FINAL_SPRINT_COIN_MULT) : baseAmount;
}

// 通過時に発動する効果(就職・給料日)。ショップは見た目のみで通過効果は持たない(v1簡易仕様)。
function processPassEvent(state, player, node, entries) {
  if (node.nodeType === "job") {
    if (!player.job) {
      player.job = SNACK_JOB_RANKS[Math.floor(Math.random() * SNACK_JOB_RANKS.length)];
      entries.push({ type: "info", text: `『${player.job.name}』になった(給料${player.job.salary})` });
    }
  } else if (node.nodeType === "payday") {
    const base = player.job ? player.job.salary : SNACK_UNEMPLOYED_INCOME;
    const income = applySnackFinalSprintBonus(state, base);
    player.matchCoins += income;
    entries.push({ type: "money", text: `給料日 +${income}${income > base ? "(ラストスパート増額)" : ""}`, delta: income });
  }
}

// 歩数を使い切ったノードでの、そのノード本来のタイプに応じた効果(おやつ確認より後に処理)
function applyNodeStopType(state, node, player, entries) {
  switch (node.nodeType) {
    case "coin": {
      const amount = applySnackFinalSprintBonus(state, 3);
      player.matchCoins += amount;
      entries.push({ type: "money", text: `コインマス +${amount}${amount > 3 ? "(ラストスパート増額)" : ""}`, delta: amount });
      return;
    }
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
  const choiceEvent = applyNodeStopType(state, node, player, entries);
  if (choiceEvent) {
    state.pendingStopChoice = { playerId: player.id, title: choiceEvent.title, prompt: choiceEvent.prompt, options: choiceEvent.options };
  }
}

// path: 呼び出し元が用意した配列に、通過したノードIdを順番に積んでいく(3D側が1マスずつの
// ホップ演出を再生するために使う。ゲームロジック自体はpathの有無に関わらず同じ挙動)。
function stepOntoNode(state, player, nodeId, entries, path) {
  player.currentNodeId = nodeId;
  player.remainingSteps -= 1;
  player.totalStepsWalked += 1;
  if (path) path.push(nodeId);
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

function continueSnackMovement(state, player, entries, path) {
  while (player.remainingSteps > 0 && !state.pendingBranch && !state.pendingSnackChoice && !state.pendingStopChoice) {
    const node = findSnackNode(player.currentNodeId);
    if (node.nextNodeIds.length > 1) {
      state.pendingBranch = { playerId: player.id, nodeId: node.id };
      return;
    }
    stepOntoNode(state, player, node.nextNodeIds[0], entries, path);
  }
}

// 同じマスの交流(仕様書14章PLAYER_ENCOUNTER)。あいさつ/落とし物/交換の3パターンに絞った簡易版
// (ミニ勝負・いたずら・奪い合いは対戦性のあるUIが別途必要になるため今回のフェーズでは対象外。
// 「友好的な結果を含める」という仕様の要件は満たしつつ、駆け引き性のある演出は将来検討とする)。
// 移動が完全に完了した時だけ判定することで「止まった時」のみ発生させ、既に同じマスに
// 居合わせていただけの相手との毎ターン再発生を避ける。
const SNACK_ENCOUNTER_OUTCOMES = [
  { weight: 5, kind: "greet" },
  { weight: 2, kind: "gift" },
  { weight: 2, kind: "trade" },
];

function applySnackEncounterIfAny(state, player, entries) {
  const other = state.players.find((p) => p.id !== player.id && p.currentNodeId === player.currentNodeId);
  if (!other) return;
  const outcome = pickWeightedSnackOutcome(SNACK_ENCOUNTER_OUTCOMES);
  if (outcome.kind === "gift" && other.matchCoins > 0) {
    const amount = Math.min(2, other.matchCoins);
    other.matchCoins -= amount;
    player.matchCoins += amount;
    entries.push({ type: "money", text: `${other.name}から落とし物のコインをもらった(+${amount})`, delta: amount });
  } else if (outcome.kind === "trade") {
    player.matchCoins += 1;
    other.matchCoins += 1;
    entries.push({ type: "money", text: `${other.name}とおやつを交換して仲良くなった`, delta: 1 });
  } else {
    entries.push({ type: "info", text: `${other.name}と出会って挨拶した` });
  }
}

function wrapUpSnackAction(state, player, entries, path) {
  const pending = state.pendingBranch ? "branch" : state.pendingSnackChoice ? "snack" : state.pendingStopChoice ? "choice" : null;
  const movementDone = !pending && player.remainingSteps === 0;
  if (movementDone) applySnackEncounterIfAny(state, player, entries);
  return { entries, pending, movementDone, path: path || [] };
}

function rollSnackAndMove(state, roll) {
  const player = currentSnackPlayer(state);
  const entries = [];
  const path = [];
  player.turnRolled = true;
  const extra = player.pendingExtraDice || 0;
  player.pendingExtraDice = 0;
  player.remainingSteps = roll + extra;
  if (extra) entries.push({ type: "info", text: `追加サイコロの効果で+${extra}` });
  continueSnackMovement(state, player, entries, path);
  return wrapUpSnackAction(state, player, entries, path);
}

function canAffordSnackToll(player, branchNode) {
  return player.matchCoins >= branchNode.tollCost;
}

function resolveSnackBranch(state, chosenNextNodeId) {
  const { playerId, nodeId } = state.pendingBranch;
  const player = state.players.find((p) => p.id === playerId);
  const branchNode = findSnackNode(nodeId);
  if (!branchNode.nextNodeIds.includes(chosenNextNodeId)) throw new Error("invalid branch choice");
  const entries = [];
  const path = [];
  state.pendingBranch = null;
  const isToll = chosenNextNodeId !== branchNode.nextNodeIds[0] && branchNode.tollCost > 0;
  // 通行料が足りない場合は選択自体を拒否し既定ルートへフォールバックする(過少徴収しない、
  // UI側(ルート選択ポップアップ)でも同じ判定でボタンを無効化するのが本来の入口だが、
  // ここでも防御的にガードしておく)。
  if (isToll && !canAffordSnackToll(player, branchNode)) {
    entries.push({ type: "info", text: `コインが足りず近道へ入れなかった(あと${branchNode.tollCost - player.matchCoins}コイン)` });
    stepOntoNode(state, player, branchNode.nextNodeIds[0], entries, path);
  } else {
    if (isToll) {
      player.matchCoins -= branchNode.tollCost;
      entries.push({ type: "money", text: `近道の通行料 -${branchNode.tollCost}`, delta: -branchNode.tollCost });
    }
    stepOntoNode(state, player, chosenNextNodeId, entries, path);
  }
  continueSnackMovement(state, player, entries, path);
  return wrapUpSnackAction(state, player, entries, path);
}

function resolveSnackChoice(state, buy) {
  const { playerId, nodeId } = state.pendingSnackChoice;
  const player = state.players.find((p) => p.id === playerId);
  const node = findSnackNode(nodeId);
  const entries = [];
  const path = [];
  state.pendingSnackChoice = null;
  // resolveSnackBranchの通行料と同種の見落とし(所持金不足でもマイナスまで購入できてしまう)を
  // 防ぐ防御的ガード。UI側(購入確認ポップアップ)でも同じ判定でボタンを無効化する。
  if (buy && player.matchCoins >= SNACK_SNACK_PRICE) {
    player.matchCoins -= SNACK_SNACK_PRICE;
    player.snacks += 1;
    entries.push({ type: "snack", text: "おやつを手に入れた！", delta: -SNACK_SNACK_PRICE });
    state.activeSnackNodeId = pickNewSnackLocation(node.id);
  } else if (buy) {
    entries.push({ type: "info", text: `コインが足りずおやつを買えなかった(あと${SNACK_SNACK_PRICE - player.matchCoins}コイン)` });
  } else {
    entries.push({ type: "info", text: "今回は見送った" });
  }
  if (player.remainingSteps === 0) {
    resolveStopEvent(state, player, node, entries);
  } else {
    continueSnackMovement(state, player, entries, path);
  }
  return wrapUpSnackAction(state, player, entries, path);
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

// ステージギミック(橋)の開閉をラウンド番号だけから決定する。誰も移動中でないラウンド境界
// (endSnackTurnで手番が1周した瞬間)でだけ呼ぶため、仕様書の「通行中には閉じない」を自然に満たす。
function applySnackGimmickForRound(state) {
  const node = findSnackNode(SNACK_GIMMICK_NODE_ID);
  if (!node) return;
  const shouldBeOpen = state.round < SNACK_GIMMICK_CLOSE_ROUND;
  const isOpen = node.nextNodeIds.length > 1;
  if (shouldBeOpen === isOpen) return;
  node.nextNodeIds = shouldBeOpen ? SNACK_GIMMICK_ORIGINAL_NEXT_IDS.slice() : [SNACK_GIMMICK_ORIGINAL_NEXT_IDS[0]];
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
    applySnackGimmickForRound(state);
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
