import { describe, expect, it } from 'vitest';
import type { Project } from '../src/data/types';
import { layoutConstellation } from '../src/hero/layout';
import { sortProjects } from '../src/data/projects';

const make = (slug: string, category: Project['category'], tags: string[], extra: Partial<Project> = {}): Project => ({
  slug,
  title: slug,
  tagline: { en: slug, pt: slug },
  description: { en: slug, pt: slug },
  category,
  tags,
  date: '2026-01-01',
  ...extra,
});

describe('layoutConstellation', () => {
  const base = [
    make('a', '3d', ['ts', 'geo']),
    make('b', '3d', ['ts', 'geo']),
    make('c', 'tools', ['ts', 'node']),
    make('d', 'desktop', ['ts', 'node']),
  ];

  it('keeps a project in place when another project is added to a different category', () => {
    const pos = (l: ReturnType<typeof layoutConstellation>) => l.nodes.find((n) => n.project.slug === 'd')!.position;
    const before = layoutConstellation(base);
    const after = layoutConstellation([...base, make('e', '3d', ['ts'])]);
    expect(after.nodes).toHaveLength(5);
    expect(pos(after)).toEqual(pos(before));
  });

  it('links same-category siblings and projects sharing an uncommon tag, never via ubiquitous tags', () => {
    const { edges, nodes } = layoutConstellation(base);
    const names = edges.map(([i, j]) => [nodes[i].project.slug, nodes[j].project.slug].sort().join('-'));
    expect(names).toContain('a-b'); // same category + "geo"
    expect(names).toContain('c-d'); // share "node"
    expect(names).not.toContain('a-c'); // only share "ts", which every project has
  });

  it('keeps stars apart', () => {
    const many = Array.from({ length: 20 }, (_, i) => make(`p${i}`, '3d', []));
    const { nodes } = layoutConstellation(many);
    for (let i = 0; i < nodes.length; i++)
      for (let j = i + 1; j < nodes.length; j++)
        expect(Math.hypot(...nodes[i].position.map((v, k) => v - nodes[j].position[k]))).toBeGreaterThan(0.8);
  });
});

describe('sortProjects', () => {
  it('puts featured first, then newest', () => {
    const list = sortProjects([
      make('old', 'web', [], { date: '2020-01-01' }),
      make('new', 'web', [], { date: '2026-05-01' }),
      make('star', 'web', [], { date: '2019-01-01', featured: true }),
    ]);
    expect(list.map((p) => p.slug)).toEqual(['star', 'new', 'old']);
  });
});
