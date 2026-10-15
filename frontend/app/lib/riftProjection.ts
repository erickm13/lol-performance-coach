export type MapPoint = { x: number; y: number };
export const RIFT_IMAGE_SIZE = { width: 1400, height: 964 };
const WORLD_SCALE = 15000;

// World: RiotTuxedo's match-v5 timeline example and RiotGames issue #520.
// Image: ground contact points measured on public/maps/rift-template.png.
// These measurements calibrate this illustration, not arbitrary map assets.
// https://gist.github.com/RiotTuxedo/ab04ac027546f711ce820faed394295b
// https://github.com/RiotGames/developer-relations/issues/520
export const RIFT_LANDMARKS = [
  {
    id: "blue-top-outer",
    teamId: 100,
    world: { x: 981, y: 10441 },
    image: { x: 315, y: 241 },
  },
  {
    id: "blue-top-inner",
    teamId: 100,
    world: { x: 1512, y: 6699 },
    image: { x: 326, y: 425 },
  },
  {
    id: "blue-mid-outer",
    teamId: 100,
    world: { x: 5846, y: 6396 },
    image: { x: 591, y: 430 },
  },
  {
    id: "blue-mid-inner",
    teamId: 100,
    world: { x: 5048, y: 4812 },
    image: { x: 535, y: 519 },
  },
  {
    id: "blue-bot-inner",
    teamId: 100,
    world: { x: 6919, y: 1483 },
    image: { x: 661, y: 720 },
  },
  {
    id: "blue-bot-outer",
    teamId: 100,
    world: { x: 10504, y: 1029 },
    image: { x: 919, y: 748 },
  },
  {
    id: "red-mid-outer",
    teamId: 200,
    world: { x: 8955, y: 8510 },
    image: { x: 771, y: 332 },
  },
  {
    id: "red-mid-inner",
    teamId: 200,
    world: { x: 9767, y: 10113 },
    image: { x: 813, y: 260 },
  },
  {
    id: "red-top-outer",
    teamId: 200,
    world: { x: 4318, y: 13875 },
    image: { x: 514, y: 116 },
  },
] as const;

function fitProjection(): number[] {
  // Least squares homography (eight unknowns). Normalized coordinates keep
  // the small system well conditioned. Fit once, not once per marker/render.
  const equations = RIFT_LANDMARKS.flatMap(({ world, image }) => {
    const u = world.x / WORLD_SCALE, v = world.y / WORLD_SCALE;
    const x = image.x / RIFT_IMAGE_SIZE.width;
    const y = image.y / RIFT_IMAGE_SIZE.height;
    return [
      { a: [u, v, 1, 0, 0, 0, -x * u, -x * v], b: x },
      { a: [0, 0, 0, u, v, 1, -y * u, -y * v], b: y },
    ];
  });
  const matrix = Array.from({ length: 8 }, (_, i) => [
    ...Array.from(
      { length: 8 },
      (_, j) => equations.reduce((sum, row) => sum + row.a[i] * row.a[j], 0),
    ),
    equations.reduce((sum, row) => sum + row.a[i] * row.b, 0),
  ]);
  for (let i = 0; i < 8; i++) {
    let pivot = i;
    for (let row = i + 1; row < 8; row++) {
      if (Math.abs(matrix[row][i]) > Math.abs(matrix[pivot][i])) pivot = row;
    }
    if (Math.abs(matrix[pivot][i]) < 1e-12) {
      throw new Error(
        "Las referencias del mapa no permiten calibrar la proyección",
      );
    }
    [matrix[i], matrix[pivot]] = [matrix[pivot], matrix[i]];
    const divisor = matrix[i][i];
    matrix[i] = matrix[i].map((value) => value / divisor);
    for (let row = 0; row < 8; row++) {
      if (row === i) continue;
      const factor = matrix[row][i];
      matrix[row] = matrix[row].map((value, j) =>
        value - factor * matrix[i][j]
      );
    }
  }
  return matrix.map((row) => row[8]);
}
const projection = fitProjection();

/** Riot ground coordinates -> percentages of this illustration's image box. */
export function projectToTemplate(point: MapPoint): MapPoint {
  const u = point.x / WORLD_SCALE, v = point.y / WORLD_SCALE;
  const [a, b, c, d, e, f, g, h] = projection;
  const divisor = g * u + h * v + 1;
  return {
    x: 100 * (a * u + b * v + c) / divisor,
    y: 100 * (d * u + e * v + f) / divisor,
  };
}
