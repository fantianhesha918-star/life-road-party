// ライフロード ゲームロジックコア(一人モード・通信モード共通で使う想定)
// 純粋なゲームルールのみを扱い、画面描画やFirebase通信には関与しない

const GOAL_INDEX = BOARD_SQUARES.length - 1;

function createInitialState(playerConfigs) {
  return {
    players: playerConfigs.map((p, i) => ({
      id: p.id,
      name: p.name,
      isCPU: !!p.isCPU,
      personality: p.personality || null,
      color: TOKEN_COLORS[i % TOKEN_COLORS.length],
      avatar: p.avatar || { color: TOKEN_COLORS[i % TOKEN_COLORS.length], speciesEmoji: null, hatEmoji: null, accessoryEmoji: null },
      position: 0,
      money: START_MONEY,
      job: null,
      finished: false,
    })),
    currentTurnIndex: 0,
    turnNumber: 1,
    status: "playing", // playing | finished
    pendingChoice: null, // { playerId, title, prompt, options: [{ label, job?, outcomes: [{weight,delta,resultText}] }] }
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

function pickEventCard() {
  return EVENT_CARDS[Math.floor(Math.random() * EVENT_CARDS.length)];
}

// サイコロの目を適用してマスの効果を解決する
// 戻り値: { entries: [...], pendingChoice: {...}|null, turnEnded: bool }
function applyRoll(state, roll) {
  if (state.status !== "playing") throw new Error("game already finished");
  const player = currentPlayer(state);

  const fromPos = player.position;
  const toPos = Math.min(fromPos + roll, GOAL_INDEX);
  player.position = toPos;

  const entries = [
    { type: "move", text: `${player.name} はルーレットで${roll}を出し、${toPos}マス目まで進んだ` },
  ];

  const square = BOARD_SQUARES[toPos];
  const result = resolveSquare(player, square, entries);

  if (result.pendingChoice) {
    state.pendingChoice = result.pendingChoice;
    return { entries, pendingChoice: result.pendingChoice, turnEnded: false };
  }

  finalizeTurn(state, player, entries);
  return { entries, pendingChoice: null, turnEnded: true };
}

function resolveSquare(player, square, entries) {
  switch (square.type) {
    case "start":
    case "rest":
      entries.push({ type: "info", text: `${square.label}。特に何も起きなかった` });
      return {};
    case "payday": {
      const income = player.job ? player.job.salary : UNEMPLOYED_INCOME;
      player.money += income;
      entries.push({
        type: "money",
        text: player.job
          ? `給料日！${player.job.name}の給料 +${income}万円`
          : `給料日！アルバイト収入 +${income}万円`,
        delta: income,
      });
      return {};
    }
    case "event": {
      const card = pickEventCard();
      player.money += card.delta;
      entries.push({
        type: "money",
        text: `できごと: ${card.text}(${card.delta >= 0 ? "+" : ""}${card.delta}万円)`,
        delta: card.delta,
      });
      return {};
    }
    case "fortune": {
      const delta = randInt(FORTUNE_MIN, FORTUNE_MAX);
      player.money += delta;
      entries.push({
        type: "money",
        text: `運命の分かれ道: ${delta >= 0 ? "臨時収入があった" : "急な出費があった"}(${delta >= 0 ? "+" : ""}${delta}万円)`,
        delta,
      });
      return {};
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
      entries.push({
        type: "money",
        text: `スキルアップ研修を受けて手当 +${bonus}万円`,
        delta: bonus,
      });
      return {};
    }
    case "choice": {
      const ev = CHOICE_EVENTS[Math.floor(Math.random() * CHOICE_EVENTS.length)];
      entries.push({ type: "info", text: ev.title });
      return {
        pendingChoice: { playerId: player.id, title: ev.title, prompt: ev.prompt, options: ev.options },
      };
    }
    case "goal":
      entries.push({ type: "info", text: `${player.name} はゴールに到達した！` });
      return {};
    default:
      return {};
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
  if (player.position >= GOAL_INDEX) {
    player.finished = true;
  }

  if (state.players.every((p) => p.finished)) {
    state.status = "finished";
    return;
  }

  advanceTurn(state);
}

function advanceTurn(state) {
  const total = state.players.length;
  let next = state.currentTurnIndex;
  for (let i = 0; i < total; i++) {
    next = (next + 1) % total;
    if (!state.players[next].finished) {
      state.currentTurnIndex = next;
      if (next === 0) state.turnNumber += 1;
      return;
    }
  }
  state.status = "finished";
}

// 最終順位: 所持金の多い順(市販の人生ゲームと同じく最終資産で勝敗を決める)
function getRanking(state) {
  return [...state.players].sort((a, b) => b.money - a.money);
}
