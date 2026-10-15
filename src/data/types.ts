// Mirrors content/project.schema.json. The schema is the source of truth
// (it is what `npm run validate` and Project Launcher check against).

export type Lang = 'en' | 'pt';
export type Text = Record<Lang, string>;

export const CATEGORIES = ['3d', 'web', 'desktop', 'data', 'tools', 'backend', 'other'] as const;
export type Category = (typeof CATEGORIES)[number];

export interface Project {
  slug: string;
  title: string;
  tagline: Text;
  description: Text;
  category: Category;
  tags: string[];
  repoUrl?: string;
  liveUrl?: string;
  cover?: string;
  images?: string[];
  featured?: boolean;
  /** Zodiac constellation id (see src/data/zodiac.json). */
  constellation?: string;
  date: string;
  status?: 'active' | 'finished' | 'archived';
}

export interface Profile {
  name: string;
  role: Text;
  intro: Text;
  about: Text;
  links: { github?: string; linkedin?: string; email?: string; [k: string]: string | undefined };
}
