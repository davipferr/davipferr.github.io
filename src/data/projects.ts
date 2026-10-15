// Every content/projects/*.json is bundled at build time. Adding a project
// means adding a file; no code here changes.
import { CATEGORIES, type Category, type Profile, type Project } from './types';
import profileJson from '../../content/profile.json';
import { assignZodiac } from './zodiac';

const modules = import.meta.glob<Project>('../../content/projects/*.json', { eager: true, import: 'default' });

/** Featured first, then newest first, then by title. */
export function sortProjects(list: Project[]): Project[] {
  return [...list].sort(
    (a, b) =>
      Number(!!b.featured) - Number(!!a.featured) ||
      b.date.localeCompare(a.date) ||
      a.title.localeCompare(b.title),
  );
}

export const projects: Project[] = sortProjects(Object.values(modules));
export const profile = profileJson as Profile;
/** Which projects sit on a zodiac constellation star. */
export const zodiac = assignZodiac(projects);

export const bySlug = (slug: string) => projects.find((p) => p.slug === slug);

/** Categories that actually have projects, in schema order. */
export function usedCategories(list: Project[]): Category[] {
  const set = new Set(list.map((p) => p.category));
  return CATEGORIES.filter((c) => set.has(c));
}

/** Tags by how many projects use them, most common first. */
export function tagCounts(list: Project[]): [string, number][] {
  const m = new Map<string, number>();
  for (const p of list) for (const t of p.tags) m.set(t, (m.get(t) ?? 0) + 1);
  return [...m].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
}

/** Resolve a path inside public/ against Vite's base URL. */
export const asset = (p: string) => import.meta.env.BASE_URL + p;
