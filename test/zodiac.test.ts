import { describe, expect, it } from 'vitest';
import type { Project } from '../src/data/types';
import { assignZodiac, ZODIAC, zodiacById } from '../src/data/zodiac';
import { layoutConstellation } from '../src/hero/layout';

const make = (slug: string, extra: Partial<Project> = {}): Project => ({
  slug,
  title: slug,
  tagline: { en: slug, pt: slug },
  description: { en: slug, pt: slug },
  category: 'web',
  tags: [],
  date: '2026-01-01',
  ...extra,
});

describe('zodiac data', () => {
  it('has the 12 constellations with valid lines', () => {
    expect(ZODIAC).toHaveLength(12);
    for (const z of ZODIAC) {
      for (const [a, b] of z.lines) {
        expect(z.stars[a], `${z.id} line ${a}-${b}`).toBeDefined();
        expect(z.stars[b], `${z.id} line ${a}-${b}`).toBeDefined();
      }
    }
  });
});

describe('assignZodiac', () => {
  const cancer = zodiacById('cancer')!; // 5 stars
  const members = Array.from({ length: 7 }, (_, i) =>
    make(`p${i}`, { constellation: 'cancer', date: `2026-0${i + 1}-01` }),
  );

  it('fills stars oldest first and leaves the extra projects out', () => {
    const { seats, occupants } = assignZodiac(members);
    expect(cancer.stars).toHaveLength(5);
    expect([...seats.keys()]).toEqual(['p0', 'p1', 'p2', 'p3', 'p4']);
    expect(seats.get('p0')!.star).toBe(0); // brightest star
    expect(occupants.get('cancer')!.every(Boolean)).toBe(true);
  });

  it('gives featured projects a star before older ones', () => {
    const list = [...members.slice(0, 6), make('star', { constellation: 'cancer', date: '2026-12-01', featured: true })];
    const { seats } = assignZodiac(list);
    expect(seats.get('star')?.star).toBe(0);
    expect(seats.has('p4')).toBe(false);
  });

  it('ignores projects without a known constellation', () => {
    expect(assignZodiac([make('a'), make('b', { constellation: 'ophiuchus' })]).seats.size).toBe(0);
  });
});

describe('layout with zodiac figures', () => {
  const list = [
    make('a', { constellation: 'leo', tags: ['rare'] }),
    make('b', { constellation: 'leo', tags: ['rare'] }),
    make('c', { tags: ['rare'] }),
    make('d', { tags: ['rare'] }),
  ];
  const layout = layoutConstellation(list);
  const node = (slug: string) => layout.nodes.findIndex((n) => n.project.slug === slug);

  it('puts zodiac projects on their figure stars and keeps the free stars', () => {
    const leo = layout.figures.find((f) => f.zodiac.id === 'leo')!;
    expect(leo.occupant.filter((i) => i >= 0)).toHaveLength(2);
    expect(leo.occupant.filter((i) => i < 0)).toHaveLength(zodiacById('leo')!.stars.length - 2);
    expect(layout.nodes[node('a')].position).toEqual(leo.stars[leo.occupant.indexOf(node('a'))]);
  });

  it('only links category stars with automatic edges', () => {
    const zodiacNodes = new Set([node('a'), node('b')]);
    expect(layout.edges.length).toBeGreaterThan(0);
    for (const [i, j] of layout.edges) expect(zodiacNodes.has(i) || zodiacNodes.has(j)).toBe(false);
  });

  it('labels the figure with the zodiac and the rest by category', () => {
    expect(layout.clusters.map((c) => `${c.kind}:${c.id}`).sort()).toEqual(['category:web', 'zodiac:leo']);
  });
});
