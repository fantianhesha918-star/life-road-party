// ライフロード 効果音・BGM再生(設定のON/OFF・音量をlocalStorageに保存)

const AUDIO_SETTINGS_KEY = "liferoad_audio_settings_v1";

const SE_FILES = {
  click: "audio/se/click.ogg",
  confirm: "audio/se/confirm.ogg",
  error: "audio/se/error.ogg",
  modalOpen: "audio/se/modal-open.ogg",
  modalClose: "audio/se/modal-close.ogg",
  select: "audio/se/select.ogg",
  notify: "audio/se/notify.ogg",
  diceRoll: "audio/se/dice-roll.ogg",
  diceShake: "audio/se/dice-shake.ogg",
  moneyGain: "audio/se/money-gain.ogg",
  moneySpend: "audio/se/money-spend.ogg",
};

const BGM_FILES = {
  title: "audio/bgm/jingle-title.ogg",
  goal: "audio/bgm/jingle-goal.ogg",
};

function defaultAudioSettings() {
  return { seOn: true, bgmOn: true, seVolume: 0.8, bgmVolume: 0.6, vibrationOn: true };
}

function loadAudioSettings() {
  try {
    const raw = localStorage.getItem(AUDIO_SETTINGS_KEY);
    if (!raw) return defaultAudioSettings();
    const parsed = JSON.parse(raw);
    const d = defaultAudioSettings();
    return {
      seOn: typeof parsed.seOn === "boolean" ? parsed.seOn : d.seOn,
      bgmOn: typeof parsed.bgmOn === "boolean" ? parsed.bgmOn : d.bgmOn,
      seVolume: typeof parsed.seVolume === "number" ? parsed.seVolume : d.seVolume,
      bgmVolume: typeof parsed.bgmVolume === "number" ? parsed.bgmVolume : d.bgmVolume,
      vibrationOn: typeof parsed.vibrationOn === "boolean" ? parsed.vibrationOn : d.vibrationOn,
    };
  } catch (e) {
    return defaultAudioSettings();
  }
}

function saveAudioSettings(settings) {
  try {
    localStorage.setItem(AUDIO_SETTINGS_KEY, JSON.stringify(settings));
  } catch (e) {
    // 保存できなくても致命的ではないので無視
  }
}

// ブラウザの自動再生制限で再生が拒否されることがあるが、SE/BGMは補助演出のため
// 失敗しても無視する(.catch)。毎回new Audio()するのは同じ音を連続で鳴らしても
// 重ならず再生できるようにするため。
function playSe(name) {
  const settings = loadAudioSettings();
  if (!settings.seOn) return;
  const src = SE_FILES[name];
  if (!src) return;
  try {
    const audio = new Audio(src);
    audio.volume = settings.seVolume;
    audio.play().catch(() => {});
  } catch (e) {
    // 無視
  }
}

function playBgmJingle(name) {
  const settings = loadAudioSettings();
  if (!settings.bgmOn) return;
  const src = BGM_FILES[name];
  if (!src) return;
  try {
    const audio = new Audio(src);
    audio.volume = settings.bgmVolume;
    audio.play().catch(() => {});
  } catch (e) {
    // 無視
  }
}

// 音源ファイルが未納の効果音向けに、Web Audio APIで短い仮音(単純な正弦波)を鳴らす。
// おやつ集めモードの追加演出(仕様書14章・効果音仕様)向けの汎用プリミティブとして用意した。
// AudioContextはユーザー操作前に作ると警告が出るため呼び出し時に遅延生成し、以後使い回す。
let sharedToneAudioCtx = null;
function getToneAudioCtx() {
  if (sharedToneAudioCtx) return sharedToneAudioCtx;
  const Ctx = window.AudioContext || window.webkitAudioContext;
  if (!Ctx) return null;
  try {
    sharedToneAudioCtx = new Ctx();
  } catch (e) {
    sharedToneAudioCtx = null;
  }
  return sharedToneAudioCtx;
}

function playTone(freq, durationMs) {
  const settings = loadAudioSettings();
  if (!settings.seOn) return;
  const ctx = getToneAudioCtx();
  if (!ctx) return;
  try {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = freq;
    const peak = settings.seVolume * 0.3;
    const now = ctx.currentTime;
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(peak, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + durationMs / 1000);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + durationMs / 1000 + 0.02);
  } catch (e) {
    // 無視(補助演出のため失敗しても進行に影響させない)
  }
}

// Vibration API非対応端末では navigator.vibrate 自体が存在しないため、その場合は何もしない
// (仕様書「非対応端末でもエラーにしない」)。振動オフ設定も尊重する。
function vibrate(pattern) {
  const settings = loadAudioSettings();
  if (!settings.vibrationOn) return;
  if (!navigator.vibrate) return;
  try {
    navigator.vibrate(pattern);
  } catch (e) {
    // 無視
  }
}

window.LifeRoadAudio = {
  loadAudioSettings,
  saveAudioSettings,
  playSe,
  playBgmJingle,
  playTone,
  vibrate,
  SE_FILES,
  BGM_FILES,
};
