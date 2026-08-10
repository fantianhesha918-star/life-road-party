# 音声素材のライセンス

このフォルダ(`docs/audio/`)内の音声ファイルは、すべて [Kenney.nl](https://kenney.nl) が配布する **CC0(Creative Commons Zero / パブリックドメイン)** 素材から選定・リネームしたものです。

- ライセンス全文: https://creativecommons.org/publicdomain/zero/1.0/
- 商用・個人問わず自由に使用可能、クレジット表記も法的には不要(Kenneyへの敬意として記載)
- 出典パック: Interface Sounds / Casino Audio / Music Jingles(いずれも kenney.nl/assets 配下)

## ファイル対応表

| このプロジェクトでのファイル名 | 元ファイル | 用途の想定 |
|---|---|---|
| se/click.ogg | interface-sounds: click_001.ogg | ボタンクリック |
| se/confirm.ogg | interface-sounds: confirmation_001.ogg | 決定・購入確定 |
| se/error.ogg | interface-sounds: error_001.ogg | エラー・所持金不足など |
| se/modal-open.ogg | interface-sounds: open_001.ogg | モーダル/選択画面が開く |
| se/modal-close.ogg | interface-sounds: close_001.ogg | モーダルを閉じる |
| se/select.ogg | interface-sounds: select_001.ogg | 選択肢のハイライト・選択 |
| se/notify.ogg | interface-sounds: bong_001.ogg | 通知・お知らせ |
| se/dice-roll.ogg | casino-audio: dice-throw-2.ogg | ルーレット/サイコロを振る |
| se/dice-shake.ogg | casino-audio: dice-shake-2.ogg | サイコロを振る前の予備動作 |
| se/money-gain.ogg | casino-audio: chips-stack-2.ogg | 所持金が増える(株値上がり等) |
| se/money-spend.ogg | casino-audio: chip-lay-2.ogg | 所持金が減る・購入 |
| bgm/jingle-title.ogg | music-jingles: 8-Bit jingles/jingles_NES03.ogg | タイトル画面用の候補 |
| bgm/jingle-goal.ogg | music-jingles: Steel jingles/jingles_STEEL00.ogg | ゴール・清算画面用の候補 |

**注意**: 選定はファイル名・カテゴリのみで行っており、クロコ(Claude Code)は音声を実際に聴くことができない。実際に使う前に、必ずユーザー(または進行用チャット統合時)が試聴し、印象に合わなければ元パック(`interface-sounds`/`casino-audio`/`music-jingles`、各50〜100枚)から他の候補に差し替えてほしい。

元パックの全ファイルは `クロコ確認フォルダ` には未配置(容量が大きいため)。追加候補が欲しい場合はKenney.nlの以下URLから再取得できる:
- https://kenney.nl/assets/interface-sounds
- https://kenney.nl/assets/casino-audio
- https://kenney.nl/assets/music-jingles
