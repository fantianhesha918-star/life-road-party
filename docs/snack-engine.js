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

// ガブリオンの「しょんぼりサイコロ」効果(CURSED_DIE)がかかっている場合、出目を1〜3に
// 制限し、使用後は解除する(仕様書「1回振ると解除」)。state/playerIdを渡さない呼び出し
// (Node vm回帰テスト等の素の乱数確認用)にも対応できるよう両方省略可能にしてある。
function rollSnackDice(state, playerId) {
  // 「狙い目の粉」で固定された出目があれば最優先(消費・entry表示はrollSnackAndMove側で行う。
  // ここでは覗き見するだけに留め、3D側の演出(見た目だけの回転)にも同じ値を渡せるようにする)。
  const forcedPlayer = state && playerId ? state.players.find((p) => p.id === playerId) : null;
  if (forcedPlayer && forcedPlayer.pendingForcedRoll) return forcedPlayer.pendingForcedRoll;
  const cursedList = state && state.gaburion ? state.gaburion.cursedDiePlayerIds : null;
  const isCursed = !!(cursedList && playerId && cursedList.includes(playerId));
  const max = isCursed ? 3 : 6;
  if (isCursed) {
    state.gaburion.cursedDiePlayerIds = cursedList.filter((id) => id !== playerId);
  }
  return 1 + Math.floor(Math.random() * max);
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

// excludeIds: 他のおやつが既に置かれている(=重複配置を避けたい)ノードIdの配列。
function pickNewSnackLocation(excludeIds) {
  const exclude = new Set(excludeIds || []);
  const candidates = snackCandidateNodeIds().filter((id) => !exclude.has(id));
  const pool = candidates.length ? candidates : snackCandidateNodeIds();
  return pool[Math.floor(Math.random() * pool.length)];
}

// 同時出現数(SNACK_ACTIVE_SNACK_COUNT)ぶん、互いに重複しないおやつ出現地点を初期抽選する。
function pickInitialSnackLocations() {
  const ids = [];
  for (let i = 0; i < SNACK_ACTIVE_SNACK_COUNT; i++) {
    ids.push(pickNewSnackLocation(ids));
  }
  return ids;
}

function createSnackState(playerConfigs) {
  SNACK_STAGE_NODES.forEach((n) => {
    n.activeTrap = null;
    // ガブリオン仕様6章FINAL_THREE_TRANSFORMがnodeType/gaburionを書き換えるため、
    // 新規ゲーム開始のたびに読み込み時点の姿へ戻す。
    n.nodeType = SNACK_ORIGINAL_NODE_TYPES.get(n.id);
    n.gaburion = SNACK_GABURION_INITIAL_NODE_IDS.includes(n.id);
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
    activeSnackNodeIds: pickInitialSnackLocations(),
    pendingBranch: null, // { playerId, nodeId }
    pendingSnackChoice: null, // { playerId, nodeId }
    pendingStopChoice: null, // { playerId, title, prompt, options }
    pendingGaburion: null, // { playerId, nodeId }
    // ガブリオンイベント(05_ガブリオンイベント仕様書8章の保存項目に準拠)。cursedDiePlayerIdsは
    // 個別イベントをまたいで持続する(次に該当プレイヤーがサイコロを振るまで残る)。
    gaburion: { eventId: null, actorId: null, phase: null, resultId: null, targetPlayerId: null, resolved: true, cursedDiePlayerIds: [] },
    finalThree: { activated: false, activatedRound: null, seed: null, transformedSpaces: [] },
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
      // 統計データ(仕様書14章、3f「特別賞」で使用予定)。既存のtotalStepsWalkedと同じ
      // 「アクション処理の中でその場でインクリメントする」方針を踏襲する。
      coinsEarned: 0,
      coinsSpent: 0,
      itemsUsed: 0,
      shortcutsUsed: 0,
      guardCharges: 0,
      pendingExtraDice: 0,
      pendingForcedRoll: 0,
      pendingDoubleGain: false,
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

// steal/pushback/tradePositionアイテムの自動ターゲット。対象選択UIを新設せず、常に「自分以外の
// 現在1位」を狙う(マリオカートの青コウラ的な、先頭ほど狙われるキャッチアップ演出)。
function getSnackLeaderExcluding(state, excludeId) {
  return getSnackRanking(state).find((p) => p.id !== excludeId) || null;
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
  return isSnackFinalSprint(state) ? Math.ceil(baseAmount * SNACK_FINAL_SPRINT_COIN_MULT) : baseAmount;
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
// ガブリオンマス(仕様書05章)は「止まった時だけ・通常マス効果の代わりに」発生させるため、
// 他の停止効果より先に判定し、該当すればそちらで処理を打ち切る。
function resolveStopEvent(state, player, node, entries) {
  if (node.gaburion) {
    state.pendingGaburion = { playerId: player.id, nodeId: node.id };
    return;
  }
  const choiceEvent = applyNodeStopType(state, node, player, entries);
  if (choiceEvent) {
    state.pendingStopChoice = { playerId: player.id, title: choiceEvent.title, prompt: choiceEvent.prompt, options: choiceEvent.options };
  }
}

// ==================== ガブリオンイベント ====================

// ノードの「一つ前」を逆引きする(nextNodeIdsは一方通行の有向グラフなので、後退にはこの
// 逆探索が必要)。ステージギミック(橋)がnextNodeIdsを実行時に書き換えるため、結果は
// キャッシュせず毎回その場で求める(32ノード程度の走査なので負荷は無視できる)。
function getSnackPredecessorNodeId(nodeId) {
  const found = SNACK_STAGE_NODES.find((n) => n.nextNodeIds.includes(nodeId));
  return found ? found.id : nodeId;
}

// ガブリオン結果「ちょっと戻って！」。経路を指定歩数だけ逆戻りする。stepOntoNode等の通常の
// 移動パイプラインを経由しないため、到着先の各種イベント(おやつ確認・停止効果・ガブリオン
// 再発生)は一切発生しない(仕様書「到着先イベントは発生させない」を自然に満たす)。
function movePlayerBackForGaburion(player, steps) {
  let nodeId = player.currentNodeId;
  for (let i = 0; i < steps; i++) {
    nodeId = getSnackPredecessorNodeId(nodeId);
  }
  player.currentNodeId = nodeId;
}

// 救済ルール・おやつ再配置候補切れを考慮した上で、抽選対象の候補リストを組み立てる
// (仕様書05章「救済ルール」)。
function buildGaburionOutcomePool(state, player) {
  const ranking = getSnackRanking(state);
  const isLastPlace = ranking.length > 0 && ranking[ranking.length - 1].id === player.id;
  const needsRescue = player.matchCoins === 0 && player.snacks === 0 && isLastPlace;
  let pool = SNACK_GABURION_OUTCOMES.map((o) => ({ id: o.id, weight: o.weight }));
  if (needsRescue) {
    const removed = pool.filter((o) => o.id === "COIN_LOSS" || o.id === "ALL_PAY");
    const bonusWeight = removed.reduce((sum, o) => sum + o.weight, 0);
    pool = pool.filter((o) => o.id !== "COIN_LOSS" && o.id !== "ALL_PAY");
    const bonusEntry = pool.find((o) => o.id === "BONUS_COINS");
    bonusEntry.weight += bonusWeight;
  }
  return pool;
}

function pickGaburionOutcomeId(state, player) {
  const pool = buildGaburionOutcomePool(state, player);
  let resultId = pickWeightedSnackOutcome(pool).id;
  if (resultId === "SNACK_RELOCATE") {
    const hasCandidate = snackCandidateNodeIds().some((id) => !state.activeSnackNodeIds.includes(id));
    if (!hasCandidate) resultId = "BONUS_COINS"; // 仕様書「候補がない場合はBONUS_COINSへ置換」
  }
  return resultId;
}

// 抽選結果を実際に適用する。戻り値のtargetPlayerIdはセーブ項目gaburion.targetPlayerId用
// (ALL_PAY/SNACK_RELOCATEのように特定の1人に絞れない結果はnullを返す)。
function applyGaburionOutcome(state, player, resultId, entries) {
  switch (resultId) {
    case "COIN_LOSS": {
      const amount = Math.min(5, player.matchCoins);
      player.matchCoins -= amount;
      entries.push({ type: "money", text: `ガブリオンにコインを${amount}奪われた！`, delta: -amount });
      return { targetPlayerId: player.id };
    }
    case "ALL_PAY": {
      state.players.forEach((p) => {
        const amount = Math.min(3, p.matchCoins);
        if (amount <= 0) return;
        p.matchCoins -= amount;
        entries.push({ type: "money", text: `${p.name}が${amount}コイン徴収された`, delta: -amount });
      });
      return { targetPlayerId: null };
    }
    case "ITEM_LOSS": {
      if (player.items.length) {
        const idx = Math.floor(Math.random() * player.items.length);
        const itemId = player.items[idx];
        const item = SNACK_ITEMS.find((it) => it.id === itemId);
        player.items.splice(idx, 1);
        entries.push({ type: "info", text: `「${item ? item.name : "アイテム"}」を奪われた！` });
      } else {
        const amount = Math.min(3, player.matchCoins);
        player.matchCoins -= amount;
        entries.push({ type: "money", text: `アイテムが無いのでコインを${amount}奪われた`, delta: -amount });
      }
      return { targetPlayerId: player.id };
    }
    case "MOVE_BACK": {
      movePlayerBackForGaburion(player, 3);
      entries.push({ type: "info", text: "3マス後ろへ戻された！" });
      return { targetPlayerId: player.id };
    }
    case "SWAP_POSITION": {
      const others = state.players.filter((p) => p.id !== player.id);
      const other = others[Math.floor(Math.random() * others.length)];
      const tmpNodeId = player.currentNodeId;
      player.currentNodeId = other.currentNodeId;
      other.currentNodeId = tmpNodeId;
      entries.push({ type: "info", text: `${other.name}と場所を交換した！` });
      return { targetPlayerId: other.id };
    }
    case "SNACK_RELOCATE": {
      // 複数出現している場合は、その中から無作為に1個だけを引っ越しさせる(全部を動かすと
      // 一度にプレイヤーが積み上げた土地勘が丸ごと無効になり、罰則として重すぎるため)。
      const idx = Math.floor(Math.random() * state.activeSnackNodeIds.length);
      state.activeSnackNodeIds[idx] = pickNewSnackLocation(state.activeSnackNodeIds);
      entries.push({ type: "info", text: "おやつがお引っ越しした！" });
      return { targetPlayerId: null };
    }
    case "CURSED_DIE": {
      const isFinalRound = state.round === state.totalRounds;
      if (isFinalRound) {
        // 仕様書「最終ラウンドで出た場合は次回へ持ち越さず3コイン獲得へ置換」
        player.matchCoins += 3;
        entries.push({ type: "money", text: "最終ラウンドなのでコイン+3に変換された", delta: 3 });
      } else {
        if (!state.gaburion.cursedDiePlayerIds.includes(player.id)) {
          state.gaburion.cursedDiePlayerIds.push(player.id);
        }
        entries.push({ type: "info", text: "次のサイコロの出目が1〜3に制限される…" });
      }
      return { targetPlayerId: player.id };
    }
    case "BONUS_COINS":
    default: {
      player.matchCoins += 5;
      entries.push({ type: "money", text: "ガブリオン大失敗！コインを5もらった", delta: 5 });
      return { targetPlayerId: player.id };
    }
  }
}

// ==================== FINAL_THREE_TRANSFORM(第8ラウンド開始時の盤面変化) ====================

// 32マス化(第3弾)により仕様書6章の分類比率表の前提(32マス)がそのまま成立するようになったが、
// 引き続き仕様書が用意している簡略ルール(「新たにガブリオン2マス、マイナス2マスを増やす」)を
// 採用し、変化対象は最大4マスに絞る(細かい分類比率表そのものの再現は今回もスコープ外)。
function pickSnackFinalThreeCandidates(nodeTypes, excludeIds, count) {
  const pool = SNACK_STAGE_NODES.filter((n) => nodeTypes.includes(n.nodeType) && !n.gaburion && !excludeIds.has(n.id));
  const shuffled = pool.slice().sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

function applySnackFinalThreeTransform(state) {
  if (state.finalThree.activated) return [];
  const excludeIds = new Set([SNACK_START_NODE_ID, SNACK_GIMMICK_NODE_ID, ...state.activeSnackNodeIds]);
  state.players.forEach((p) => excludeIds.add(p.currentNodeId));
  SNACK_STAGE_NODES.forEach((n) => {
    if (n.nodeType === "branch" || n.nodeType === "shop") excludeIds.add(n.id);
  });
  const toGaburion = pickSnackFinalThreeCandidates(["coin", "income", "payday"], excludeIds, 2);
  toGaburion.forEach((n) => excludeIds.add(n.id));
  const toMinus = pickSnackFinalThreeCandidates(["choice", "item-box", "rest"], excludeIds, 2);
  const changed = [];
  toGaburion.forEach((n) => {
    changed.push({ spaceId: n.id, beforeType: n.nodeType, afterType: "gaburion" });
    n.gaburion = true;
  });
  toMinus.forEach((n) => {
    changed.push({ spaceId: n.id, beforeType: n.nodeType, afterType: "expense" });
    n.nodeType = "expense";
  });
  state.finalThree.activated = true;
  state.finalThree.activatedRound = state.round;
  state.finalThree.seed = Math.floor(Math.random() * 1e9);
  state.finalThree.transformedSpaces = changed;
  return changed;
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
  if (state.activeSnackNodeIds.includes(node.id)) {
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

// 統計データ(仕様書14章)。entries内の{type:"money", delta}を集計するだけなので、
// アクションの区切りごとに呼ばれるwrapUpSnackAction一箇所に置いても取りこぼしが無い
// (どのアクション関数も、コインが変化する箇所では必ずtype:"money"のentryを積む設計のため)。
function accumulateSnackStats(player, entries) {
  entries.forEach((e) => {
    if (e.type !== "money" || typeof e.delta !== "number") return;
    if (e.delta > 0) player.coinsEarned += e.delta;
    else if (e.delta < 0) player.coinsSpent += -e.delta;
  });
}

// 「ダブルチャンスの種」。その手番で最初に発生したプラスのコイン/おやつ獲得(entries内を
// 先頭から探して最初の1件だけ)を2倍にする。手番をまたいで持ち越さないよう、未消費でも
// endSnackTurnでクリアする(snack-engine.js内、endSnackTurn参照)。
function applySnackDoubleGainIfPending(player, entries) {
  if (!player.pendingDoubleGain) return;
  const target = entries.find((e) => e.type === "snack" || (e.type === "money" && e.delta > 0));
  if (!target) return;
  player.pendingDoubleGain = false;
  if (target.type === "snack") {
    player.snacks += 1;
    target.text += "(ダブルチャンスの種でもう1個！)";
  } else {
    player.matchCoins += target.delta;
    target.text += `(ダブルチャンスの種で+${target.delta}追加！)`;
    target.delta *= 2;
  }
}

function wrapUpSnackAction(state, player, entries, path) {
  const pending = state.pendingBranch
    ? "branch"
    : state.pendingSnackChoice
      ? "snack"
      : state.pendingStopChoice
        ? "choice"
        : state.pendingGaburion
          ? "gaburion"
          : null;
  const movementDone = !pending && player.remainingSteps === 0;
  if (movementDone) applySnackEncounterIfAny(state, player, entries);
  applySnackDoubleGainIfPending(player, entries);
  accumulateSnackStats(player, entries);
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
      player.shortcutsUsed += 1;
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
  // 購入により新しく出現したおやつの場所(2026-08-16、UI側の「移動後カメラ紹介」演出が
  // どこを紹介すればよいか分かるよう、戻り値に含める)。購入しなかった/できなかった場合はnull。
  let newSnackNodeId = null;
  // resolveSnackBranchの通行料と同種の見落とし(所持金不足でもマイナスまで購入できてしまう)を
  // 防ぐ防御的ガード。UI側(購入確認ポップアップ)でも同じ判定でボタンを無効化する。
  if (buy && player.matchCoins >= SNACK_SNACK_PRICE) {
    player.matchCoins -= SNACK_SNACK_PRICE;
    player.snacks += 1;
    entries.push({ type: "snack", text: "おやつを手に入れた！", delta: -SNACK_SNACK_PRICE });
    const idx = state.activeSnackNodeIds.indexOf(node.id);
    if (idx !== -1) {
      newSnackNodeId = pickNewSnackLocation(state.activeSnackNodeIds);
      state.activeSnackNodeIds[idx] = newSnackNodeId;
    }
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
  return { ...wrapUpSnackAction(state, player, entries, path), newSnackNodeId };
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
  const player = currentSnackPlayer(state);
  player.turnRolled = false;
  // ダブルチャンスの種が未消費のまま手番が終わった場合、次の手番へ持ち越さない。
  player.pendingDoubleGain = false;
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
      entries.push({ type: "info", text: `次のサイコロの出目に+${item.value}される` });
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
      // 複数出現時は、このプレイヤーから最も近い1個を教える(全部答えると探す楽しみが薄れるため)。
      let nearestNode = null;
      let nearestDist = Infinity;
      state.activeSnackNodeIds.forEach((id) => {
        const d = window.LifeRoadSnackCPU.snackGraphDistance(player.currentNodeId, id);
        if (d < nearestDist) {
          nearestDist = d;
          nearestNode = findSnackNode(id);
        }
      });
      if (nearestNode) {
        entries.push({ type: "info", text: `鼻きき草: 一番近いおやつは「${nearestNode.zone === "inner" ? "内周(近道)" : "外周"}」側にあるにおいがする` });
      }
      break;
    }
    case "guard":
      player.guardCharges = (player.guardCharges || 0) + 1;
      entries.push({ type: "info", text: "おまもりを身につけた(次の妨害を1回無効化)" });
      break;
    case "steal": {
      const target = getSnackLeaderExcluding(state, player.id);
      if (target && target.matchCoins > 0) {
        const amount = Math.min(8, target.matchCoins);
        target.matchCoins -= amount;
        player.matchCoins += amount;
        entries.push({ type: "money", text: `${target.name}からコインを${amount}横取りした！`, delta: amount });
      } else {
        entries.push({ type: "info", text: "横取りできる相手がいなかった" });
      }
      break;
    }
    case "warp": {
      // 前方への経路を辿らず、出現中のおやつ候補のうち最も近い1つへ直接ノードを差し替える
      // (movePlayerBackForGaburionの後退ワープと同じ「到着処理を通す/通さないは目的次第」という
      // 考え方に基づき、こちらはおやつ取得が目的のため意図的にstepOntoNodeの到着処理を通す)。
      let nearestId = null;
      let nearestDist = Infinity;
      state.activeSnackNodeIds.forEach((id) => {
        const d = window.LifeRoadSnackCPU.snackGraphDistance(player.currentNodeId, id);
        if (d < nearestDist) {
          nearestDist = d;
          nearestId = id;
        }
      });
      if (nearestId) {
        // 通常のサイコロ移動と同じ到着処理(おやつ確認・停止イベント)をstepOntoNode経由で
        // そのまま起こすため、remainingStepsを1にしてから呼ぶ(内部で1減算されてちょうど0になる)。
        player.remainingSteps = 1;
        player.turnRolled = true;
        const warpEntries = [];
        stepOntoNode(state, player, nearestId, warpEntries, []);
        entries.push({ type: "info", text: "ワープ玉で一番近いおやつマスへ跳んだ！" });
        entries.push(...warpEntries);
      } else {
        entries.push({ type: "info", text: "ワープ先(出現中のおやつ)が見つからなかった" });
      }
      break;
    }
    case "pushback": {
      const target = getSnackLeaderExcluding(state, player.id);
      if (target) {
        movePlayerBackForGaburion(target, 3);
        entries.push({ type: "info", text: `${target.name}を3マス後ろへ押し戻した！` });
      } else {
        entries.push({ type: "info", text: "押し戻せる相手がいなかった" });
      }
      break;
    }
    case "forceRoll":
      player.pendingForcedRoll = item.value;
      entries.push({ type: "info", text: `次のサイコロの目が${item.value}に固定される` });
      break;
    case "doubleGain":
      player.pendingDoubleGain = true;
      entries.push({ type: "info", text: "今回の手番、最初に得るコイン・おやつが2倍になる" });
      break;
    case "tradePosition": {
      const target = getSnackLeaderExcluding(state, player.id);
      if (target) {
        const tmpNodeId = player.currentNodeId;
        player.currentNodeId = target.currentNodeId;
        target.currentNodeId = tmpNodeId;
        entries.push({ type: "info", text: `${target.name}と場所を交換した！` });
      } else {
        entries.push({ type: "info", text: "交換できる相手がいなかった" });
      }
      break;
    }
    default:
      break;
  }
  accumulateSnackStats(player, entries);
  player.items.splice(idx, 1);
  player.itemsUsed += 1;
  return { ok: true, entries };
}
