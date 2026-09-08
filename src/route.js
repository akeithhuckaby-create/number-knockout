// The same graph drives the visible trail, movement, wall placement, and distance.
export const ROUTE_ID = "winding-valley-v1";
export const DRAGON_POS = 30;
export const ENTRY_POSITIONS = [1, 2];
export const GATE = { id: 0, x: 62, y: 835 };
export const LAIR = { id: DRAGON_POS, x: 915, y: 100 };
export const ROUTE_NODES = [
  [1, 165, 840],
  [2, 115, 730],
  [3, 235, 750],
  [4, 340, 795],
  [5, 455, 805],
  [6, 565, 765],
  [7, 650, 680],
  [8, 700, 590],
  [9, 285, 645],
  [10, 395, 625],
  [11, 515, 665],
  [12, 620, 510],
  [13, 510, 485],
  [14, 395, 515],
  [15, 285, 490],
  [16, 180, 440],
  [17, 155, 340],
  [18, 220, 255],
  [19, 330, 235],
  [20, 440, 255],
  [21, 540, 285],
  [22, 335, 395],
  [23, 405, 335],
  [24, 635, 310],
  [25, 735, 355],
  [26, 785, 450],
  [27, 880, 485],
  [28, 945, 410],
  [29, 935, 310],
  [32, 855, 255],
  [33, 745, 240],
  [34, 675, 155],
  [35, 775, 75],
  [36, 810, 175],
].map(([id, x, y]) => ({ id, x, y, tilt: ((id * 7) % 9) - 4 }));
export const ROUTE_EDGES = [
  [0, 1],
  [0, 2],
  [1, 3],
  [2, 3],
  [3, 4],
  [4, 5],
  [5, 6],
  [6, 7],
  [3, 9],
  [9, 10],
  [10, 11],
  [11, 7],
  [7, 8],
  [8, 12],
  [12, 13],
  [13, 14],
  [14, 15],
  [15, 16],
  [16, 17],
  [17, 18],
  [18, 19],
  [19, 20],
  [14, 22],
  [22, 23],
  [23, 20],
  [20, 21],
  [21, 24],
  [24, 25],
  [25, 26],
  [26, 27],
  [27, 28],
  [28, 29],
  [29, 32],
  [32, 33],
  [33, 34],
  [21, 34],
  [34, 35],
  [34, 36],
  [35, 30],
  [36, 30],
];
export const POSITIONS = new Set(ROUTE_NODES.map((n) => n.id));
export const ROUTE_POINTS = new Map(
  [GATE, LAIR, ...ROUTE_NODES].map((n) => [n.id, n]),
);
const adjacency = new Map([...ROUTE_POINTS.keys()].map((p) => [p, []]));
for (const [a, b] of ROUTE_EDGES) {
  adjacency.get(a).push(b);
  adjacency.get(b).push(a);
}
export function neighbours(pos) {
  return [...(adjacency.get(pos) || [])].filter((n) => n !== 0);
}
const distance = new Map([[DRAGON_POS, 0]]),
  queue = [DRAGON_POS];
for (const p of queue)
  for (const n of adjacency.get(p))
    if (!distance.has(n)) {
      distance.set(n, distance.get(p) + 1);
      queue.push(n);
    }
export const stepsToLair = (pos) => distance.get(pos) ?? null;
export function edgePath(a, b) {
  const p = ROUTE_POINTS.get(a),
    q = ROUTE_POINTS.get(b);
  return `M ${p.x} ${p.y} L ${q.x} ${q.y}`;
}
