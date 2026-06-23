(function () {
  "use strict";

  const TILE_SPAN = Object.freeze({ width: 2, height: 2 });
  const TILE_WIDTH = 41;
  const TILE_HEIGHT = 72;
  const TILE_SIDE_DEPTH = 7;
  const BOARD_PADDING_X = 44;
  const BOARD_PADDING_Y = 28;
  const GRID_X = TILE_WIDTH / TILE_SPAN.width;
  const GRID_Y = TILE_HEIGHT / TILE_SPAN.height;
  const LAYER_SHIFT_X = -2;
  const LAYER_SHIFT_Y = -7;

  const MONEY_TILE_TYPES = Object.freeze([
    { key: "KRW_1000", label: "천원", sub: "KRW", reward: 1000, pairCount: 30, group: "cash", image: "assets/tiles/krw-1000.png" },
    { key: "KRW_5000", label: "오천원", sub: "KRW", reward: 5000, pairCount: 22, group: "cash", image: "assets/tiles/krw-5000.png" },
    { key: "KRW_10000", label: "만원", sub: "KRW", reward: 10000, pairCount: 16, group: "cash", image: "assets/tiles/krw-10000.png" },
    { key: "KRW_50000", label: "오만원", sub: "KRW", reward: 50000, pairCount: 4, group: "cash", image: "assets/tiles/krw-50000.png" }
  ]);

  const TURTLE_LAYOUT = Object.freeze({
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
  });

  const boardElement = document.querySelector("#board");
  const boardShellElement = document.querySelector(".board-shell");
  const rewardElement = document.querySelector("#reward-total");
  const countElement = document.querySelector("#tile-count");
  const timeElement = document.querySelector("#time-left");
  const timerStatElement = document.querySelector(".timer-stat");
  const toastElement = document.querySelector("#toast");
  const timeNoticeElement = document.querySelector("#time-notice");
  const clearPanel = document.querySelector("#clear-panel");
  const clearMessage = document.querySelector("#clear-message");
  const resultTitle = document.querySelector("#result-title");
  const resultLabel = document.querySelector("#result-label");

  let board = null;
  let selectedTileId = null;
  let hintTileIds = new Set();
  let toastTimer = 0;
  let timeNoticeTimer = 0;
  let suppressSyntheticClickUntil = 0;
  let seedCount = 1;
  let clearCelebrated = false;
  let timeLeft = 120;
  let extraMinuteCount = 0;
  let timerId = null;
  let gameEnded = false;

  document.querySelector("#hint-button").addEventListener("click", showHint);
  document.querySelector("#shuffle-button").addEventListener("click", shuffleRemainingFaces);
  document.querySelector("#restart-button").addEventListener("click", startNewGame);
  document.querySelector("#clear-restart-button").addEventListener("click", startNewGame);
  document.addEventListener("dragstart", preventPageDrag);
  document.addEventListener("selectstart", preventPageDrag);
  boardElement.addEventListener("touchmove", preventPageDrag, { passive: false });
  window.addEventListener("keydown", handleDebugKeys);
  window.addEventListener("resize", () => {
    if (board) setBoardDimensions(board.visualMetrics);
  });

  startNewGame();

  function startNewGame() {
    board = createMoneyMahjongBoard(`mom-birthday-${seedCount}`);
    seedCount += 1;
    selectedTileId = null;
    hintTileIds = new Set();
    clearCelebrated = false;
    gameEnded = false;
    timeLeft = 120;
    extraMinuteCount = 0;
    stopTimer();
    updateTimerDisplay();
    hideTimeNotice();
    clearPanel.classList.remove("is-visible");
    clearPanel.setAttribute("aria-hidden", "true");
    renderBoard();
    startTimer();
  }

  function renderBoard() {
    const selectableIds = new Set(getSelectableTiles(board.tiles, board.tileSpan).map((tile) => tile.id));
    const activeCount = activeTiles(board.tiles).length;

    boardElement.innerHTML = "";
    rewardElement.textContent = formatWon(board.rewardTotal);
    countElement.textContent = String(activeCount);
    updateTimerDisplay();
    setBoardDimensions(board.visualMetrics);

    for (const tile of board.tiles) {
      if (tile.removed) continue;

      const button = document.createElement("button");
      const selectable = selectableIds.has(tile.id);
      const position = getTilePosition(tile);

      button.type = "button";
      button.className = [
        "tile",
        `face-${tile.faceKey.toLowerCase().replaceAll("_", "-")}`,
        selectable ? "is-selectable" : "is-blocked",
        selectedTileId === tile.id ? "is-selected" : "",
        hintTileIds.has(tile.id) ? "is-hint" : ""
      ].filter(Boolean).join(" ");
      button.style.left = `${position.left}px`;
      button.style.top = `${position.top}px`;
      button.style.zIndex = String(position.zIndex);
      button.style.setProperty("--shadow-x", `${2 + tile.z}px`);
      button.style.setProperty("--shadow-y", `${6 + (tile.z * 2)}px`);
      button.style.setProperty("--shadow-blur", `${6 + (tile.z * 2)}px`);
      button.dataset.tileId = tile.id;
      button.setAttribute("aria-label", `${tile.label} ${formatWon(tile.reward)}`);

      const face = document.createElement("span");
      face.className = "tile-face";
      face.append(createTilePrint(tile, button));
      button.append(face);

      button.addEventListener("pointerdown", (event) => {
        if (event.pointerType !== "touch") return;

        event.preventDefault();
        suppressSyntheticClickUntil = performance.now() + 500;
        handleTileClick(tile.id);
      });
      button.addEventListener("click", () => {
        if (performance.now() < suppressSyntheticClickUntil) return;
        handleTileClick(tile.id);
      });
      boardElement.append(button);
    }

    if (activeCount === 0) {
      showClearCelebration({ title: "Clear", label: "최종 획득 금액", celebrate: true });
    }
  }

  function handleDebugKeys(event) {
    if (!event.altKey || event.key.toLowerCase() !== "c") return;

    event.preventDefault();
    showClearCelebration({ title: "Clear", label: "현재 획득 금액", forceFireworks: true });
  }

  function showClearCelebration(options = {}) {
    gameEnded = true;
    stopTimer();
    hideTimeNotice();
    resultTitle.textContent = options.title ?? "Clear";
    resultLabel.textContent = options.label ?? "최종 획득 금액";
    clearMessage.textContent = formatWon(board.rewardTotal);
    clearPanel.classList.add("is-visible");
    clearPanel.setAttribute("aria-hidden", "false");

    if (options.forceFireworks || options.celebrate || !clearCelebrated) {
      clearCelebrated = true;
      spawnClearFireworks();
    }
  }

  function handleTileClick(tileId) {
    if (gameEnded) {
      showToast("시간이 종료되었습니다.");
      return;
    }

    const tile = resolveTile(tileId, board.tiles);
    if (!tile || tile.removed) return;

    if (!isTileSelectable(tile, board.tiles, board.tileSpan)) {
      shakeTile(tileId);
      showToast("위가 덮였거나 양쪽이 막힌 타일입니다.");
      return;
    }

    if (!selectedTileId) {
      setSelectedTile(tileId);
      return;
    }

    if (selectedTileId === tileId) {
      setSelectedTile(null);
      return;
    }

    const selectedTile = resolveTile(selectedTileId, board.tiles);
    if (canMatch(selectedTile, tile, board.tiles, board.tileSpan)) {
      animateAndRemovePair(selectedTile.id, tile.id);
      return;
    }

    setSelectedTile(tileId);
    showToast("같은 화폐 타일끼리 맞출 수 있습니다.");
  }

  function setSelectedTile(tileId) {
    selectedTileId = tileId;
    hintTileIds = new Set();

    for (const element of boardElement.querySelectorAll(".tile.is-selected, .tile.is-hint")) {
      element.classList.remove("is-selected", "is-hint");
    }

    if (!tileId) return;

    const selectedElement = boardElement.querySelector(`[data-tile-id="${tileId}"]`);
    selectedElement?.classList.add("is-selected");
  }

  function animateAndRemovePair(firstTileId, secondTileId) {
    const firstElement = boardElement.querySelector(`[data-tile-id="${firstTileId}"]`);
    const secondElement = boardElement.querySelector(`[data-tile-id="${secondTileId}"]`);
    const first = resolveTile(firstTileId, board.tiles);
    const second = resolveTile(secondTileId, board.tiles);
    const rewardGained = first.reward;

    spawnMatchBurst(firstElement, secondElement);
    firstElement?.classList.add("is-removing");
    secondElement?.classList.add("is-removing");

    window.setTimeout(() => {
      first.removed = true;
      first.matchedAt = Date.now();
      second.removed = true;
      second.matchedAt = first.matchedAt;
      board.rewardTotal += rewardGained;
      board.moveCount += 1;
      selectedTileId = null;
      hintTileIds = new Set();
      renderBoard();
      showToast(`+${formatWon(rewardGained)}`);
    }, 180);
  }

  function showHint() {
    if (gameEnded) {
      showToast("시간이 종료되었습니다.");
      return;
    }

    const matches = getAvailableMatchPairs(board.tiles, board.tileSpan);

    if (matches.length === 0) {
      showToast("가능한 짝이 없습니다. 섞기를 눌러주세요.");
      return;
    }

    const pair = matches[0];
    hintTileIds = new Set([pair[0].id, pair[1].id]);
    renderBoard();
    showToast(`${pair[0].label} 짝을 찾았습니다.`);

    window.setTimeout(() => {
      hintTileIds = new Set();
      renderBoard();
    }, 1500);
  }

  function shuffleRemainingFaces() {
    if (gameEnded) {
      showToast("시간이 종료되었습니다.");
      return;
    }

    const active = activeTiles(board.tiles);
    if (active.length < 2) return;

    const faces = active.map((tile) => ({
      faceKey: tile.faceKey,
      label: tile.label,
      sub: tile.sub,
      reward: tile.reward,
      group: tile.group,
      image: tile.image
    }));
    const shuffled = shuffle(faces, createSeededRng(`${board.seed}-shuffle-${board.moveCount}-${Date.now()}`));

    active.forEach((tile, index) => {
      Object.assign(tile, shuffled[index]);
    });

    selectedTileId = null;
    hintTileIds = new Set();
    renderBoard();
    showToast("남은 타일을 섞었습니다.");
  }

  function createMoneyMahjongBoard(seed) {
    const coordinates = getLayoutCoordinates(TURTLE_LAYOUT);
    const validation = validateCoordinates(coordinates, TILE_SPAN);

    if (!validation.valid) {
      throw new Error(validation.errors.join("; "));
    }

    const deck = createPairedDeck(MONEY_TILE_TYPES, coordinates.length, createSeededRng(seed));

    return {
      layoutId: TURTLE_LAYOUT.id,
      layoutName: TURTLE_LAYOUT.name,
      tileSpan: TURTLE_LAYOUT.tileSpan,
      tiles: coordinates.map((coordinate, index) => {
        const face = deck[index];
        return {
          id: `${TURTLE_LAYOUT.id}-${index}`,
          x: coordinate.x,
          y: coordinate.y,
          z: coordinate.z,
          faceKey: face.key,
          label: face.label,
          sub: face.sub,
          reward: face.reward,
          group: face.group,
          image: face.image,
          removed: false,
          matchedAt: null
        };
      }),
      visualMetrics: getVisualMetrics(coordinates),
      rewardTotal: 0,
      moveCount: 0,
      seed
    };
  }

  function getLayoutCoordinates(layout) {
    return layout.layers.flatMap((layer) => {
      return layer.rows.flatMap((row) => {
        const cells = row.cells ?? createSteppedCells(row.xStart, row.count, row.step ?? TILE_SPAN.width);
        return cells.map((x) => ({ x, y: row.y, z: layer.z }));
      });
    });
  }

  function validateCoordinates(coordinates, tileSpan) {
    const errors = [];

    if (coordinates.length === 0) errors.push("layout must contain at least one tile");
    if (coordinates.length % 2 !== 0) errors.push(`layout tile count must be even, received ${coordinates.length}`);

    const seenKeys = new Set();
    const duplicateKeys = new Set();

    for (const coordinate of coordinates) {
      const key = `${coordinate.x}:${coordinate.y}:${coordinate.z}`;
      if (seenKeys.has(key)) duplicateKeys.add(key);
      seenKeys.add(key);
    }

    if (duplicateKeys.size > 0) errors.push(`duplicate coordinates found: ${Array.from(duplicateKeys).join(", ")}`);

    for (let a = 0; a < coordinates.length; a += 1) {
      for (let b = a + 1; b < coordinates.length; b += 1) {
        const first = coordinates[a];
        const second = coordinates[b];
        if (first.z === second.z && rectanglesOverlap(getBounds(first, tileSpan), getBounds(second, tileSpan))) {
          errors.push(`same-layer overlap at indexes ${a} and ${b}`);
        }
      }
    }

    return { valid: errors.length === 0, errors };
  }

  function isTileSelectable(tile, tiles, tileSpan) {
    if (!tile || tile.removed) return false;
    if (getBlockingTilesAbove(tile, tiles, tileSpan).length > 0) return false;

    const sideState = getSideState(tile, tiles, tileSpan);
    return sideState.leftFree || sideState.rightFree;
  }

  function getBlockingTilesAbove(tile, tiles, tileSpan) {
    const bounds = getBounds(tile, tileSpan);

    return activeTiles(tiles).filter((other) => {
      if (other.id === tile.id || other.z <= tile.z) return false;
      return rectanglesOverlap(bounds, getBounds(other, tileSpan));
    });
  }

  function getSideState(tile, tiles, tileSpan) {
    const bounds = getBounds(tile, tileSpan);
    const leftBlockers = [];
    const rightBlockers = [];

    for (const other of activeTiles(tiles)) {
      if (other.id === tile.id || other.z !== tile.z) continue;

      const otherBounds = getBounds(other, tileSpan);
      const overlapsVertically = rangesOverlap(bounds.top, bounds.bottom, otherBounds.top, otherBounds.bottom);
      if (!overlapsVertically) continue;

      if (otherBounds.right === bounds.left) leftBlockers.push(other);
      if (otherBounds.left === bounds.right) rightBlockers.push(other);
    }

    return {
      leftFree: leftBlockers.length === 0,
      rightFree: rightBlockers.length === 0,
      leftBlockers,
      rightBlockers
    };
  }

  function getSelectableTiles(tiles, tileSpan) {
    return activeTiles(tiles).filter((tile) => isTileSelectable(tile, tiles, tileSpan));
  }

  function getAvailableMatchPairs(tiles, tileSpan) {
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

  function canMatch(first, second, tiles, tileSpan) {
    if (!first || !second || first.id === second.id) return false;
    if (first.removed || second.removed) return false;
    if (first.faceKey !== second.faceKey) return false;
    return isTileSelectable(first, tiles, tileSpan) && isTileSelectable(second, tiles, tileSpan);
  }

  function getBounds(tile, tileSpan) {
    return {
      left: tile.x,
      right: tile.x + tileSpan.width,
      top: tile.y,
      bottom: tile.y + tileSpan.height
    };
  }

  function getTilePosition(tile) {
    const rawPosition = getRawTilePosition(tile);
    const metrics = board.visualMetrics;

    return {
      left: BOARD_PADDING_X + rawPosition.left - metrics.minLeft,
      top: BOARD_PADDING_Y + rawPosition.top - metrics.minTop,
      zIndex: 1000 + (tile.z * 220) + (tile.y * 10) + tile.x
    };
  }

  function getRawTilePosition(tile) {
    return {
      left: tile.x * GRID_X + (tile.z * LAYER_SHIFT_X),
      top: tile.y * GRID_Y + (tile.z * LAYER_SHIFT_Y)
    };
  }

  function getVisualMetrics(coordinates) {
    const positions = coordinates.map(getRawTilePosition);
    const minLeft = Math.min(...positions.map((position) => position.left));
    const minTop = Math.min(...positions.map((position) => position.top));
    const maxRight = Math.max(...positions.map((position) => position.left + TILE_WIDTH + TILE_SIDE_DEPTH));
    const maxBottom = Math.max(...positions.map((position) => position.top + TILE_HEIGHT + TILE_SIDE_DEPTH));

    return {
      minLeft,
      minTop,
      width: Math.ceil(maxRight - minLeft + (BOARD_PADDING_X * 2)),
      height: Math.ceil(maxBottom - minTop + (BOARD_PADDING_Y * 2))
    };
  }

  function setBoardDimensions(metrics) {
    const shellWidth = boardShellElement.clientWidth;
    const shellHeight = boardShellElement.clientHeight;
    const horizontalPadding = shellWidth <= 520 ? 20 : 32;
    const topPadding = Math.round(Math.max(14, Math.min(48, shellHeight * 0.055)));
    const bottomPadding = shellWidth <= 520 ? 16 : 28;
    const availableWidth = Math.max(shellWidth - horizontalPadding, 160);
    const availableHeight = Math.max(shellHeight - topPadding - bottomPadding, 160);
    const scale = Math.min(1, availableWidth / metrics.width, availableHeight / metrics.height);
    const scaledWidth = metrics.width * scale;
    const leftOffset = Math.max(0, (shellWidth - scaledWidth) / 2);

    boardElement.style.width = `${metrics.width}px`;
    boardElement.style.height = `${metrics.height}px`;
    boardElement.style.margin = `${topPadding}px 0 0 ${leftOffset}px`;
    boardElement.style.transformOrigin = "top left";
    boardElement.style.transform = `scale(${scale})`;
  }

  function createTilePrint(tile, tileButton) {
    const print = document.createElement("span");
    print.className = "tile-print";

    const image = document.createElement("img");
    image.className = "tile-image";
    image.src = tile.image;
    image.alt = "";
    image.draggable = false;
    image.addEventListener("load", () => {
      tileButton.classList.add("has-loaded-image");
    });
    image.addEventListener("error", () => {
      image.remove();
    });

    const fallback = document.createElement("span");
    fallback.className = "tile-fallback";
    fallback.innerHTML = `<span class="tile-main">${tile.label}</span><span class="tile-sub">${tile.sub}</span>`;

    print.append(image, fallback);
    return print;
  }

  function rectanglesOverlap(first, second) {
    return first.left < second.right
      && first.right > second.left
      && first.top < second.bottom
      && first.bottom > second.top;
  }

  function createPairedDeck(tileTypes, tileCount, rng) {
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
    const copy = items.slice();

    for (let index = copy.length - 1; index > 0; index -= 1) {
      const swapIndex = Math.floor(rng() * (index + 1));
      const current = copy[index];
      copy[index] = copy[swapIndex];
      copy[swapIndex] = current;
    }

    return copy;
  }

  function createSteppedCells(xStart, count, step) {
    return Array.from({ length: count }, (_, index) => xStart + index * step);
  }

  function activeTiles(tiles) {
    return tiles.filter((tile) => !tile.removed);
  }

  function resolveTile(tileId, tiles) {
    return tiles.find((tile) => tile.id === tileId) ?? null;
  }

  function rangesOverlap(firstStart, firstEnd, secondStart, secondEnd) {
    return firstStart < secondEnd && firstEnd > secondStart;
  }

  function createSeededRng(seed) {
    let state = hashString(String(seed));

    return function rng() {
      state += 0x6d2b79f5;
      let value = state;
      value = Math.imul(value ^ (value >>> 15), value | 1);
      value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
      return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
    };
  }

  function hashString(value) {
    let hash = 2166136261;

    for (let index = 0; index < value.length; index += 1) {
      hash ^= value.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }

    return hash >>> 0;
  }

  function shakeTile(tileId) {
    const element = boardElement.querySelector(`[data-tile-id="${tileId}"]`);
    if (!element) return;

    element.classList.remove("is-shake");
    window.requestAnimationFrame(() => {
      element.classList.add("is-shake");
    });
  }

  function showToast(message, duration = 1600) {
    window.clearTimeout(toastTimer);
    toastElement.textContent = message;
    toastElement.classList.add("is-visible");
    toastTimer = window.setTimeout(() => {
      toastElement.classList.remove("is-visible");
    }, duration);
  }

  function spawnMatchBurst(...elements) {
    const colors = ["#f6c85f", "#ff8fab", "#87d37c", "#72c7ff", "#fff1a8", "#d7a7ff"];

    for (const element of elements) {
      if (!element) continue;

      const rect = element.getBoundingClientRect();
      const originX = rect.left + rect.width / 2;
      const originY = rect.top + rect.height / 2;

      for (let index = 0; index < 14; index += 1) {
        const angle = (Math.PI * 2 * index) / 14;
        const distance = 30 + Math.random() * 46;
        const particle = document.createElement("span");

        particle.className = "match-particle";
        particle.style.setProperty("--x", `${originX + (Math.random() * 8 - 4)}px`);
        particle.style.setProperty("--y", `${originY + (Math.random() * 8 - 4)}px`);
        particle.style.setProperty("--dx", `${Math.cos(angle) * distance}px`);
        particle.style.setProperty("--dy", `${Math.sin(angle) * distance - 24}px`);
        particle.style.setProperty("--rot", `${Math.round(Math.random() * 180)}deg`);
        particle.style.setProperty("--size", `${4 + Math.random() * 4}px`);
        particle.style.setProperty("--color", colors[index % colors.length]);

        document.body.append(particle);
        window.setTimeout(() => particle.remove(), 1520);
      }
    }
  }

  function spawnClearFireworks() {
    const colors = ["#ffd166", "#ef476f", "#06d6a0", "#118ab2", "#f78c6b", "#c77dff", "#ffffff"];

    for (let burstIndex = 0; burstIndex < 7; burstIndex += 1) {
      window.setTimeout(() => {
        const originX = window.innerWidth * (0.18 + Math.random() * 0.64);
        const originY = window.innerHeight * (0.18 + Math.random() * 0.38);

        for (let index = 0; index < 34; index += 1) {
          const angle = (Math.PI * 2 * index) / 34;
          const distance = 70 + Math.random() * 92;
          const particle = document.createElement("span");

          particle.className = "firework";
          particle.style.setProperty("--x", `${originX}px`);
          particle.style.setProperty("--y", `${originY}px`);
          particle.style.setProperty("--dx", `${Math.cos(angle) * distance}px`);
          particle.style.setProperty("--dy", `${Math.sin(angle) * distance}px`);
          particle.style.setProperty("--size", `${4 + Math.random() * 5}px`);
          particle.style.setProperty("--color", colors[(index + burstIndex) % colors.length]);

          document.body.append(particle);
          window.setTimeout(() => particle.remove(), 1280);
        }
      }, burstIndex * 180);
    }

    for (let index = 0; index < 90; index += 1) {
      const strip = document.createElement("span");
      strip.className = "confetti-strip";
      strip.style.setProperty("--x", `${Math.random() * 100}vw`);
      strip.style.setProperty("--w", `${5 + Math.random() * 7}px`);
      strip.style.setProperty("--h", `${9 + Math.random() * 14}px`);
      strip.style.setProperty("--rot", `${Math.random() * 360}deg`);
      strip.style.setProperty("--duration", `${1800 + Math.random() * 1500}ms`);
      strip.style.setProperty("--color", colors[index % colors.length]);
      strip.style.animationDelay = `${Math.random() * 700}ms`;
      document.body.append(strip);
      window.setTimeout(() => strip.remove(), 4100);
    }
  }

  function startTimer() {
    timerId = window.setInterval(() => {
      timeLeft = Math.max(0, timeLeft - 1);
      updateTimerDisplay();

      if (timeLeft === 0) {
        grantExtraMinuteIfNeeded();
      }
    }, 1000);
  }

  function stopTimer() {
    if (!timerId) return;
    window.clearInterval(timerId);
    timerId = null;
  }

  function updateTimerDisplay() {
    const minutes = Math.floor(timeLeft / 60);
    const seconds = timeLeft % 60;
    timeElement.textContent = `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }

  function grantExtraMinuteIfNeeded() {
    if (gameEnded) return;

    if (activeTiles(board.tiles).length === 0) {
      showClearCelebration({ title: "Clear", label: "최종 획득 금액", celebrate: true });
      return;
    }

    extraMinuteCount += 1;
    timeLeft = 60;
    updateTimerDisplay();
    pulseTimer();
    showTimeNotice(`시간 종료! 추가 시간 1분이 지급됐습니다. (${extraMinuteCount}번째 연장)`);
  }

  function pulseTimer() {
    timerStatElement.classList.remove("is-extended");
    window.requestAnimationFrame(() => {
      timerStatElement.classList.add("is-extended");
    });
  }

  function showTimeNotice(message) {
    window.clearTimeout(timeNoticeTimer);
    timeNoticeElement.textContent = message;
    timeNoticeElement.classList.add("is-visible");
    showToast("추가 시간 1분!", 2600);

    timeNoticeTimer = window.setTimeout(() => {
      timeNoticeElement.classList.remove("is-visible");
    }, 3600);
  }

  function hideTimeNotice() {
    window.clearTimeout(timeNoticeTimer);
    timeNoticeElement.classList.remove("is-visible");
    timeNoticeElement.textContent = "";
  }

  function preventPageDrag(event) {
    event.preventDefault();
  }

  function formatWon(value) {
    return `₩${value.toLocaleString("ko-KR")}`;
  }
}());
