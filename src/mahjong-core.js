export const TILE_SPAN = Object.freeze({
  width: 2,
  height: 2
});

export const MONEY_TILE_TYPES = Object.freeze([
  { key: "KRW_1000", label: "천원", reward: 1000, pairCount: 30, group: "cash" },
  { key: "KRW_5000", label: "오천원", reward: 5000, pairCount: 22, group: "cash" },
  { key: "KRW_10000", label: "만원", reward: 10000, pairCount: 16, group: "cash" },
  { key: "KRW_50000", label: "오만원", reward: 50000, pairCount: 4, group: "cash" }
]);

export const LAYOUTS = Object.freeze({
  turtle: Object.freeze({
    id: "turtle",
    name: "Compact Turtle",
    tileSpan: TILE_SPAN,
    layers: Object.freeze([
      Object.freeze({
        z: 0,
        rows: Object.freeze([
          Object.freeze({ y: 0, xStart: 4, count: 12 }),
          Object.freeze({ y: 2, xStart: 8, count: 8 }),
          Object.freeze({ y: 4, xStart: 6, count: 10 }),
          Object.freeze({ y: 6, xStart: 4, count: 12 }),
          Object.freeze({ y: 7, cells: Object.freeze([2, 28, 30]) }),
          Object.freeze({ y: 8, xStart: 4, count: 12 }),
          Object.freeze({ y: 10, xStart: 6, count: 10 }),
          Object.freeze({ y: 12, xStart: 8, count: 8 }),
          Object.freeze({ y: 14, xStart: 4, count: 12 })
        ])
      }),
      Object.freeze({
        z: 1,
        rows: Object.freeze([
          Object.freeze({ y: 2, xStart: 10, count: 6 }),
          Object.freeze({ y: 4, xStart: 10, count: 6 }),
          Object.freeze({ y: 6, xStart: 10, count: 6 }),
          Object.freeze({ y: 8, xStart: 10, count: 6 }),
          Object.freeze({ y: 10, xStart: 10, count: 6 }),
          Object.freeze({ y: 12, xStart: 10, count: 6 })
        ])
      }),
      Object.freeze({
        z: 2,
        rows: Object.freeze([
          Object.freeze({ y: 4, xStart: 12, count: 4 }),
          Object.freeze({ y: 6, xStart: 12, count: 4 }),
          Object.freeze({ y: 8, xStart: 12, count: 4 }),
          Object.freeze({ y: 10, xStart: 12, count: 4 })
        ])
      }),
      Object.freeze({
        z: 3,
        rows: Object.freeze([
          Object.freeze({ y: 6, xStart: 14, count: 2 }),
          Object.freeze({ y: 8, xStart: 14, count: 2 })
        ])
      }),
      Object.freeze({
        z: 4,
        rows: Object.freeze([
          Object.freeze({ y: 7, cells: Object.freeze([15]) })
        ])
      })
    ])
  })
});

export function createSeededRng(seed = Date.now()) {
  let state = typeof seed === "number" ? seed >>> 0 : hashString(String(seed));

  return function rng() {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

export function getLayoutCoordinates(layoutName = "turtle") {
  const layout = getLayout(layoutName);

  return layout.layers.flatMap((layer) => {
    return layer.rows.flatMap((row) => {
      const cells = row.cells ?? createSteppedCells(row.xStart, row.count, row.step ?? TILE_SPAN.width);
      return cells.map((x) => ({ x, y: row.y, z: layer.z }));
    });
  });
}

export function createMoneyMahjongBoard(options = {}) {
  const {
    layoutName = "turtle",
    seed = Date.now(),
    tileTypes = MONEY_TILE_TYPES
  } = options;

  const layout = getLayout(layoutName);
  const coordinates = getLayoutCoordinates(layoutName);
  const validation = validateCoordinates(coordinates, layout.tileSpan);

  if (!validation.valid) {
    throw new Error(`Invalid layout "${layoutName}": ${validation.errors.join("; ")}`);
  }

  const rng = createSeededRng(seed);
  const deck = createPairedDeck(tileTypes, coordinates.length, rng);

  const tiles = coordinates.map((coordinate, index) => {
    const face = deck[index];

    return {
      id: `${layout.id}-${index}`,
      x: coordinate.x,
      y: coordinate.y,
      z: coordinate.z,
      faceKey: face.key,
      label: face.label,
      reward: face.reward,
      group: face.group,
      removed: false,
      matchedAt: null
    };
  });

  return {
    layoutId: layout.id,
    layoutName: layout.name,
    tileSpan: layout.tileSpan,
    tiles,
    rewardTotal: 0,
    moveCount: 0,
    seed
  };
}

export function validateCoordinates(coordinates, tileSpan = TILE_SPAN) {
  const errors = [];

  if (coordinates.length === 0) {
    errors.push("layout must contain at least one tile");
  }

  if (coordinates.length % 2 !== 0) {
    errors.push(`layout tile count must be even, received ${coordinates.length}`);
  }

  const duplicateKeys = new Set();
  const seenKeys = new Set();

  for (const coordinate of coordinates) {
    const key = `${coordinate.x}:${coordinate.y}:${coordinate.z}`;
    if (seenKeys.has(key)) duplicateKeys.add(key);
    seenKeys.add(key);
  }

  if (duplicateKeys.size > 0) {
    errors.push(`duplicate coordinates found: ${Array.from(duplicateKeys).join(", ")}`);
  }

  for (let a = 0; a < coordinates.length; a += 1) {
    for (let b = a + 1; b < coordinates.length; b += 1) {
      const first = coordinates[a];
      const second = coordinates[b];
      if (first.z === second.z && rectanglesOverlap(getBounds(first, tileSpan), getBounds(second, tileSpan))) {
        errors.push(`same-layer overlap at indexes ${a} and ${b}`);
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

export function buildOccupancyGrid(tiles, tileSpan = TILE_SPAN) {
  const cells = new Map();

  for (const tile of activeTiles(tiles)) {
    for (let dx = 0; dx < tileSpan.width; dx += 1) {
      for (let dy = 0; dy < tileSpan.height; dy += 1) {
        const key = cellKey(tile.x + dx, tile.y + dy, tile.z);
        if (!cells.has(key)) cells.set(key, []);
        cells.get(key).push(tile.id);
      }
    }
  }

  return {
    cells,
    getCell(x, y, z) {
      return cells.get(cellKey(x, y, z)) ?? [];
    },
    hasCell(x, y, z) {
      return cells.has(cellKey(x, y, z));
    }
  };
}

export function isTileSelectable(tileOrId, tiles, tileSpan = TILE_SPAN) {
  const tile = resolveTile(tileOrId, tiles);
  if (!tile || tile.removed) return false;

  const topIsClear = getBlockingTilesAbove(tile, tiles, tileSpan).length === 0;
  if (!topIsClear) return false;

  const sideState = getSideState(tile, tiles, tileSpan);
  return sideState.leftFree || sideState.rightFree;
}

export function getBlockingTilesAbove(tileOrId, tiles, tileSpan = TILE_SPAN) {
  const tile = resolveTile(tileOrId, tiles);
  if (!tile || tile.removed) return [];

  const bounds = getBounds(tile, tileSpan);

  return activeTiles(tiles).filter((other) => {
    if (other.id === tile.id || other.z <= tile.z) return false;
    return rectanglesOverlap(bounds, getBounds(other, tileSpan));
  });
}

export function getSideState(tileOrId, tiles, tileSpan = TILE_SPAN) {
  const tile = resolveTile(tileOrId, tiles);
  if (!tile || tile.removed) {
    return { leftFree: false, rightFree: false, leftBlockers: [], rightBlockers: [] };
  }

  const bounds = getBounds(tile, tileSpan);
  const leftBlockers = [];
  const rightBlockers = [];

  for (const other of activeTiles(tiles)) {
    if (other.id === tile.id || other.z !== tile.z) continue;

    const otherBounds = getBounds(other, tileSpan);
    const overlapsVertically = rangesOverlap(bounds.top, bounds.bottom, otherBounds.top, otherBounds.bottom);
    if (!overlapsVertically) continue;

    if (otherBounds.right === bounds.left) {
      leftBlockers.push(other);
    }

    if (otherBounds.left === bounds.right) {
      rightBlockers.push(other);
    }
  }

  return {
    leftFree: leftBlockers.length === 0,
    rightFree: rightBlockers.length === 0,
    leftBlockers,
    rightBlockers
  };
}

export function getSelectableTiles(tiles, tileSpan = TILE_SPAN) {
  return activeTiles(tiles).filter((tile) => isTileSelectable(tile, tiles, tileSpan));
}

export function canMatch(tileAOrId, tileBOrId, tiles, tileSpan = TILE_SPAN) {
  const tileA = resolveTile(tileAOrId, tiles);
  const tileB = resolveTile(tileBOrId, tiles);

  if (!tileA || !tileB || tileA.id === tileB.id) return false;
  if (tileA.removed || tileB.removed) return false;
  if (tileA.faceKey !== tileB.faceKey) return false;

  return isTileSelectable(tileA, tiles, tileSpan) && isTileSelectable(tileB, tiles, tileSpan);
}

export function getAvailableMatches(tiles, tileSpan = TILE_SPAN) {
  const selectableByFace = new Map();

  for (const tile of getSelectableTiles(tiles, tileSpan)) {
    if (!selectableByFace.has(tile.faceKey)) selectableByFace.set(tile.faceKey, []);
    selectableByFace.get(tile.faceKey).push(tile);
  }

  const matches = [];

  for (const sameFaceTiles of selectableByFace.values()) {
    for (let a = 0; a < sameFaceTiles.length; a += 1) {
      for (let b = a + 1; b < sameFaceTiles.length; b += 1) {
        matches.push([sameFaceTiles[a], sameFaceTiles[b]]);
      }
    }
  }

  return matches;
}

export function hasAvailableMove(tiles, tileSpan = TILE_SPAN) {
  return getAvailableMatches(tiles, tileSpan).length > 0;
}

export function removeMatchingPair(board, firstTileId, secondTileId, matchedAt = Date.now()) {
  if (!canMatch(firstTileId, secondTileId, board.tiles, board.tileSpan)) {
    return {
      board,
      matched: false,
      rewardGained: 0,
      reason: "tiles are not a selectable matching pair"
    };
  }

  const first = resolveTile(firstTileId, board.tiles);
  const second = resolveTile(secondTileId, board.tiles);
  const rewardGained = first.reward;

  const tiles = board.tiles.map((tile) => {
    if (tile.id !== first.id && tile.id !== second.id) return tile;
    return {
      ...tile,
      removed: true,
      matchedAt
    };
  });

  return {
    board: {
      ...board,
      tiles,
      rewardTotal: board.rewardTotal + rewardGained,
      moveCount: board.moveCount + 1
    },
    matched: true,
    rewardGained,
    reason: null
  };
}

export function isBoardCleared(tiles) {
  return activeTiles(tiles).length === 0;
}

export function getBounds(tile, tileSpan = TILE_SPAN) {
  return {
    left: tile.x,
    right: tile.x + tileSpan.width,
    top: tile.y,
    bottom: tile.y + tileSpan.height
  };
}

export function rectanglesOverlap(first, second) {
  return first.left < second.right
    && first.right > second.left
    && first.top < second.bottom
    && first.bottom > second.top;
}

function getLayout(layoutName) {
  const layout = LAYOUTS[layoutName];
  if (!layout) {
    throw new Error(`Unknown layout "${layoutName}"`);
  }
  return layout;
}

function createPairedDeck(tileTypes, tileCount, rng) {
  if (tileCount % 2 !== 0) {
    throw new Error(`Cannot create paired deck for odd tile count: ${tileCount}`);
  }

  if (!Array.isArray(tileTypes) || tileTypes.length === 0) {
    throw new Error("tileTypes must contain at least one tile type");
  }

  const deck = [];
  const pairCount = tileCount / 2;
  const configuredPairCount = tileTypes.reduce((sum, tileType) => sum + (tileType.pairCount ?? 0), 0);

  if (configuredPairCount === pairCount) {
    for (const face of tileTypes) {
      for (let index = 0; index < face.pairCount; index += 1) {
        deck.push(face, face);
      }
    }
  } else {
    for (let pairIndex = 0; pairIndex < pairCount; pairIndex += 1) {
      const face = tileTypes[pairIndex % tileTypes.length];
      deck.push(face, face);
    }
  }

  return shuffle(deck, rng);
}

function shuffle(items, rng) {
  const copy = [...items];

  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(rng() * (index + 1));
    [copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]];
  }

  return copy;
}

function createSteppedCells(xStart, count, step) {
  return Array.from({ length: count }, (_, index) => xStart + index * step);
}

function activeTiles(tiles) {
  return tiles.filter((tile) => !tile.removed);
}

function resolveTile(tileOrId, tiles) {
  if (!tileOrId) return null;
  if (typeof tileOrId === "object") return tileOrId;
  return tiles.find((tile) => tile.id === tileOrId) ?? null;
}

function rangesOverlap(firstStart, firstEnd, secondStart, secondEnd) {
  return firstStart < secondEnd && firstEnd > secondStart;
}

function cellKey(x, y, z) {
  return `${x}:${y}:${z}`;
}

function hashString(value) {
  let hash = 2166136261;

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return hash >>> 0;
}
