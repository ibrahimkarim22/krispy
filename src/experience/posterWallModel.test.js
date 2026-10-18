import { classicFilms, openFilms, films } from "../data/catalog";
import { pageItems } from "./experienceModel";
import {
  getWallLayout,
  getWallTiles,
  getStripLayout,
  buildStripTiles,
  getThreeRowLayout,
  buildPagedWall,
  getVerticalWallLayout,
  getChannelWallLayout,
  buildVerticalWall,
  buildSectionedVerticalWall,
  getVerticalWallNeighbor,
} from "./posterWallModel";

test.each([
  [375, 667, { columns: 2, rows: 3, size: 6 }],
  [320, 568, { columns: 2, rows: 3, size: 6 }],
  [1440, 900, { columns: 7, rows: 3, size: 21 }],
  [667, 375, { columns: 6, rows: 2, size: 12 }],
  [768, 1024, { columns: 4, rows: 3, size: 12 }],
])(
  "viewport %s×%s produces a practical edge-to-edge poster grid",
  (width, height, expected) => {
    expect(getWallLayout(width, height)).toEqual(expected);
  },
);

test.each([
  [undefined, undefined],
  [null, null],
  [NaN, Infinity],
  [-1, 0],
  ["bad", "bad"],
])(
  "invalid viewport dimensions %s×%s recover a finite desktop layout",
  (width, height) => {
    expect(getWallLayout(width, height)).toEqual({
      columns: 7,
      rows: 3,
      size: 21,
    });
  },
);

test.each([
  [320, 160],
  [1, 1],
  [3840, 2160],
  [100000, 100000],
])(
  "very short or large viewport %s×%s remains bounded and fills at least six tiles",
  (width, height) => {
    const layout = getWallLayout(width, height);
    expect(layout.columns).toBeGreaterThanOrEqual(2);
    expect(layout.rows).toBeGreaterThanOrEqual(2);
    expect(layout.size).toBe(layout.columns * layout.rows);
    expect(layout.size).toBeGreaterThanOrEqual(6);
    expect(layout.size).toBeLessThanOrEqual(48);
  },
);

test("all 48 original films are traversed exactly once as interactive results", () => {
  const reached = [];
  for (let page = 0; page < 3; page += 1) {
    const tiles = getWallTiles(classicFilms, page, 21, openFilms);
    expect(tiles).toHaveLength(21);
    reached.push(
      ...tiles
        .filter((tile) => !tile.decorative)
        .map((tile) => tile.item.legacyId),
    );
  }
  expect(reached).toEqual(Array.from({ length: 48 }, (_, index) => index + 1));
});

test("incomplete pages match pageItems and fill spare slots with genuine decorative references", () => {
  const tiles = getWallTiles(classicFilms, 99, 21, openFilms);
  const interactive = tiles.filter((tile) => !tile.decorative);
  expect(interactive.map((tile) => tile.item)).toEqual(
    pageItems(classicFilms, 99, 21).items,
  );
  expect(interactive).toHaveLength(6);
  expect(tiles.filter((tile) => tile.decorative)).toHaveLength(15);
  expect(
    tiles
      .filter((tile) => tile.decorative)
      .every((tile) => openFilms.includes(tile.item)),
  ).toBe(true);
  expect(new Set(tiles.map((tile) => tile.key)).size).toBe(21);
});

test("a single result stays interactive once and ambient repetitions never become controls", () => {
  const tiles = getWallTiles([openFilms[0], openFilms[0]], 0, 6, [
    openFilms[1],
  ]);
  expect(tiles).toHaveLength(6);
  expect(
    tiles.filter((tile) => !tile.decorative).map((tile) => tile.item.id),
  ).toEqual(["film-sintel"]);
  expect(
    tiles
      .filter((tile) => tile.decorative)
      .every((tile) => tile.item === openFilms[1]),
  ).toBe(true);
  expect(new Set(tiles.map((tile) => tile.key)).size).toBe(6);
});

test("empty collections fill every slot without pretending there are matching results", () => {
  const tiles = getWallTiles([], 10, 6, openFilms);
  expect(tiles).toHaveLength(6);
  expect(tiles.every((tile) => tile.decorative)).toBe(true);
  expect(tiles.every((tile) => openFilms.includes(tile.item))).toBe(true);
});

test("missing ambient input uses real existing posters and never mutates original records", () => {
  const originals = JSON.stringify(classicFilms);
  const items = Object.freeze([classicFilms[0]]);
  const tiles = getWallTiles(items, 0, 6, []);
  expect(tiles).toHaveLength(6);
  expect(tiles[0].item).toBe(classicFilms[0]);
  expect(
    tiles
      .filter((tile) => tile.decorative)
      .every(
        (tile) =>
          classicFilms.includes(tile.item) || openFilms.includes(tile.item),
      ),
  ).toBe(true);
  expect(
    tiles.every((tile) => tile.item.artwork || tile.item.fallbackSrc),
  ).toBe(true);
  expect(JSON.stringify(classicFilms)).toBe(originals);
  expect(items).toHaveLength(1);
});

test("invalid paging values are safe and match the shared paging defaults", () => {
  const tiles = getWallTiles(classicFilms, Infinity, 0, openFilms);
  expect(tiles).toHaveLength(1);
  expect(tiles[0]).toMatchObject({ item: classicFilms[0], decorative: false });
  expect(getWallTiles(null, 0, 6, null)).toHaveLength(6);
});

test.each([
  [375, 667],
  [320, 568],
])(
  "a %s×%s phone initially shows a large full poster and part of the next",
  (width, height) => {
    const layout = getStripLayout(width, height);
    expect(layout.rows).toBe(1);
    expect(layout.tileWidth).toBeCloseTo(width * 0.84);
    expect(layout.visibleCount).toBeCloseTo(1 / 0.84);
    expect(width - layout.tileWidth).toBeGreaterThan(0);
    expect(width - layout.tileWidth).toBeLessThan(layout.tileWidth);
    expect(layout.step).toBe(layout.tileWidth);
  },
);

test.each([
  [1440, 900],
  [768, 1024],
  [667, 375],
  [3840, 240],
  [1, 1],
])(
  "a %s×%s strip always leaves a visible next-poster cut instead of an exact whole-poster edge",
  (width, height) => {
    const layout = getStripLayout(width, height);
    const ratio = width / layout.tileWidth;
    expect(layout.rows).toBe(1);
    expect(Number.isFinite(layout.tileWidth)).toBe(true);
    expect(layout.tileWidth).toBeGreaterThan(0);
    expect(ratio).toBeCloseTo(layout.visibleCount);
    expect(Math.floor(ratio)).toBeGreaterThanOrEqual(1);
    expect(Math.floor(ratio)).toBeLessThanOrEqual(5);
    expect(ratio - Math.floor(ratio)).toBeGreaterThan(0.15);
    expect(ratio - Math.floor(ratio)).toBeLessThanOrEqual(0.3);
    expect(layout.step).toBe(layout.tileWidth);
  },
);

test.each([
  [undefined, undefined],
  [NaN, Infinity],
  [-1, 0],
  ["bad", null],
])(
  "invalid strip dimensions %s×%s use finite sane defaults",
  (width, height) => {
    expect(getStripLayout(width, height)).toEqual({
      tileWidth: 640,
      rows: 1,
      visibleCount: 2.25,
      step: 640,
    });
  },
);

test("a whole strip retains all 48 original films once without result paging or copied records", () => {
  const tiles = buildStripTiles(classicFilms, 4, openFilms);
  expect(tiles).toHaveLength(48);
  expect(tiles.every((tile) => !tile.decorative)).toBe(true);
  expect(tiles.map((tile) => tile.item.legacyId)).toEqual(
    Array.from({ length: 48 }, (_, index) => index + 1),
  );
  expect(tiles.every((tile, index) => tile.item === classicFilms[index])).toBe(
    true,
  );
  expect(new Set(tiles.map((tile) => tile.key)).size).toBe(48);
});

test("single and empty strips fill the scroll cue with decorative real posters", () => {
  const single = buildStripTiles([openFilms[0], openFilms[0]], 4, [
    openFilms[1],
  ]);
  expect(single).toHaveLength(4);
  expect(
    single.filter((tile) => !tile.decorative).map((tile) => tile.item.id),
  ).toEqual(["film-sintel"]);
  expect(
    single
      .filter((tile) => tile.decorative)
      .every((tile) => tile.item === openFilms[1]),
  ).toBe(true);
  expect(new Set(single.map((tile) => tile.key)).size).toBe(4);
  const empty = buildStripTiles([], 4, openFilms);
  expect(empty).toHaveLength(4);
  expect(
    empty.every((tile) => tile.decorative && openFilms.includes(tile.item)),
  ).toBe(true);
});

test("strip result keys remain stable across resizing and sorting without changing original arrays", () => {
  const items = Object.freeze([classicFilms[0], classicFilms[1]]);
  const first = buildStripTiles(items, 3, openFilms);
  const resized = buildStripTiles(items, 6, openFilms);
  expect(first).toHaveLength(3);
  expect(resized).toHaveLength(6);
  expect(
    first.filter((tile) => !tile.decorative).map((tile) => tile.key),
  ).toEqual(resized.filter((tile) => !tile.decorative).map((tile) => tile.key));
  const reversed = buildStripTiles([items[1], items[0]], 3, openFilms);
  expect(reversed[1].key).toBe(first[0].key);
  expect(items[0]).toBe(classicFilms[0]);
  expect(items[1]).toBe(classicFilms[1]);
});

test("missing ambient and invalid minimum slots still produce a genuine filled strip", () => {
  const tiles = buildStripTiles(null, Infinity, null);
  expect(tiles).toHaveLength(2);
  expect(
    tiles.every(
      (tile) =>
        tile.decorative &&
        (classicFilms.includes(tile.item) || openFilms.includes(tile.item)),
    ),
  ).toBe(true);
});

test.each([
  [375, 667, 2],
  [320, 568, 2],
  [1440, 900, 7],
  [768, 1024, 4],
  [667, 375, 6],
])(
  "three-row layout at %s×%s retains a fixed three-row page",
  (width, height, columns) => {
    expect(getThreeRowLayout(width, height)).toEqual({
      columns,
      rows: 3,
      size: columns * 3,
    });
  },
);

test.each([
  [undefined, undefined],
  [null, null],
  [NaN, Infinity],
  [-1, 0],
  ["bad", "bad"],
])(
  "invalid three-row dimensions %s×%s use stable defaults",
  (width, height) => {
    expect(getThreeRowLayout(width, height)).toEqual({
      columns: 7,
      rows: 3,
      size: 21,
    });
  },
);

test.each([
  [1, 1],
  [320, 160],
  [3840, 240],
  [100000, 100000],
])(
  "short and large three-row viewports %s×%s stay bounded",
  (width, height) => {
    const layout = getThreeRowLayout(width, height);
    expect(layout.rows).toBe(3);
    expect(Number.isInteger(layout.columns)).toBe(true);
    expect(layout.columns).toBeGreaterThanOrEqual(2);
    expect(layout.columns).toBeLessThanOrEqual(12);
    expect(layout.size).toBe(layout.columns * 3);
  },
);

test("three-row pagination reaches all 48 original films once without ambient posters", () => {
  const layout = getThreeRowLayout(1440, 900);
  const records = JSON.stringify(classicFilms);
  const reached = [];
  for (let page = 0; page < 3; page += 1) {
    const wall = buildPagedWall(classicFilms, page, layout);
    expect(wall.page).toBe(page);
    expect(wall.pages).toBe(3);
    expect(wall.total).toBe(48);
    expect(wall.start).toBe(page * 21 + 1);
    expect(wall.end).toBe(Math.min(48, (page + 1) * 21));
    expect(wall.tiles.map((tile) => tile.item)).toEqual(
      pageItems(classicFilms, page, layout.size).items,
    );
    expect(
      wall.tiles.every(
        (tile) => !Object.prototype.hasOwnProperty.call(tile, "decorative"),
      ),
    ).toBe(true);
    reached.push(...wall.tiles.map((tile) => tile.item));
  }
  expect(reached).toHaveLength(48);
  expect(reached.every((item, index) => item === classicFilms[index])).toBe(
    true,
  );
  expect(new Set(reached.map((item) => item.id)).size).toBe(48);
  expect(JSON.stringify(classicFilms)).toBe(records);
  expect(layout).toEqual({ columns: 7, rows: 3, size: 21 });
});

test.each([
  [1, 1, [[1, 3]]],
  [
    2,
    1,
    [
      [1, 2],
      [1, 1],
    ],
  ],
  [
    3,
    1,
    [
      [1, 1],
      [1, 1],
      [1, 1],
    ],
  ],
  [
    4,
    2,
    [
      [1, 1],
      [1, 1],
      [2, 1],
      [2, 1],
    ],
  ],
  [
    5,
    2,
    [
      [1, 1],
      [1, 1],
      [1, 1],
      [1, 1],
      [2, 1],
    ],
  ],
  [6, 2, Array.from({ length: 6 }, () => [1, 1])],
])(
  "a short %s-result wall expands genuine posters across all three tracks",
  (count, columns, spans) => {
    const items = classicFilms.slice(0, count);
    const wall = buildPagedWall(items, 0, { columns: 7, rows: 3, size: 21 });
    expect(wall.columns).toBe(columns);
    expect(wall.rows).toBe(3);
    expect(wall.tiles.map((tile) => [tile.columnSpan, tile.rowSpan])).toEqual(
      spans,
    );
    expect(wall.tiles.every((tile, index) => tile.item === items[index])).toBe(
      true,
    );
  },
);

// Model the browser's row-major grid placement so area alone cannot hide gaps or overflow.
function expectFilledGrid(wall) {
  const cells = Array.from({ length: wall.rows }, () =>
    Array(wall.columns).fill(false),
  );
  let cursor = 0;
  for (const tile of wall.tiles) {
    expect(Number.isInteger(tile.columnSpan)).toBe(true);
    expect(Number.isInteger(tile.rowSpan)).toBe(true);
    expect(tile.columnSpan).toBeGreaterThanOrEqual(1);
    expect(tile.rowSpan).toBeGreaterThanOrEqual(1);
    let placed = false;
    for (; cursor < wall.columns * wall.rows; cursor += 1) {
      const row = Math.floor(cursor / wall.columns);
      const column = cursor % wall.columns;
      if (
        column + tile.columnSpan > wall.columns ||
        row + tile.rowSpan > wall.rows
      )
        continue;
      const available = cells
        .slice(row, row + tile.rowSpan)
        .every((track) =>
          track.slice(column, column + tile.columnSpan).every((cell) => !cell),
        );
      if (!available) continue;
      for (let y = row; y < row + tile.rowSpan; y += 1) {
        for (let x = column; x < column + tile.columnSpan; x += 1)
          cells[y][x] = true;
      }
      cursor += tile.columnSpan;
      placed = true;
      break;
    }
    expect(placed).toBe(true);
  }
  expect(cells.every((row) => row.every(Boolean))).toBe(true);
}

test.each([2, 7, 12])(
  "every count from one through a %s-column page fills the grid exactly",
  (columns) => {
    const layout = { columns, rows: 3, size: columns * 3 };
    for (let count = 1; count <= layout.size; count += 1) {
      const wall = buildPagedWall(classicFilms.slice(0, count), 0, layout);
      expect(wall.tiles).toHaveLength(count);
      expect(new Set(wall.tiles.map((tile) => tile.key)).size).toBe(count);
      expectFilledGrid(wall);
    }
    const full = buildPagedWall(classicFilms.slice(0, layout.size), 0, layout);
    expect(full.columns).toBe(columns);
    expect(
      full.tiles.every((tile) => tile.columnSpan === 1 && tile.rowSpan === 1),
    ).toBe(true);
  },
);

test("page clamping keeps the base capacity even after the final grid becomes narrower", () => {
  const layout = Object.freeze({ columns: 7, rows: 3, size: 21 });
  const last = buildPagedWall(classicFilms, 99, layout);
  expect(last).toMatchObject({
    columns: 2,
    rows: 3,
    page: 2,
    pages: 3,
    total: 48,
    start: 43,
    end: 48,
  });
  expect(last.tiles.map((tile) => tile.item)).toEqual(classicFilms.slice(42));
  expect(buildPagedWall(classicFilms, -10, layout)).toMatchObject({
    page: 0,
    start: 1,
    end: 21,
  });
  expect(buildPagedWall(classicFilms, Infinity, layout)).toMatchObject({
    page: 0,
    start: 1,
    end: 21,
  });
  expect(buildPagedWall(classicFilms, 1.9, layout)).toMatchObject({
    page: 1,
    start: 22,
    end: 42,
  });
  expect(layout).toEqual({ columns: 7, rows: 3, size: 21 });
});

test("empty and malformed result lists stay empty without invented poster records", () => {
  const expected = {
    tiles: [],
    columns: 7,
    rows: 3,
    page: 0,
    pages: 0,
    total: 0,
    start: 0,
    end: 0,
  };
  expect(buildPagedWall([], 8, getThreeRowLayout())).toEqual(expected);
  expect(buildPagedWall(null, 8, null)).toEqual(expected);
  expect(buildPagedWall([null, {}, { id: "" }], 0, {})).toEqual(expected);
});

test("duplicate results are removed while original references and ID keys survive resize and sorting", () => {
  const items = Object.freeze([
    classicFilms[0],
    classicFilms[0],
    null,
    classicFilms[1],
  ]);
  const first = buildPagedWall(items, 0, getThreeRowLayout(375, 667));
  const second = buildPagedWall(
    [items[3], items[0]],
    0,
    getThreeRowLayout(1440, 900),
  );
  expect(first.total).toBe(2);
  expect(first.tiles.map((tile) => tile.item)).toEqual([items[0], items[3]]);
  expect(first.tiles[0].item).toBe(classicFilms[0]);
  expect(first.tiles[1].item).toBe(classicFilms[1]);
  expect(first.tiles[0].key).toBe(second.tiles[1].key);
  expect(first.tiles[1].key).toBe(second.tiles[0].key);
  expect(items).toHaveLength(4);
});

test.each([
  [240, 568, 2],
  [320, 568, 2],
  [375, 667, 2],
  [599, 900, 3],
  [600, 900, 3],
  [899, 900, 4],
  [900, 900, 4],
  [1279, 900, 6],
  [1280, 900, 6],
  [1440, 900, 7],
  [667, 375, 8],
  [850, 320, 12],
])(
  "a vertical wall at %s×%s fits exactly three rows before scrolling",
  (width, height, columns) => {
    const layout = getVerticalWallLayout(width, height);
    expect(layout.columns).toBe(columns);
    expect(layout.rowHeight * 3).toBeCloseTo(height);
    const wall = buildVerticalWall(films, layout);
    expect(wall.rows).toBeGreaterThan(3);
    const rowTops = wall.tiles
      .slice(0, columns * 4)
      .map((tile, index) => Math.floor(index / columns) * wall.rowHeight);
    expect(new Set(rowTops.filter((top) => top < height)).size).toBe(3);
    expect(rowTops[columns * 3]).toBeCloseTo(height);
    expect(wall.rowHeight).toBe(layout.rowHeight);
  },
);

test.each([
  [undefined, undefined],
  [null, null],
  [NaN, Infinity],
  [-1, 0],
  ["bad", "bad"],
])(
  "invalid vertical wall dimensions %s×%s recover a finite desktop layout",
  (width, height) => {
    expect(getVerticalWallLayout(width, height)).toEqual({
      columns: 7,
      rowHeight: 300,
    });
  },
);

test.each([
  [1, 1],
  [320, 160],
  [3840, 240],
  [100000, 100000],
])(
  "three visible rows in a %s×%s wall retain finite, bounded responsive columns",
  (width, height) => {
    const layout = getVerticalWallLayout(width, height);
    expect(Number.isInteger(layout.columns)).toBe(true);
    expect(layout.columns).toBeGreaterThanOrEqual(2);
    expect(layout.columns).toBeLessThanOrEqual(12);
    expect(layout.rowHeight).toBeGreaterThan(0);
    expect(layout.rowHeight * 3).toBeCloseTo(height);
  },
);

test.each([
  [0, 3],
  [1, 3],
  [2, 3],
  [4, 3],
  [5, 3],
  [6, 3],
  [7, 3],
  [15, 3],
  [16, 4],
])(
  "a vertical %s-result wall preserves fixed columns and %s tracks without fillers",
  (count, rows) => {
    const items = films.slice(0, count);
    const wall = buildVerticalWall(items, { columns: 5, rowHeight: 420.48 });
    expect(wall).toMatchObject({
      columns: 5,
      rows,
      rowHeight: 420.48,
      total: count,
    });
    expect(wall.tiles).toHaveLength(count);
    expect(
      wall.tiles.every((tile) => tile.columnSpan === 1 && tile.rowSpan === 1),
    ).toBe(true);
    expect(wall.tiles.every((tile, index) => tile.item === items[index])).toBe(
      true,
    );
    expect(
      wall.tiles.every(
        (tile) => !Object.prototype.hasOwnProperty.call(tile, "decorative"),
      ),
    ).toBe(true);
  },
);

test.each([[2, 1], [7, 2], [16, 4]])(
  "a content-sized %s-result wall uses %s occupied rows without resizing posters",
  (count, rows) => {
    const wall = buildVerticalWall(films.slice(0, count), {
      columns: 5, rowHeight: 300, contentSized: true,
    });
    expect(wall).toMatchObject({ columns: 5, rowHeight: 300, rows, total: count, contentSized: true });
    expect(wall.tiles).toHaveLength(count);
    expect(wall.tiles.every((tile) => tile.columnSpan === 1 && tile.rowSpan === 1)).toBe(true);
  },
);

test.each([2, 3, 4, 5, 7, 8, 12])(
  "a %s-column continuous wall reaches the complete catalog once with unchanged final-row tiles",
  (columns) => {
    const originals = JSON.stringify(films);
    const wall = buildVerticalWall(films, { columns, rowHeight: 320 });
    expect(wall.columns).toBe(columns);
    expect(wall.rows).toBe(Math.ceil(films.length / columns));
    expect(wall.total).toBe(films.length);
    expect(wall.tiles).toHaveLength(films.length);
    expect(wall.tiles.every((tile, index) => tile.item === films[index])).toBe(
      true,
    );
    expect(new Set(wall.tiles.map((tile) => tile.key)).size).toBe(films.length);
    expect(
      wall.tiles.every((tile) => tile.columnSpan === 1 && tile.rowSpan === 1),
    ).toBe(true);
    expect(JSON.stringify(films)).toBe(originals);
  },
);

test("continuous poster keys and references survive duplicates, sorting, and viewport changes", () => {
  const items = Object.freeze([
    classicFilms[0],
    classicFilms[0],
    null,
    openFilms[0],
  ]);
  const first = buildVerticalWall(items, getVerticalWallLayout(375, 667));
  const sorted = buildVerticalWall(
    [openFilms[0], classicFilms[0]],
    getVerticalWallLayout(1440, 900),
  );
  expect(first.total).toBe(2);
  expect(first.tiles.map((tile) => tile.item)).toEqual([
    classicFilms[0],
    openFilms[0],
  ]);
  expect(first.tiles[0].key).toBe(sorted.tiles[1].key);
  expect(first.tiles[1].key).toBe(sorted.tiles[0].key);
  expect(first.tiles[0].item).toBe(classicFilms[0]);
  expect(first.tiles[1].item).toBe(openFilms[0]);
  expect(items).toHaveLength(4);
});

test("empty and malformed vertical walls stay empty while layout defaults remain valid", () => {
  const expected = { tiles: [], columns: 7, rows: 3, rowHeight: 300, total: 0 };
  expect(buildVerticalWall([], null)).toEqual(expected);
  expect(buildVerticalWall(null, {})).toEqual(expected);
  expect(
    buildVerticalWall([null, {}, { id: "" }], {
      columns: Infinity,
      rowHeight: -1,
    }),
  ).toEqual(expected);
});

test("stacked sections retain separate fixed grids, omit empty groups, and deduplicate titles", () => {
  const originals = films.slice(0, 7);
  const wall = buildSectionedVerticalWall(
    [
      { id: "channels", title: "Channels", items: originals.slice(0, 4) },
      { id: "empty", title: "Empty", items: [] },
      { id: "shows", title: "Shows", items: originals.slice(3) },
    ],
    { columns: 3, rowHeight: 250 },
  );
  expect(wall.sections.map(({ id }) => id)).toEqual(["channels", "shows"]);
  expect(wall).toMatchObject({ columns: 3, rows: 6, total: 7, rowHeight: 250 });
  expect(wall.sections.map(({ wallPage }) => wallPage.total)).toEqual([4, 3]);
  expect(wall.tiles.map(({ item }) => item)).toEqual(originals);
  expect(wall.tiles[4]).toMatchObject({
    sectionId: "shows",
    wallRow: 3,
    wallColumn: 0,
    columnSpan: 1,
    rowSpan: 1,
  });
  expect(buildSectionedVerticalWall([], null)).toMatchObject({
    sections: [],
    tiles: [],
    rows: 3,
    total: 0,
  });
});

test("vertical keys follow columns across section boundaries and skip empty tracks", () => {
  const wall = buildSectionedVerticalWall(
    [
      { id: "channels", title: "Channels", items: films.slice(0, 6) },
      { id: "shows", title: "Shows", items: films.slice(6, 11) },
    ],
    { columns: 3, rowHeight: 250 },
  );
  expect(getVerticalWallNeighbor(wall, films[5].id, "ArrowDown")).toBe(
    films[8],
  );
  expect(getVerticalWallNeighbor(wall, films[8].id, "ArrowUp")).toBe(films[5]);
  expect(getVerticalWallNeighbor(wall, films[8].id, "ArrowDown")).toBe(
    films[10],
  );
  expect(getVerticalWallNeighbor(wall, films[5].id, "ArrowRight")).toBe(
    films[6],
  );
  expect(getVerticalWallNeighbor(wall, films[6].id, "ArrowLeft")).toBe(
    films[5],
  );
  expect(getVerticalWallNeighbor(wall, films[0].id, "ArrowUp")).toBeUndefined();
  expect(
    getVerticalWallNeighbor(wall, films[10].id, "ArrowDown"),
  ).toBeUndefined();
  expect(getVerticalWallNeighbor(wall, "missing", "ArrowDown")).toBeUndefined();
  expect(getVerticalWallNeighbor(wall, films[0].id, "Enter")).toBeUndefined();
});

test("ordinary wall keyboard navigation keeps the existing row offsets", () => {
  const wall = buildVerticalWall(films.slice(0, 10), {
    columns: 3,
    rowHeight: 250,
  });
  expect(getVerticalWallNeighbor(wall, films[1].id, "ArrowDown")).toBe(
    films[4],
  );
  expect(getVerticalWallNeighbor(wall, films[4].id, "ArrowUp")).toBe(films[1]);
});

test.each([
  [1440, 900, 3, 300],
  [1336, 852, 3, 284],
  [318, 796, 1, 796 / 3],
  [248, 528, 1, 176],
  [603, 343, 3, 343 / 3],
])(
  "landscape channels at %s×%s retain three visible rows of wide fixed cards",
  (width, height, columns, rowHeight) => {
    const layout = getVerticalWallLayout(width, height, { aspectRatio: 16 / 9 });
    expect(layout.columns).toBe(columns);
    expect(layout.rowHeight).toBeCloseTo(rowHeight);
    expect(layout.rowHeight * 3).toBeCloseTo(height);
    expect(width / layout.columns).toBeGreaterThan(layout.rowHeight);
    const wall = buildVerticalWall(films, layout);
    expect(wall.columns).toBe(columns);
    expect(wall.rowHeight).toBeCloseTo(rowHeight);
    expect(wall.rows).toBe(Math.ceil(films.length / columns));
    expect(wall.tiles.every((tile) => tile.columnSpan === 1 && tile.rowSpan === 1))
      .toBe(true);
    expect(wall.tiles.map((tile) => tile.item)).toEqual(films);
  },
);

test("extremely narrow landscape walls keep wide cards inside the viewport", () => {
  const layout = getVerticalWallLayout(168, 852, { aspectRatio: 16 / 9 });
  expect(layout).toEqual({ columns: 1, rowHeight: 94.5 });
  expect(168 / layout.columns).toBeGreaterThan(layout.rowHeight);
  expect(buildVerticalWall(films, layout).columns).toBe(1);
});

test("channel sections can use wide cells while shows retain their own portrait grid", () => {
  const items = films.slice(0, 9);
  const wall = buildSectionedVerticalWall(
    [
      {
        id: "channels",
        title: "Channels",
        items: items.slice(0, 4),
        layout: { columns: 1, rowHeight: 180 },
      },
      { id: "shows", title: "Shows", items: items.slice(4) },
    ],
    { columns: 3, rowHeight: 250 },
  );
  expect(wall.sections.map(({ wallPage }) => ({
    columns: wallPage.columns,
    rows: wallPage.rows,
    rowHeight: wallPage.rowHeight,
  }))).toEqual([
    { columns: 1, rows: 4, rowHeight: 180 },
    { columns: 3, rows: 3, rowHeight: 250 },
  ]);
  expect(wall.tiles.map(({ item }) => item)).toEqual(items);
  expect(wall.tiles[4]).toMatchObject({
    sectionId: "shows",
    wallRow: 4,
    wallColumn: 0,
    columnSpan: 1,
    rowSpan: 1,
  });
  expect(getVerticalWallNeighbor(wall, items[3].id, "ArrowDown")).toBe(items[5]);
  expect(getVerticalWallNeighbor(wall, items[5].id, "ArrowUp")).toBe(items[3]);
});

test.each([
  [318, 1, 156.375],
  [1336, 5, 140.4],
  [1621, 6, 142.59375],
  [3840, 14, 146.41071428571428],
])(
  "a %spx TV wall fits compact 16:9 cards with fixed gaps and padding",
  (width, columns, rowHeight) => {
    const layout = getChannelWallLayout(width);
    expect(layout).toMatchObject({ columns, gap: 12, padding: 20, compact: true });
    expect(layout.rowHeight).toBeCloseTo(rowHeight);
    const tileWidth = (width - 40 - (columns - 1) * 12) / columns;
    expect(tileWidth / layout.rowHeight).toBeCloseTo(16 / 9);
    expect(tileWidth).toBeGreaterThanOrEqual(230);
    expect(tileWidth).toBeLessThanOrEqual(280);
  },
);

test("short compact results keep their card dimensions without reserving blank rows", () => {
  const wall = buildVerticalWall(films.slice(0, 2), {
    columns: 5, rowHeight: 140.4, gap: 12, padding: 20, compact: true,
  });
  expect(wall).toMatchObject({
    columns: 5, rows: 1, rowHeight: 140.4, gap: 12, padding: 20, compact: true,
  });
  expect(wall.tiles.map(({ columnSpan, rowSpan }) => [columnSpan, rowSpan]))
    .toEqual([[1, 1], [1, 1]]);
});

test.each([318, 1336, 1621, 3840])(
  "all 100 channels survive a %spx compact grid and its keyboard navigation",
  (width) => {
    const channels = Object.freeze(Array.from({ length: 100 }, (_, index) =>
      Object.freeze({ id: `channel-${index}` })));
    const wall = buildSectionedVerticalWall([
      { id: "channels", title: "Channels", items: channels, layout: getChannelWallLayout(width) },
      { id: "shows", title: "Shows", items: [] },
    ], { columns: 7, rowHeight: 300 });
    const page = wall.sections[0].wallPage;
    expect(page).toMatchObject({ compact: true, gap: 12, padding: 20, total: 100 });
    expect(page.rows).toBe(Math.ceil(100 / page.columns));
    expect(wall.tiles.map(({ item }) => item)).toEqual(channels);
    expect(new Set(wall.tiles.map(({ key }) => key)).size).toBe(100);
    expect(wall.tiles.every(({ columnSpan, rowSpan }) => columnSpan === 1 && rowSpan === 1))
      .toBe(true);
    expect(getVerticalWallNeighbor(wall, channels[0].id, "ArrowDown"))
      .toBe(channels[page.columns]);
    expect(getVerticalWallNeighbor(wall, channels[page.columns].id, "ArrowUp"))
      .toBe(channels[0]);
  },
);
