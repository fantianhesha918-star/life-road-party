// 「おやつ集めモード」ステージ2「シーサイド・アドベンチャー」の基礎データ(2026-08-15、着手開始)。
//
// Codexが2026-08-11に作成した設計書(クロコとcodex受け渡し/素材受け渡し/02_Codex作成素材/
// アニマルライフ_おやつ集めモード_マップ全体イメージ2種_2026-08-11/ClaudeCode向け_マップ制作引き継ぎ.md、
// 7章)に基づく。設計書は西28+東28+中央橋4〜6ノード・建物配置・ワープ・橋の通行止め+罠・
// ステージ選択画面まで含む本格的な別プロジェクト規模だったため、利用者と相談の上、今回は
// 設計書「制作順」1〜2(ノードIDと接続だけを作り、到達可能性を検証する)のみに着手範囲を絞った。
//
// **このファイルはまだゲーム本編に一切組み込まれていない**(index.htmlに<script>追加していない、
// snack-engine.js/snack-board3d.js/ui.jsのどこからも参照されない、独立した準備データ)。
// 次回以降、建物配置・道路曲線・カメラ・ワープ/罠/通行止めの実装・ステージ選択UI・セーブデータへの
// ステージID追加を行う際に、このファイルを土台として拡張していく想定。
//
// ノード形状はステージ1(snack-data.js の buildSnackStageNodes)と同じ形に揃えてある
// (id, position:{x,z}, zone, nodeType, nextNodeIds, tollCost, snackSpawnCandidate, trap, gaburion)。

const SEASIDE_LOOP_COUNT = 28;
const SEASIDE_WEST_CENTER = { x: -22, z: 0 };
const SEASIDE_EAST_CENTER = { x: 22, z: 0 };
const SEASIDE_LOOP_RX = 15;
const SEASIDE_LOOP_RZ = 12;

// 橋は西ループの東向き最先端(sea-west-07、θ=0)から東ループの西向き最先端(sea-east-21、θ=π)へ
// 一方向のみ(往路)。双方向化・迂回路(設計書「橋が通行止めでも外周迂回できる」)は、ワープ/罠/
// 通行止め機能を実装する次回フェーズで追加する(到達可能性の検証には一方向で十分なため)。
const SEASIDE_BRIDGE_WEST_EXIT_INDEX = 7; // θ=0(西ループの東端)
const SEASIDE_BRIDGE_EAST_ENTRY_INDEX = 21; // θ=π(東ループの西端)

function buildSeasideLoopNodes(prefix, center, zoneName) {
  const nodes = [];
  for (let i = 0; i < SEASIDE_LOOP_COUNT; i++) {
    const theta = -Math.PI / 2 + (i / SEASIDE_LOOP_COUNT) * Math.PI * 2;
    nodes.push({
      id: `${prefix}-${String(i).padStart(2, "0")}`,
      position: {
        x: center.x + Math.cos(theta) * SEASIDE_LOOP_RX,
        z: center.z + Math.sin(theta) * SEASIDE_LOOP_RZ,
      },
      zone: zoneName,
      nodeType: i === 0 && prefix === "sea-west" ? "start" : "normal",
      nextNodeIds: [`${prefix}-${String((i + 1) % SEASIDE_LOOP_COUNT).padStart(2, "0")}`],
      tollCost: 0,
      snackSpawnCandidate: false,
      trap: false,
      gaburion: false,
    });
  }
  return nodes;
}

function buildSeasideStageNodes() {
  const westNodes = buildSeasideLoopNodes("sea-west", SEASIDE_WEST_CENTER, "west-loop");
  const eastNodes = buildSeasideLoopNodes("sea-east", SEASIDE_EAST_CENTER, "east-loop");

  const exitId = `sea-west-${String(SEASIDE_BRIDGE_WEST_EXIT_INDEX).padStart(2, "0")}`;
  const entryId = `sea-east-${String(SEASIDE_BRIDGE_EAST_ENTRY_INDEX).padStart(2, "0")}`;
  const exitNode = westNodes.find((n) => n.id === exitId);
  const entryNode = eastNodes.find((n) => n.id === entryId);

  // 橋ノード3個は、出口/入口の中間に等間隔で配置(西-7〜東+7、z=0の直線上)。
  const bridgeNodes = [
    { id: "sea-bridge-west", t: 1 / 4 },
    { id: "sea-hub", t: 2 / 4 },
    { id: "sea-bridge-east", t: 3 / 4 },
  ].map(({ id, t }) => ({
    id,
    position: {
      x: exitNode.position.x + (entryNode.position.x - exitNode.position.x) * t,
      z: exitNode.position.z + (entryNode.position.z - exitNode.position.z) * t,
    },
    zone: "bridge",
    nodeType: "branch",
    nextNodeIds: [],
    tollCost: 0,
    snackSpawnCandidate: false,
    trap: false,
    gaburion: false,
  }));
  bridgeNodes[0].nextNodeIds = [bridgeNodes[1].id];
  bridgeNodes[1].nextNodeIds = [bridgeNodes[2].id];
  bridgeNodes[2].nextNodeIds = [entryId];

  // 西ループの出口ノードを分岐点にする(通常の周回続行 + 橋への入口の2方向)。
  exitNode.nodeType = "branch";
  exitNode.nextNodeIds.push("sea-bridge-west");

  return [...westNodes, ...eastNodes, ...bridgeNodes];
}

const SEASIDE_STAGE_NODES = buildSeasideStageNodes();
const SEASIDE_START_NODE_ID = "sea-west-00";
