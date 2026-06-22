import {
  buildOccupancyGrid,
  createMoneyMahjongBoard,
  getAvailableMatches,
  getLayoutCoordinates,
  getSelectableTiles,
  hasAvailableMove,
  validateCoordinates
} from "./mahjong-core.js";

const board = createMoneyMahjongBoard({
  layoutName: "turtle",
  seed: "mom-birthday-phase-1"
});

const coordinates = getLayoutCoordinates("turtle");
const validation = validateCoordinates(coordinates);
const selectableTiles = getSelectableTiles(board.tiles);
const availableMatches = getAvailableMatches(board.tiles);
const grid = buildOccupancyGrid(board.tiles);

const summary = {
  phase: "Phase 1 core data and map generation",
  layoutId: board.layoutId,
  layoutName: board.layoutName,
  seed: board.seed,
  tileCount: board.tiles.length,
  coordinateValidation: validation,
  occupiedGridCellCount: grid.cells.size,
  selectableTileCount: selectableTiles.length,
  hasAvailableMove: hasAvailableMove(board.tiles),
  availableMatchCount: availableMatches.length,
  firstFiveTiles: board.tiles.slice(0, 5).map((tile) => ({
    id: tile.id,
    faceKey: tile.faceKey,
    reward: tile.reward,
    x: tile.x,
    y: tile.y,
    z: tile.z
  }))
};

window.__moneyMahjongLoaded = true;

const output = document.querySelector("#phase1-output");
output.classList.remove("hint");
output.textContent = JSON.stringify(summary, null, 2);
