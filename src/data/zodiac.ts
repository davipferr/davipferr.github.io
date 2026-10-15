// Zodiac constellations a project can join with `"constellation": "<id>"`.
// Each constellation has a fixed number of stars; projects fill them in
// order and any extra projects are shown the normal way, by category.
import type { Project, Text } from './types';
import data from './zodiac.json';

export interface Zodiac {
  id: string;
  name: Text;
  /** [x, y] in a 0..1 box, brightest star first. */
  stars: [number, number][];
  lines: [number, number][];
}

export const ZODIAC = data.constellations as Zodiac[];
export const zodiacById = (id: string) => ZODIAC.find((z) => z.id === id);

export interface Seat {
  zodiac: Zodiac;
  /** Index into zodiac.stars. */
  star: number;
}

export interface ZodiacAssignment {
  /** Projects that got a star, by slug. */
  seats: Map<string, Seat>;
  /** For each constellation in use: which project sits on each star (null = empty). */
  occupants: Map<string, (Project | null)[]>;
}

/**
 * Who gets which star: featured projects first, then the oldest, so adding a
 * new project never moves an existing one off its star. Must match the
 * overflow warning in scripts/validate.mjs.
 */
export function assignZodiac(projects: Project[]): ZodiacAssignment {
  const seats = new Map<string, Seat>();
  const occupants = new Map<string, (Project | null)[]>();
  const order = [...projects].sort(
    (a, b) => Number(!!b.featured) - Number(!!a.featured) || a.date.localeCompare(b.date) || a.slug.localeCompare(b.slug),
  );
  for (const p of order) {
    const zodiac = p.constellation && zodiacById(p.constellation);
    if (!zodiac) continue;
    const row = occupants.get(zodiac.id) ?? zodiac.stars.map(() => null);
    occupants.set(zodiac.id, row);
    const star = row.indexOf(null);
    if (star === -1) continue; // constellation full: shown by category instead
    row[star] = p;
    seats.set(p.slug, { zodiac, star });
  }
  return { seats, occupants };
}
