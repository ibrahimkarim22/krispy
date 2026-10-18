import { films } from "../data/catalog";
import { pageItems } from "./experienceModel";

const dimension = (value, fallback) =>
  Number.isFinite(Number(value)) && Number(value) > 0
    ? Number(value)
    : fallback;
const clamp = (value, minimum, maximum) =>
  Math.min(maximum, Math.max(minimum, value));

/** Fill the viewport with a bounded grid whose cells approximate portrait posters. */
export function getWallLayout(width, height) {
  const viewportWidth = dimension(width, 1440);
  const viewportHeight = dimension(height, 900);
  const shortLandscape =
    viewportWidth > viewportHeight && viewportHeight <= 450;
  const targetHeight = shortLandscape
    ? Math.max(1, Math.min(180, viewportHeight * 0.45))
    : viewportWidth < 600
      ? 230
      : 300;
  const columns = clamp(
    Math.round(viewportWidth / ((targetHeight * 2) / 3)),
    2,
    12,
  );
  let rows = clamp(Math.round(viewportHeight / targetHeight), 2, 4);
  if (columns * rows < 6) rows = 3;
  return { columns, rows, size: columns * rows };
}

function uniqueItems(items) {
  const seen = new Set();
  return (Array.isArray(items) ? items : []).filter((item) => {
    if (!item || typeof item.id !== "string" || !item.id || seen.has(item.id))
      return false;
    seen.add(item.id);
    return true;
  });
}

/** Decoration fills spare space; only genuine paged results become controls. */
export function getWallTiles(items, page = 0, size = 1, ambientItems) {
  const capacity = Number.isFinite(Number(size))
    ? Math.max(1, Math.floor(Number(size)))
    : 1;
  const batch = pageItems(uniqueItems(items), page, capacity);
  const tiles = batch.items.map((item, index) => ({
    item,
    decorative: false,
    key: "result-" + batch.page + "-" + index + "-" + item.id,
  }));
  const provided = uniqueItems(ambientItems).filter(
    (item) => item.artwork || item.fallbackSrc,
  );
  const candidates = provided.length
    ? provided
    : films.filter((item) => item.artwork || item.fallbackSrc);
  const interactiveIds = new Set(batch.items.map((item) => item.id));
  const alternatives = candidates.filter(
    (item) => !interactiveIds.has(item.id),
  );
  const ambient = alternatives.length ? alternatives : candidates;
  while (tiles.length < capacity) {
    const index = tiles.length;
    const item = ambient[(batch.page * capacity + index) % ambient.length];
    tiles.push({
      item,
      decorative: true,
      key: "ambient-" + batch.page + "-" + index + "-" + item.id,
    });
  }
  return tiles;
}

/** Keep a next-poster glimpse visible while making posters fill the strip height. */
export function getStripLayout(width, height) {
  const viewportWidth = Math.max(1, dimension(width, 1440));
  const viewportHeight = Math.max(1, dimension(height, 900));
  const visibleCount =
    viewportWidth < 600
      ? 1 / 0.84
      : clamp(
          Math.round(viewportWidth / (viewportHeight * (2 / 3)) - 0.25),
          1,
          5,
        ) + 0.25;
  const tileWidth = viewportWidth / visibleCount;
  return { tileWidth, rows: 1, visibleCount, step: tileWidth };
}

/** Keep every genuine result in the strip and fill only spare space with decoration. */
export function buildStripTiles(items, minimumSlots = 2, ambientItems) {
  const minimum = Number.isFinite(Number(minimumSlots))
    ? Math.max(2, Math.ceil(Number(minimumSlots)))
    : 2;
  const results = uniqueItems(items);
  const tiles = results.map((item) => ({
    item,
    decorative: false,
    key: "strip-result-" + item.id,
  }));
  const provided = uniqueItems(ambientItems).filter(
    (item) => item.artwork || item.fallbackSrc,
  );
  const candidates = provided.length
    ? provided
    : films.filter((item) => item.artwork || item.fallbackSrc);
  const interactiveIds = new Set(results.map((item) => item.id));
  const alternatives = candidates.filter(
    (item) => !interactiveIds.has(item.id),
  );
  const ambient = alternatives.length ? alternatives : candidates;
  while (tiles.length < minimum) {
    const index = tiles.length;
    const item = ambient[index % ambient.length];
    tiles.push({
      item,
      decorative: true,
      key: "strip-ambient-" + index + "-" + item.id,
    });
  }
  return tiles;
}

/** Three tracks remain fixed while responsive columns determine the page capacity. */
export function getThreeRowLayout(width, height) {
  const { columns } = getWallLayout(width, height);
  return { columns, rows: 3, size: columns * 3 };
}

/** Short pages expand their genuine results without changing the base page capacity. */
export function buildPagedWall(items, page = 0, layout) {
  const baseColumns = clamp(
    Math.floor(dimension(layout?.columns, getThreeRowLayout().columns)),
    2,
    12,
  );
  const capacity = baseColumns * 3;
  const batch = pageItems(uniqueItems(items), page, capacity);
  const count = batch.items.length;
  const columns = count ? Math.ceil(count / 3) : baseColumns;
  const tiles = [];

  if (count < 3) {
    batch.items.forEach((item, index) => {
      tiles.push({
        item,
        key: "wall-" + item.id,
        columnSpan: 1,
        rowSpan: count === 1 ? 3 : index === 0 ? 2 : 1,
      });
    });
  } else {
    for (let row = 0; row < 3; row += 1) {
      const rowCount = Math.floor(count / 3) + (row < count % 3 ? 1 : 0);
      for (let column = 0; column < rowCount; column += 1) {
        const item = batch.items[tiles.length];
        tiles.push({
          item,
          key: "wall-" + item.id,
          columnSpan:
            Math.floor(columns / rowCount) +
            (column < columns % rowCount ? 1 : 0),
          rowSpan: 1,
        });
      }
    }
  }

  return {
    tiles,
    columns,
    rows: 3,
    page: batch.page,
    pages: batch.pages,
    total: batch.total,
    start: count ? batch.page * capacity + 1 : 0,
    end: count ? batch.page * capacity + count : 0,
  };
}

/** Three visible rows fill the viewport, with optional landscape channel cells. */
export function getVerticalWallLayout(width, height, options) {
  const viewportWidth = dimension(width, 1440);
  const aspectRatio = dimension(options?.aspectRatio, 1 / 1.46);
  const landscape = aspectRatio > 1;
  const targetHeight = dimension(height, 900) / 3;
  // A very narrow, tall viewport cannot fit three rows and keep each cell wide.
  const rowHeight = landscape && viewportWidth <= targetHeight
    ? viewportWidth / aspectRatio
    : targetHeight;
  const maximumColumns = landscape
    ? Math.min(12, Math.max(1, Math.ceil(viewportWidth / rowHeight) - 1))
    : 12;
  const columns = clamp(
    Math.round(viewportWidth / (rowHeight * aspectRatio)),
    landscape ? 1 : 2,
    maximumColumns,
  );
  return { columns, rowHeight };
}

/** Compact channel cards keep a stable viewing size regardless of viewport height. */
export function getChannelWallLayout(width) {
  const viewportWidth = dimension(width, 1440);
  const gap = 12;
  const padding = Math.min(20, Math.max(0, (viewportWidth - 1) / 2));
  const contentWidth = viewportWidth - padding * 2;
  const columns = clamp(Math.round((contentWidth + gap) / (260 + gap)), 1, 24);
  const tileWidth = (contentWidth - (columns - 1) * gap) / columns;
  return { columns, rowHeight: tileWidth * 9 / 16, gap, padding, compact: true };
}

/** Scenic cards use a wider canvas while keeping their real aspect ratio. */
export function getDestinationWallLayout(width) {
  const viewportWidth = dimension(width, 1440);
  const padding = Math.min(20, Math.max(0, (viewportWidth - 1) / 2));
  const gap = 16;
  const columns = viewportWidth >= 680 ? 2 : 1;
  const tileWidth = (viewportWidth - padding * 2 - (columns - 1) * gap) / columns;
  return { columns, rowHeight: tileWidth * 10 / 16, gap, padding, compact: true };
}

/** Genuine results occupy fixed cells; sparse views can omit unused tracks. */
export function buildVerticalWall(items, layout) {
  const defaults = getVerticalWallLayout();
  const compact = layout?.compact === true;
  const contentSized = layout?.contentSized === true;
  const columns = clamp(
    Math.floor(dimension(layout?.columns, defaults.columns)),
    1,
    compact ? 24 : 12,
  );
  const rowHeight = dimension(layout?.rowHeight, defaults.rowHeight);
  const results = uniqueItems(items);
  const total = results.length;
  const rows = Math.max(compact || contentSized ? 1 : 3, Math.ceil(total / columns));
  const tiles = results.map((item) => ({
    item,
    key: "wall-" + item.id,
    columnSpan: 1,
    rowSpan: 1,
  }));
  return {
    columns, rows, rowHeight, total, tiles,
    ...(contentSized ? { contentSized: true } : {}),
    ...(compact ? { compact: true, gap: layout.gap ?? 12, padding: layout.padding ?? 20 } : {}),
  };
}

/** Independent grids keep section boundaries intact without stretching the final row. */
export function buildSectionedVerticalWall(groups, layout) {
  const base = buildVerticalWall([], layout);
  const seen = new Set();
  let firstRow = 0;
  const sections = (Array.isArray(groups) ? groups : []).flatMap((group) => {
    const items = uniqueItems(group.items).filter((item) => {
      if (seen.has(item.id)) return false;
      seen.add(item.id);
      return true;
    });
    if (!items.length) return [];
    const page = buildVerticalWall(items, { ...layout, ...group.layout });
    page.tiles = page.tiles.map((tile, index) => ({
      ...tile,
      sectionId: group.id,
      wallRow: firstRow + Math.floor(index / page.columns),
      wallColumn: index % page.columns,
      wallColumnCenter: ((index % page.columns) + 0.5) / page.columns,
    }));
    firstRow += page.rows;
    return [{ id: group.id, title: group.title, wallPage: page }];
  });
  if (!sections.length) return { ...base, sections: [] };
  const tiles = sections.flatMap((section) => section.wallPage.tiles);
  return { ...base, rows: firstRow, total: tiles.length, tiles, sections };
}

/** Vertical arrows follow visible columns and skip empty tracks between sections. */
export function getVerticalWallNeighbor(page, id, key) {
  const tiles = page?.tiles || [];
  const index = tiles.findIndex((tile) => tile.item.id === id);
  if (index < 0) return undefined;
  if (key === "ArrowLeft") return tiles[index - 1]?.item;
  if (key === "ArrowRight") return tiles[index + 1]?.item;
  if (!["ArrowUp", "ArrowDown"].includes(key)) return undefined;
  const direction = key === "ArrowDown" ? 1 : -1;
  if (!page.sections?.length)
    return tiles[index + direction * page.columns]?.item;
  const current = tiles[index];
  const candidates = tiles.filter(
    (tile) => direction * (tile.wallRow - current.wallRow) > 0,
  );
  if (!candidates.length) return undefined;
  const nextRow = candidates.reduce(
    (row, tile) =>
      direction === 1
        ? Math.min(row, tile.wallRow)
        : Math.max(row, tile.wallRow),
    candidates[0].wallRow,
  );
  return candidates
    .filter((tile) => tile.wallRow === nextRow)
    .reduce((nearest, tile) =>
      Math.abs(tile.wallColumnCenter - current.wallColumnCenter) <
      Math.abs(nearest.wallColumnCenter - current.wallColumnCenter)
        ? tile
        : nearest,
    ).item;
}
