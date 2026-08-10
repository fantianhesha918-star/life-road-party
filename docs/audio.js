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
  return { seOn: true, bgmOn: true, seVolume: 0.8, bgmVolume: 0.6 };
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

window.LifeRoadAudio = {
  loadAudioSettings,
  saveAudioSettings,
  playSe,
  playBgmJingle,
  SE_FILES,
  BGM_FILES,
};
