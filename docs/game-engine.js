// ライフロード ゲームロジックコア(一人モード・通信モード共通で使う想定)
// 純粋なゲームルールのみを扱い、画面描画やFirebase通信には関与しない

// ゲームモード(短い/普通/長い)導入により、盤面の長さは固定ではなくなった。
// game-data.jsのsetActiveBoard()がゲーム開始のたびにBOARD_SQUARESと一緒にこの値も
// 再代入する(letにしているのはそのため。詳細はgame-data.js側のコメント参照)。
let GOAL_INDEX = BOARD_SQUARES.length - 1;

function createInitialState(playerConfigs) {
  return {
    boardSquareCount: BOARD_SQUARES.length,
    players: playerConfigs.map((p, i) => ({
      id: p.id,
      name: p.name,
      isCPU: !!p.isCPU,
      personality: p.personality || null,
      color: TOKEN_COLORS[i % TOKEN_COLORS.length],
      avatar: p.avatar || { color: TOKEN_COLORS[i % TOKEN_COLORS.length], speciesEmoji: null, costumeImage: null },
      position: 0,
      money: START_MONEY,
      job: null,
      finished: false,
      skipNextTurn: false,
      stockShares: 0,
      children: 0,
      housePrice: 0,
      insurance: null,
      finishOrder: null,
      settlement: null,
    })),
    currentTurnIndex: 0,
    turnNumber: 1,
    status: "playing", // playing | finished
    pendingChoice: null, // { playerId, title, prompt, options: [{ label, job?, outcomes: [{weight,delta,resultText}] }] }
    finishCounter: 0,
  };
}

function currentPlayer(state) {
  return state.players[state.currentTurnIndex];
}

function rollDice() {
  return 1 + Math.floor(Math.random() * 10);
}

function randInt(min, max) {
  return min + Math.floor(Math.random() * (max - min + 1));
}

function pickTwoJobOffers() {
  const pool = [...JOB_OFFERS];
  const offers = [];
  for (let i = 0; i < 2 && pool.length > 0; i++) {
    const idx = Math.floor(Math.random() * pool.length);
    offers.push(pool.splice(idx, 1)[0]);
  }
  return offers;
}

// 移動範囲(fromPosの次のマス〜rawToPos)の中に強制停止マス(現状は結婚のみ、
// FORCED_STOP_TYPES参照)があれば、手前側のものを停止位置として返す
// (ロールの目を余らせて止まる)。無ければnull
function findForcedStop(fromPos, rawToPos) {
  for (let i = fromPos + 1; i <= rawToPos; i++) {
    if (FORCED_STOP_TYPES.includes(BOARD_SQUARES[i].type)) return i;
  }
  return null;
}

// 移動範囲(fromPosの次のマス〜toPos)の中に株購入チャンスのマスが含まれるか
// (止まらず通り過ぎただけでも発生する)
function passesStockTrigger(fromPos, toPos) {
  return STOCK_TRIGGER_INDEXES.some((idx) => idx > fromPos && idx <= toPos);
}

// 株購入の選択(pendingChoice)を組み立てる。保有株があれば先に株価変動を適用し、
// その結果(と、直前に止まったマス自体の結果があればそれも)をpromptの先頭に含める
function buildStockChoice(player, baseText, entries) {
  let priceChangeText = "";
  if (player.stockShares > 0) {
    const card = STOCK_VALUE_EVENTS[Math.floor(Math.random() * STOCK_VALUE_EVENTS.length)];
    const delta = card.perShare * player.stockShares;
    player.money += delta;
    priceChangeText = `${card.text}(保有${player.stockShares}株 ${delta >= 0 ? "+" : ""}${delta}万円)\n`;
    entries.push({ type: "money", text: `株価変動: ${card.text}(保有${player.stockShares}株 ${delta >= 0 ? "+" : ""}${delta}万円)`, delta });
  }
  const buyCost = STOCK_BUY_LOT * STOCK_PRICE_PER_SHARE;
  const promptLines = [baseText, priceChangeText, `通りがかりに証券会社を見かけた。株を${STOCK_BUY_LOT}株(-${buyCost}万円)購入する？`].filter(Boolean);
  return {
    playerId: player.id,
    title: "証券会社",
    prompt: promptLines.join("\n"),
    options: [
      {
        label: `${STOCK_BUY_LOT}株購入する(-${buyCost}万円)`,
        stockDelta: STOCK_BUY_LOT,
        outcomes: [{ weight: 1, delta: -buyCost, resultText: `株を${STOCK_BUY_LOT}株購入した(-${buyCost}万円)` }],
      },
      {
        label: "購入しない",
        outcomes: [{ weight: 1, delta: 0, resultText: "今回は見送った" }],
      },
    ],
  };
}

// サイコロの目を適用してマスの効果を解決する
// 戻り値: { entries: [...], pendingChoice: {...}|null, reveal: {...}|null, turnEnded: bool }
function applyRoll(state, roll) {
  if (state.status !== "playing") throw new Error("game already finished");
  const player = currentPlayer(state);

  const fromPos = player.position;
  const rawToPos = Math.min(fromPos + roll, GOAL_INDEX);
  // 結婚は、通り過ぎる場合でも強制的にそこで止まる(子どもが生まれるマスは
  // 「授かりもの」のため強制停止にはしていない。FORCED_STOP_TYPES参照)
  const forcedStop = findForcedStop(fromPos, rawToPos);
  const toPos = forcedStop !== null ? forcedStop : rawToPos;
  player.position = toPos;

  const entries = [
    { type: "move", text: `${player.name} はルーレットで${roll}を出し、${toPos}マス目まで進んだ` },
  ];

  const square = BOARD_SQUARES[toPos];
  const result = resolveSquare(state, player, square, entries, roll);

  if (result.pendingChoice) {
    // 就職・選択マス自体の選択が優先(株の勧誘と選択が重なる作りにはしていないため
    // ここでは株トリガーは無視し、次にトリガーマスを通ったときに改めて提示する)
    state.pendingChoice = result.pendingChoice;
    return { entries, pendingChoice: result.pendingChoice, reveal: null, turnEnded: false };
  }

  if (passesStockTrigger(fromPos, toPos)) {
    const stockChoice = buildStockChoice(player, result.reveal ? result.reveal.text : "", entries);
    state.pendingChoice = stockChoice;
    return { entries, pendingChoice: stockChoice, reveal: null, turnEnded: false };
  }

  finalizeTurn(state, player, entries);
  return { entries, pendingChoice: null, reveal: result.reveal || null, turnEnded: true };
}

// マスの効果を解決する。pendingChoiceを返す場合(job初回・choice・house-market)は選択待ちになり、
// それ以外は必ずreveal({text, delta?})を返す。テロップ枠での結果表示に使う
function resolveSquare(state, player, square, entries, roll) {
  switch (square.type) {
    case "start": {
      const text = `${square.label}。特に何も起きなかった`;
      entries.push({ type: "info", text });
      return { reveal: { text } };
    }
    case "rest": {
      player.skipNextTurn = true;
      const text = "ひと休み: 次の自分の番はお休みです";
      entries.push({ type: "info", text });
      return { reveal: { text } };
    }
    case "payday": {
      const income = player.job ? player.job.salary : UNEMPLOYED_INCOME;
      player.money += income;
      const text = player.job
        ? `給料日！${player.job.name}の給料 +${income}万円`
        : `給料日！アルバイト収入 +${income}万円`;
      entries.push({ type: "money", text, delta: income });
      return { reveal: { text, delta: income } };
    }
    case "event": {
      const card = EVENT_CARDS[square.eventCardIndex];
      player.money += card.delta;
      const text = `できごと: ${card.text}(${card.delta >= 0 ? "+" : ""}${card.delta}万円)`;
      entries.push({ type: "money", text, delta: card.delta });
      return { reveal: { text, delta: card.delta } };
    }
    case "fortune": {
      const card = FORTUNE_CARDS[square.fortuneCardIndex];
      player.money += card.delta;
      const text = `運命の分かれ道: ${card.text}(${card.delta >= 0 ? "+" : ""}${card.delta}万円)`;
      entries.push({ type: "money", text, delta: card.delta });
      return { reveal: { text, delta: card.delta } };
    }
    case "job": {
      if (!player.job) {
        const offers = pickTwoJobOffers();
        entries.push({ type: "info", text: "就職の関門！仕事を選ぼう" });
        return {
          pendingChoice: {
            playerId: player.id,
            title: "就職の関門",
            prompt: "どちらの仕事に就きますか？",
            options: offers.map((o) => ({
              label: `${o.name}(給料${o.salary}万円/回)`,
              job: o,
              outcomes: [{ weight: 1, delta: 0, resultText: `『${o.name}』になった！(給料${o.salary}万円/回)` }],
            })),
          },
        };
      }
      const bonus = randInt(SKILLUP_BONUS_MIN, SKILLUP_BONUS_MAX);
      player.money += bonus;
      const text = `スキルアップ研修を受けて手当 +${bonus}万円`;
      entries.push({ type: "money", text, delta: bonus });
      return { reveal: { text, delta: bonus } };
    }
    case "choice": {
      const ev = CHOICE_EVENTS[square.choiceEventIndex];
      entries.push({ type: "info", text: ev.title });
      return {
        pendingChoice: { playerId: player.id, title: ev.title, prompt: ev.prompt, options: ev.options },
      };
    }
    case "house-market": {
      if (player.housePrice > 0) {
        const text = "すでにマイホームを所有しているため、今回は見送った";
        entries.push({ type: "info", text });
        return { reveal: { text } };
      }
      const ownedPrices = state.players.map((p) => p.housePrice);
      const options = HOUSE_PRICE_TIERS.filter((tier) => !tier.exclusive || !ownedPrices.includes(tier.price)).map((tier) => ({
        label: `${tier.label}(-${tier.price}万円)${tier.exclusive ? "【早い者勝ち】" : ""}`,
        housePrice: tier.price,
        outcomes: [{ weight: 1, delta: -tier.price, resultText: `${tier.label}を購入した！(-${tier.price}万円)` }],
      }));
      options.push({ label: "今回は買わない", outcomes: [{ weight: 1, delta: 0, resultText: "今回は見送った" }] });
      entries.push({ type: "info", text: "マイホーム購入のチャンス！" });
      return {
        pendingChoice: {
          playerId: player.id,
          title: "マイホーム購入",
          prompt: "気になる物件が見つかった。購入する？",
          options,
        },
      };
    }
    case "house-fire": {
      if (player.housePrice <= 0) {
        const text = "近所で火事のニュースを見た。自分は家を持っていないので影響はなかった";
        entries.push({ type: "info", text });
        return { reveal: { text } };
      }
      if (player.insurance === "fire") {
        const payout = Math.round(player.housePrice * FIRE_INSURANCE_PAYOUT_RATE);
        player.housePrice = 0;
        player.money += payout;
        const text = `火事で家を失った…！火災保険のおかげで保険金 +${payout}万円が下りた`;
        entries.push({ type: "money", text, delta: payout });
        return { reveal: { text, delta: payout } };
      }
      player.housePrice = 0;
      const text = "火事で家を失った…！保険に入っていなかったため補償はなかった";
      entries.push({ type: "info", text });
      return { reveal: { text } };
    }
    case "house-swap": {
      const players = state.players;
      const myIndex = players.indexOf(player);
      const offset = (roll % (players.length - 1)) + 1;
      const targetIndex = (myIndex + offset) % players.length;
      const target = players[targetIndex];
      const myHouse = player.housePrice;
      const targetHouse = target.housePrice;
      player.housePrice = targetHouse;
      target.housePrice = myHouse;
      const text = myHouse === 0 && targetHouse === 0
        ? `${target.name}と家の交換イベントが発生したが、お互い家を持っていなかった`
        : `${target.name}と家を交換した！`;
      entries.push({ type: "info", text });
      return { reveal: { text } };
    }
    case "marriage": {
      const others = state.players.filter((p) => p !== player);
      let total = 0;
      others.forEach((op) => {
        op.money -= MARRIAGE_GIFT_PER_PLAYER;
        total += MARRIAGE_GIFT_PER_PLAYER;
        entries.push({
          type: "money",
          text: `${op.name}: ${player.name}へのお祝い金 -${MARRIAGE_GIFT_PER_PLAYER}万円`,
          delta: -MARRIAGE_GIFT_PER_PLAYER,
          playerId: op.id,
        });
      });
      player.money += total;
      const text = `結婚した！みんなからお祝い金をもらった(+${total}万円)`;
      entries.push({ type: "money", text, delta: total, playerId: player.id });
      return { reveal: { text, delta: total } };
    }
    case "childbirth": {
      player.money -= CHILDBIRTH_GIFT_COST;
      player.children = (player.children || 0) + 1;
      const text = `子どもが生まれた！(${player.children}人目) お祝い金として-${CHILDBIRTH_GIFT_COST}万円`;
      entries.push({ type: "money", text, delta: -CHILDBIRTH_GIFT_COST });
      return { reveal: { text, delta: -CHILDBIRTH_GIFT_COST } };
    }
    case "goal": {
      // finishOrderの確定(finished=true化含む)はfinalizeTurnで行うため、ここではまだ
      // state.finishCounterがインクリメントされていない。表示用に「今回ゴールしたら
      // 何着になるか」を同じ計算式で先読みする(値の重複計算だが、状態は変更しない)。
      const order = (state.finishCounter || 0) + 1;
      const medal = order === 1 ? "🥇" : order === 2 ? "🥈" : order === 3 ? "🥉" : "🏁";
      const text = `${medal} ${player.name} は${order}着でゴールに到達した！`;
      entries.push({ type: "info", text });
      return { reveal: { text, finishOrder: order } };
    }
    default:
      return { reveal: null };
  }
}

// outcomesから重み付きランダムで1つ選ぶ(weightの比率で抽選。1件しかなければそれを返す)
function pickWeightedOutcome(outcomes) {
  const total = outcomes.reduce((s, o) => s + o.weight, 0);
  let r = Math.random() * total;
  for (const o of outcomes) {
    if (r < o.weight) return o;
    r -= o.weight;
  }
  return outcomes[outcomes.length - 1];
}

// 選択(pendingChoice)を確定させ、ターンを終了する。就職・一般イベント共通の汎用処理
function resolveChoice(state, playerId, optionIndex) {
  const player = state.players.find((p) => p.id === playerId);
  if (!player || !state.pendingChoice || state.pendingChoice.playerId !== playerId) {
    throw new Error("invalid choice resolution");
  }
  const option = state.pendingChoice.options[optionIndex];
  const outcome = pickWeightedOutcome(option.outcomes);
  if (option.job) player.job = option.job;
  if (option.stockDelta) player.stockShares = (player.stockShares || 0) + option.stockDelta;
  if (option.housePrice) player.housePrice = option.housePrice;
  if (option.insurance) player.insurance = option.insurance;
  if (outcome.delta) player.money += outcome.delta;
  const entries = [{ type: outcome.delta ? "money" : "info", text: outcome.resultText, delta: outcome.delta }];
  const reveal = { text: outcome.resultText, delta: outcome.delta, job: option.job || null };
  state.pendingChoice = null;
  finalizeTurn(state, player, entries);
  return { entries, reveal, pendingChoice: null, turnEnded: true };
}

// 消耗品アイテムの効果(所持金増減)を適用する。ターンは終了させない(ハブ画面に留まる)
function applyItemEffect(state, playerId, delta, itemName) {
  const player = state.players.find((p) => p.id === playerId);
  if (!player) throw new Error("invalid player for item effect");
  player.money += delta;
  return {
    type: "money",
    text: `「${itemName}」を使った(${delta >= 0 ? "+" : ""}${delta}万円)`,
    delta,
  };
}

function finalizeTurn(state, player, entries) {
  if (player.position >= GOAL_INDEX && !player.finished) {
    player.finished = true;
    state.finishCounter = (state.finishCounter || 0) + 1;
    player.finishOrder = state.finishCounter;
  }

  if (state.players.every((p) => p.finished)) {
    state.status = "finished";
    runSettlement(state, entries);
    return;
  }

  advanceTurn(state, entries);
}

// 全員がゴールした後の清算。子ども・株・マイホーム・ゴール到達順それぞれの報酬を
// 一括で所持金に加算する(売却/現金化のような位置づけ。ここでの順位に対する追加報酬は無く、
// 清算後の所持金順がそのままゲームの最終順位になる)
function runSettlement(state, entries) {
  state.players.forEach((player) => {
    let total = 0;
    const breakdown = { child: 0, stock: 0, house: 0, goalOrder: 0, total: 0 };
    if (player.children > 0) {
      const amount = player.children * CHILD_SETTLEMENT_REWARD;
      total += amount;
      breakdown.child = amount;
      entries.push({ type: "money", text: `${player.name}: 子ども${player.children}人分の清算 +${amount}万円`, delta: amount });
    }
    if (player.stockShares > 0) {
      const amount = player.stockShares * STOCK_SETTLEMENT_PER_SHARE;
      total += amount;
      breakdown.stock = amount;
      entries.push({ type: "money", text: `${player.name}: 保有株${player.stockShares}株を清算 +${amount}万円`, delta: amount });
    }
    if (player.housePrice > 0) {
      const amount = Math.round(player.housePrice * HOUSE_SETTLEMENT_MULTIPLIER);
      total += amount;
      breakdown.house = amount;
      entries.push({ type: "money", text: `${player.name}: マイホームを清算 +${amount}万円`, delta: amount });
    }
    const goalReward = GOAL_ORDER_REWARDS[(player.finishOrder || GOAL_ORDER_REWARDS.length) - 1] || 0;
    if (goalReward > 0) {
      total += goalReward;
      breakdown.goalOrder = goalReward;
      entries.push({ type: "money", text: `${player.name}: ゴール${player.finishOrder}着ボーナス +${goalReward}万円`, delta: goalReward });
    }
    breakdown.total = total;
    player.settlement = breakdown;
    player.money += total;
  });
}

// 手番を次のプレイヤーへ進める。skipNextTurnが立っているプレイヤーは
// (「ひと休み」マスで自分自身に付けたフラグ)1回だけ飛ばし、entriesにその旨を記録する。
// ただし、まだ動いていない全員が同時にスキップ状態になった場合(連続して複数人が
// 「ひと休み」マスを踏んだ場合など)にゲームが手詰まりにならないよう、一巡しても
// 誰も打てる相手がいなければ最後の候補は強制的に打たせる
function advanceTurn(state, entries) {
  const total = state.players.length;
  const activeIndexes = [];
  let next = state.currentTurnIndex;
  for (let i = 0; i < total; i++) {
    next = (next + 1) % total;
    if (!state.players[next].finished) activeIndexes.push(next);
  }
  if (activeIndexes.length === 0) {
    state.status = "finished";
    return;
  }
  for (let i = 0; i < activeIndexes.length; i++) {
    const idx = activeIndexes[i];
    const candidate = state.players[idx];
    const isLastCandidate = i === activeIndexes.length - 1;
    if (candidate.skipNextTurn && !isLastCandidate) {
      candidate.skipNextTurn = false;
      if (entries) entries.push({ type: "info", text: `${candidate.name} はお休みのため今回の番はスキップ` });
      continue;
    }
    candidate.skipNextTurn = false;
    state.currentTurnIndex = idx;
    if (idx === 0) state.turnNumber += 1;
    return;
  }
}

// 最終順位: 所持金の多い順(市販の人生ゲームと同じく最終資産で勝敗を決める)
function getRanking(state) {
  return [...state.players].sort((a, b) => b.money - a.money);
}
