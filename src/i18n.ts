import type { Category, Lang, Text } from './data/types';

const UI = {
  navProjects: { en: 'Projects', pt: 'Projetos' },
  navAbout: { en: 'About', pt: 'Sobre' },
  navContact: { en: 'Contact', pt: 'Contato' },
  heroHint: { en: 'Point at a star to see which project it is, click to open it. Drag to turn the sky.', pt: 'Aponte para uma estrela para ver qual projeto ela é, clique para abrir. Arraste para girar o céu.' },
  heroHintTouch: { en: 'Tap a star to open its project. Swipe sideways to turn the sky.', pt: 'Toque em uma estrela para abrir o projeto. Deslize para o lado para girar o céu.' },
  seeProjects: { en: 'See projects', pt: 'Ver projetos' },
  allProjects: { en: 'Project catalogue', pt: 'Catálogo de projetos' },
  catalogueNote: { en: 'All {n} of them. Point at one to find its star in the sky. Stars in a zodiac figure are named by brightness, α first.', pt: 'Todos os {n}. Aponte para um para achar sua estrela no céu. Estrelas de uma figura do zodíaco são nomeadas por brilho, α primeiro.' },
  moreTags: { en: '{n} more tags', pt: 'mais {n} tags' },
  fewerTags: { en: 'Fewer tags', pt: 'Menos tags' },
  star: { en: 'Star', pt: 'Estrela' },
  starClaim: { en: 'projects so far, one star each.', pt: 'projetos até agora, uma estrela cada.' },
  all: { en: 'All', pt: 'Todos' },
  noResults: { en: 'No project matches these filters.', pt: 'Nenhum projeto corresponde a esses filtros.' },
  clearFilters: { en: 'Clear filters', pt: 'Limpar filtros' },
  about: { en: 'About', pt: 'Sobre' },
  contact: { en: 'Contact', pt: 'Contato' },
  contactText: { en: 'Want to talk about a project, an idea or an opportunity? Reach out.', pt: 'Quer conversar sobre um projeto, uma ideia ou uma oportunidade? Fale comigo.' },
  liveDemo: { en: 'Live demo', pt: 'Demo ao vivo' },
  source: { en: 'Source code', pt: 'Código-fonte' },
  back: { en: 'Back to the catalogue', pt: 'Voltar ao catálogo' },
  previous: { en: 'Previous', pt: 'Anterior' },
  next: { en: 'Next', pt: 'Próximo' },
  started: { en: 'Started', pt: 'Início' },
  status: { en: 'Status', pt: 'Status' },
  category: { en: 'Category', pt: 'Categoria' },
  notFound: { en: 'Project not found.', pt: 'Projeto não encontrado.' },
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
