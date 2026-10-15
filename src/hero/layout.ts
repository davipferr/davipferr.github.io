// Pure layout for the constellation: where each project sits and which ones
// are linked. No Three.js here so it can be unit-tested.
//
// Positions are seeded by slug, so a project keeps its place when others are
// added; only its own category's cluster grows.
import type { Category, Project } from '../data/types';
import { usedCategories } from '../data/projects';

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
  category: Category;
  center: Vec3;
  radius: number;
  /** Where the category name goes: just above the cluster's highest star. */
  label: Vec3;
}

export interface Layout {
  nodes: StarNode[];
  edges: [number, number][];
  clusters: Cluster[];
  /** Radius of a sphere around the origin that contains every node. */
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

export function layoutConstellation(projects: Project[]): Layout {
  const cats = usedCategories(projects);
  const ringRadius = cats.length > 1 ? 5 + cats.length * 1.4 : 0;

  const clusters: Cluster[] = cats.map((category, i) => {
    const angle = (i / cats.length) * Math.PI * 2 + 0.4;
    const r = rng(hash(category));
    const count = projects.filter((p) => p.category === category).length;
    return {
      category,
      center: [Math.cos(angle) * ringRadius, (r() - 0.5) * 2.5, Math.sin(angle) * ringRadius],
      radius: 1.5 + Math.sqrt(count) * 0.9,
      label: [0, 0, 0],
    };
  });

  const nodes: StarNode[] = projects.map((project) => {
    const c = clusters.find((cl) => cl.category === project.category)!;
    const r = rng(hash(project.slug));
    // uniform point in a sphere around the cluster center
    const u = r() * 2 - 1;
    const phi = r() * Math.PI * 2;
    const rad = c.radius * Math.cbrt(r());
    const s = Math.sqrt(1 - u * u);
    return {
      project,
      position: [c.center[0] + rad * s * Math.cos(phi), c.center[1] + rad * u, c.center[2] + rad * s * Math.sin(phi)],
      color: CATEGORY_COLORS[project.category],
      size: project.featured ? 1.5 : 1,
    };
  });

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

  for (const c of clusters) {
    const ps = nodes.filter((n) => n.project.category === c.category).map((n) => n.position);
    const mean = (k: number) => ps.reduce((sum, p) => sum + p[k], 0) / ps.length;
    c.label = [mean(0), Math.max(...ps.map((p) => p[1])) + 0.9, mean(2)];
  }

  const edges = new Map<string, [number, number]>();
  const add = (i: number, j: number) => {
    if (i === j) return;
    const [a, b] = i < j ? [i, j] : [j, i];
    edges.set(`${a}-${b}`, [a, b]);
  };

  // 1. Inside a category: link each star to its nearest sibling.
  nodes.forEach((n, i) => {
    let best = -1, bestD = Infinity;
    nodes.forEach((m, j) => {
      if (i === j || m.project.category !== n.project.category) return;
      const d = dist(n.position, m.position);
      if (d < bestD) [best, bestD] = [j, d];
    });
    if (best >= 0) add(i, best);
  });

  // 2. Across the sky: link projects that share an uncommon tag. Tags most
  //    projects use (e.g. "typescript") would just connect everything.
  const counts = new Map<string, number>();
  for (const p of projects) for (const t of p.tags) counts.set(t, (counts.get(t) ?? 0) + 1);
  const rare = Math.max(3, Math.ceil(projects.length * 0.15));
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const shared = nodes[i].project.tags.filter((t) => nodes[j].project.tags.includes(t) && counts.get(t)! <= rare);
      if (shared.length) add(i, j);
    }
  }

  const extent = nodes.reduce((m, n) => Math.max(m, Math.hypot(...n.position)), 0) + 1;
  return { nodes, edges: [...edges.values()], clusters, extent };
}
