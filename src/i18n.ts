import type { Category, Lang, Text } from './data/types';

const UI = {
  navProjects: { en: 'Projects', pt: 'Projetos' },
  navAbout: { en: 'About', pt: 'Sobre' },
  navContact: { en: 'Contact', pt: 'Contato' },
  heroHint: { en: 'Each star is a project. Drag to rotate, hover to look, click to open.', pt: 'Cada estrela é um projeto. Arraste para girar, passe o mouse para ver, clique para abrir.' },
  heroHintTouch: { en: 'Each star is a project. Tap one to open it.', pt: 'Cada estrela é um projeto. Toque em uma para abrir.' },
  seeProjects: { en: 'See projects', pt: 'Ver projetos' },
  viewAs: { en: 'View as', pt: 'Ver como' },
  viewSky: { en: 'Constellation', pt: 'Constelação' },
  viewCards: { en: 'Cards', pt: 'Cards' },
  allProjects: { en: 'All projects', pt: 'Todos os projetos' },
  all: { en: 'All', pt: 'Todos' },
  searchTags: { en: 'Filter by tag…', pt: 'Filtrar por tag…' },
  noResults: { en: 'No project matches these filters.', pt: 'Nenhum projeto corresponde a esses filtros.' },
  clearFilters: { en: 'Clear filters', pt: 'Limpar filtros' },
  about: { en: 'About', pt: 'Sobre' },
  contact: { en: 'Contact', pt: 'Contato' },
  contactText: { en: 'Find me on GitHub, where every project here lives.', pt: 'Me encontre no GitHub, onde todos os projetos daqui estão.' },
  liveDemo: { en: 'Live demo', pt: 'Demo ao vivo' },
  source: { en: 'Source code', pt: 'Código-fonte' },
  back: { en: 'All projects', pt: 'Todos os projetos' },
  previous: { en: 'Previous', pt: 'Anterior' },
  next: { en: 'Next', pt: 'Próximo' },
  started: { en: 'Started', pt: 'Início' },
  status: { en: 'Status', pt: 'Status' },
  category: { en: 'Category', pt: 'Categoria' },
  notFound: { en: 'Project not found.', pt: 'Projeto não encontrado.' },
  projectsCount: { en: '{n} projects', pt: '{n} projetos' },
  builtWith: { en: 'Built with TypeScript, Vite and Three.js.', pt: 'Feito com TypeScript, Vite e Three.js.' },
  switchLang: { en: 'Ver em português', pt: 'View in English' },
} satisfies Record<string, Text>;

const CATEGORY: Record<Category, Text> = {
  '3d': { en: '3D & WebGL', pt: '3D & WebGL' },
  web: { en: 'Web apps', pt: 'Apps web' },
  desktop: { en: 'Desktop', pt: 'Desktop' },
  data: { en: 'Data & viz', pt: 'Dados & viz' },
  tools: { en: 'Tools & libraries', pt: 'Ferramentas & libs' },
  backend: { en: 'Backend', pt: 'Backend' },
  other: { en: 'Other', pt: 'Outros' },
};

const STATUS: Record<string, Text> = {
  active: { en: 'In progress', pt: 'Em andamento' },
  finished: { en: 'Finished', pt: 'Concluído' },
  archived: { en: 'Archived', pt: 'Arquivado' },
};

const KEY = 'lang';

function initial(): Lang {
  try {
    const saved = localStorage.getItem(KEY);
    if (saved === 'en' || saved === 'pt') return saved;
  } catch {
    // storage blocked: fall through to the browser language
  }
  return navigator.language.toLowerCase().startsWith('pt') ? 'pt' : 'en';
}

export let lang: Lang = initial();

export function setLang(l: Lang) {
  lang = l;
  try {
    localStorage.setItem(KEY, l);
  } catch {
    // not persisted; fine
  }
  document.documentElement.lang = l === 'pt' ? 'pt-BR' : 'en';
}

export const t = (key: keyof typeof UI, vars: Record<string, string | number> = {}) =>
  UI[key][lang].replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? ''));
export const tr = (text: Text) => text[lang];
export const categoryLabel = (c: Category) => CATEGORY[c][lang];
export const statusLabel = (s: string) => STATUS[s]?.[lang] ?? s;

export function formatDate(iso: string) {
  const [y, m] = iso.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString(lang === 'pt' ? 'pt-BR' : 'en-US', { month: 'short', year: 'numeric' });
}
