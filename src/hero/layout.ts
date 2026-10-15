// Pure layout for the constellation: where each project sits and which ones
// are linked. No Three.js here so it can be unit-tested.
//
// Positions are seeded by slug, so a project keeps its place when others are
// added; only its own category's cluster grows. Projects placed in a zodiac
// constellation sit on that figure's stars instead of in their category.
import type { Category, Project } from '../data/types';
import { usedCategories } from '../data/projects';
import { assignZodiac, ZODIAC, type Zodiac } from '../data/zodiac';

export type Vec3 = [number, number, number];

export const CATEGORY_COLORS: Record<Category, string> = {
  '3d': '#5ad1ff',
  web: '#a78bfa',
  desktop: '#fbbf24',
  data: '#34d399',
  tools: '#f472b6',
  backend: '#fb923c',
  other: '#94a3b8',
};

export interface StarNode {
  project: Project;
  position: Vec3;
  color: string;
  size: number;
}

export interface Cluster {
  kind: 'category' | 'zodiac';
  /** For zodiac clusters: index into Layout.figures. */
  figure?: number;
  /** Category id or zodiac id. */
  id: string;
  /** Where the name goes: just above the cluster's highest star. */
  label: Vec3;
  /** Indices into Layout.nodes. */
  members: number[];
}

/** A zodiac constellation drawn in the sky, including its empty stars. */
export interface ZodiacFigure {
  zodiac: Zodiac;
  center: Vec3;
  /** Star offsets from the center in the figure's own plane (x right, y up, z = 0).
   *  The figure is drawn as a billboard that always faces the viewer. */
  offsets: Vec3[];
  /** center + offsets, i.e. the figure as seen from the front. */
  stars: Vec3[];
  /** Node index sitting on each star, or -1 when the star is still free. */
  occupant: number[];
}

export interface Layout {
  nodes: StarNode[];
  /** Links between category stars (zodiac stars use their figure's lines). */
  edges: [number, number][];
  clusters: Cluster[];
  figures: ZodiacFigure[];
  /** Radius of a sphere around the origin that contains every star. */
  extent: number;
}

/** FNV-1a: stable 32-bit hash of a string. */
export function hash(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** mulberry32: small seeded PRNG returning [0, 1). */
export function rng(seed: number) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const dist = (a: Vec3, b: Vec3) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

const FIGURE_SIZE = 9;

export function layoutConstellation(projects: Project[]): Layout {
  const { seats } = assignZodiac(projects);
  const loose = projects.filter((p) => !seats.has(p.slug));
  const cats = usedCategories(loose);
  const ringRadius = cats.length > 1 ? 5 + cats.length * 1.4 : 0;

  const centers = new Map<string, { center: Vec3; radius: number }>();
  cats.forEach((category, i) => {
    const angle = (i / cats.length) * Math.PI * 2 + 0.4;
    const r = rng(hash(category));
    const count = loose.filter((p) => p.category === category).length;
    centers.set(category, {
      center: [Math.cos(angle) * ringRadius, (r() - 0.5) * 2.5, Math.sin(angle) * ringRadius],
      radius: 1.5 + Math.sqrt(count) * 0.9,
    });
  });

  const nodes: StarNode[] = [];
  const nodeOf = new Map<string, number>();
  for (const project of loose) {
    const c = centers.get(project.category)!;
    const r = rng(hash(project.slug));
    // uniform point in a sphere around the cluster center
    const u = r() * 2 - 1;
    const phi = r() * Math.PI * 2;
    const rad = c.radius * Math.cbrt(r());
    const s = Math.sqrt(1 - u * u);
    nodeOf.set(project.slug, nodes.length);
    nodes.push({
      project,
      position: [c.center[0] + rad * s * Math.cos(phi), c.center[1] + rad * u, c.center[2] + rad * s * Math.sin(phi)],
      color: CATEGORY_COLORS[project.category],
      size: project.featured ? 1.5 : 1,
    });
  }

  // A few deterministic relaxation passes so stars don't sit on top of each other.
  const minDist = 1.6;
  for (let pass = 0; pass < 20; pass++) {
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const a = nodes[i].position, b = nodes[j].position;
        const d = dist(a, b);
        if (d >= minDist) continue;
        const push = (minDist - d) / 2;
        const dir: Vec3 = d > 1e-6 ? [(b[0] - a[0]) / d, (b[1] - a[1]) / d, (b[2] - a[2]) / d] : [1, 0, 0];
        for (let k = 0; k < 3; k++) {
          a[k] -= dir[k] * push;
          b[k] += dir[k] * push;
        }
      }
    }
  }
  const categoryNodes = nodes.length;

  // Zodiac figures sit on an outer, higher ring, each at a fixed angle (in zodiac order).
  const used = ZODIAC.filter((z) => [...seats.values()].some((s) => s.zodiac.id === z.id));
  const zodiacRadius = cats.length ? ringRadius + 5 : used.length > 1 ? 5 + used.length : 0;
  const figures: ZodiacFigure[] = used.map((zodiac) => {
    const angle = (ZODIAC.indexOf(zodiac) / ZODIAC.length) * Math.PI * 2 + 0.4 + Math.PI / ZODIAC.length;
    // lifted above the category clusters so the two never overlap on screen
    const lift = cats.length ? FIGURE_SIZE * 0.85 : 0;
    const center: Vec3 = [Math.cos(angle) * zodiacRadius, lift + Math.sin(angle * 2) * 1.2, Math.sin(angle) * zodiacRadius];
    const offsets = zodiac.stars.map(([x, y]): Vec3 => [(x - 0.5) * FIGURE_SIZE, (0.5 - y) * FIGURE_SIZE, 0]);
    const stars = offsets.map((o): Vec3 => [center[0] + o[0], center[1] + o[1], center[2] + o[2]]);
    return { zodiac, center, offsets, stars, occupant: stars.map(() => -1) };
  });
  for (const project of projects) {
    const seat = seats.get(project.slug);
    if (!seat) continue;
    const fig = figures.find((f) => f.zodiac.id === seat.zodiac.id)!;
    fig.occupant[seat.star] = nodes.length;
    nodeOf.set(project.slug, nodes.length);
    nodes.push({
      project,
      position: [...fig.stars[seat.star]],
      color: CATEGORY_COLORS[project.category],
      size: project.featured ? 1.5 : 1.15,
    });
  }

  const labelAbove = (ps: Vec3[]): Vec3 => {
    const mean = (k: number) => ps.reduce((sum, p) => sum + p[k], 0) / ps.length;
    return [mean(0), Math.max(...ps.map((p) => p[1])) + 0.9, mean(2)];
  };
  const clusters: Cluster[] = [
    ...cats.map((category): Cluster => {
      const members = nodes.map((n, i) => (i < categoryNodes && n.project.category === category ? i : -1)).filter((i) => i >= 0);
      return { kind: 'category', id: category, members, label: labelAbove(members.map((i) => nodes[i].position)) };
    }),
    ...figures.map((f, i): Cluster => ({
      kind: 'zodiac',
      figure: i,
      id: f.zodiac.id,
      members: f.occupant.filter((i) => i >= 0),
      label: [f.center[0], f.center[1] + Math.max(...f.offsets.map((o) => o[1])) + 0.9, f.center[2]],
    })),
  ];

  const edges = new Map<string, [number, number]>();
  const add = (i: number, j: number) => {
    if (i === j) return;
    const [a, b] = i < j ? [i, j] : [j, i];
    edges.set(`${a}-${b}`, [a, b]);
  };

  // 1. Inside a category: link each star to its nearest sibling.
  for (let i = 0; i < categoryNodes; i++) {
    let best = -1, bestD = Infinity;
    for (let j = 0; j < categoryNodes; j++) {
      if (i === j || nodes[j].project.category !== nodes[i].project.category) continue;
      const d = dist(nodes[i].position, nodes[j].position);
      if (d < bestD) [best, bestD] = [j, d];
    }
    if (best >= 0) add(i, best);
  }

  // 2. Across the sky: link projects that share an uncommon tag. Tags most
  //    projects use (e.g. "typescript") would just connect everything.
  const counts = new Map<string, number>();
  for (const p of projects) for (const t of p.tags) counts.set(t, (counts.get(t) ?? 0) + 1);
  const rare = Math.max(3, Math.ceil(projects.length * 0.15));
  for (let i = 0; i < categoryNodes; i++) {
    for (let j = i + 1; j < categoryNodes; j++) {
      const shared = nodes[i].project.tags.filter((t) => nodes[j].project.tags.includes(t) && counts.get(t)! <= rare);
      if (shared.length) add(i, j);
    }
  }

  const all = [...nodes.map((n) => n.position), ...figures.flatMap((f) => f.stars)];
  const extent = all.reduce((m, p) => Math.max(m, Math.hypot(...p)), 0) + 1;
  return { nodes, edges: [...edges.values()], clusters, figures, extent };
}
