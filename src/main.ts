import './style.css';
import type { Category } from './data/types';
import { profile, projects } from './data/projects';
import { Constellation } from './hero/constellation';
import { categoryLabel, lang, setLang, t, tr } from './i18n';
import { esc } from './views/components';
import { filtersBar, grid, heroText, homeView, type Filters } from './views/home';
import { projectView } from './views/project';

const $ = <T extends HTMLElement>(sel: string) => document.querySelector<T>(sel)!;
const header = $('#site-header');
const hero = $('#hero');
const sky = $('#sky');
const heroCopy = $('#hero-text');
const view = $('#view');
const footer = $('#site-footer');

const filters: Filters = { category: 'all', tag: null };
let showAllTags = false;
let constellation: Constellation | null = null;

// Routes: #/  #/projects?tag=x&cat=y  #/about  #/contact  #/p/<slug>
function parseRoute() {
  const [path, query = ''] = location.hash.replace(/^#/, '').split('?');
  const params = new URLSearchParams(query);
  const m = path.match(/^\/p\/([a-z0-9-]+)$/);
  if (m) return { name: 'project' as const, slug: m[1] };
  const section = path.replace(/^\//, '');
  return { name: 'home' as const, section: ['projects', 'about', 'contact'].includes(section) ? section : null, params };
}

function renderHeader() {
  const other = lang === 'en' ? 'pt' : 'en';
  const handle = profile.links.github?.split('/').pop() ?? profile.name.split(' ')[0].toLowerCase();
  header.innerHTML = `<a class="brand" href="#/"><i class="dot"></i>${esc(handle)}</a>
    <nav aria-label="Main">
      <a href="#/projects">${t('navProjects')}</a>
      <a href="#/about">${t('navAbout')}</a>
      <a href="#/contact">${t('navContact')}</a>
      <button type="button" class="lang" data-lang="${other}" title="${t('switchLang')}" aria-label="${t('switchLang')}">${other.toUpperCase()}</button>
    </nav>`;
  footer.innerHTML = `<p>© ${new Date().getFullYear()} ${esc(profile.name)} · ${t('builtWith')}</p>`;
}

function ensureConstellation() {
  if (constellation || hero.classList.contains('no-webgl')) return;
  try {
    constellation = new Constellation(sky, projects, {
      onSelect: (p) => (location.hash = `#/p/${p.slug}`),
      tooltip: (p) => `<strong>${esc(p.title)}</strong><span>${esc(tr(p.tagline))}</span>`,
      categoryLabel: (c: Category) => categoryLabel(c),
    });
  } catch (err) {
    console.warn('WebGL unavailable, showing the static hero instead.', err);
    hero.classList.add('no-webgl');
  }
}

function render() {
  const route = parseRoute();
  if (route.name === 'project') {
    hero.hidden = true;
    constellation?.stop();
    view.innerHTML = projectView(route.slug);
    document.title = `${projects.find((p) => p.slug === route.slug)?.title ?? t('notFound')} · ${profile.name}`;
    window.scrollTo({ top: 0 });
    return;
  }

  const tag = route.params.get('tag');
  const cat = route.params.get('cat');
  if (tag !== null || cat !== null) {
    filters.tag = tag || null;
    filters.category = (cat as Category) || 'all';
  }

  hero.hidden = false;
  heroCopy.innerHTML = heroText();
  view.innerHTML = homeView(filters, showAllTags);
  document.title = `${profile.name} · ${tr(profile.role)}`;
  ensureConstellation();
  constellation?.resize();
  constellation?.start();

  const target = route.section && document.getElementById(route.section);
  requestAnimationFrame(() => (target ? target.scrollIntoView({ behavior: 'smooth' }) : window.scrollTo({ top: 0 })));
}

function rerenderFilters() {
  $('#filters').outerHTML = filtersBar(filters, showAllTags);
  $('#project-grid').innerHTML = grid(filters);
}

view.addEventListener('click', (e) => {
  const el = (e.target as HTMLElement).closest<HTMLElement>('[data-cat],[data-tag],[data-more],[data-clear]');
  if (!el) return;
  if (el.dataset.cat) filters.category = el.dataset.cat as Filters['category'];
  else if (el.dataset.tag) filters.tag = filters.tag === el.dataset.tag ? null : el.dataset.tag;
  else if ('more' in el.dataset) showAllTags = !showAllTags;
  else if ('clear' in el.dataset) Object.assign(filters, { category: 'all', tag: null });
  rerenderFilters();
});

header.addEventListener('click', (e) => {
  const btn = (e.target as HTMLElement).closest<HTMLElement>('[data-lang]');
  if (!btn) return;
  setLang(btn.dataset.lang as 'en' | 'pt');
  renderHeader();
  const y = window.scrollY;
  const route = parseRoute();
  if (route.name === 'project') view.innerHTML = projectView(route.slug);
  else {
    heroCopy.innerHTML = heroText();
    view.innerHTML = homeView(filters, showAllTags);
  }
  constellation?.refreshText();
  window.scrollTo({ top: y });
});

// Clicking a link to the hash we're already on fires no hashchange; still scroll.
document.addEventListener('click', (e) => {
  const a = (e.target as HTMLElement).closest('a');
  if (a && a.getAttribute('href') === location.hash) {
    e.preventDefault();
    render();
  }
});

setLang(lang);
renderHeader();
window.addEventListener('hashchange', render);
render();
