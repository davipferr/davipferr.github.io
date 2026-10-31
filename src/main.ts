import './style.css';
import type { Category } from './data/types';
import { profile, projects } from './data/projects';
import { Constellation } from './hero/constellation';
import { zodiacById } from './data/zodiac';
import { categoryLabel, lang, setLang, t, tr } from './i18n';
import { esc } from './views/components';
import { filtersBar, grid, heroText, homeView, matches, skyHint, type Filters } from './views/home';
import { projectView } from './views/project';

const $ = <T extends HTMLElement>(sel: string) => document.querySelector<T>(sel)!;
const header = $('#site-header');
const hero = $('#hero');
const heroCopy = $('#hero-text');
const view = $('#view');
const footer = $('#site-footer');

const filters: Filters = { category: 'all', tag: null };
let showAllTags = false;
let constellation: Constellation | null = null;
let webgl = true;

// The sky sits behind the whole site, fixed, and is built once. Pages don't
// own it; they tell it where to look (scroll position, open project) and the
// copy around it is re-rendered freely (filters, language).
const skyView = document.createElement('div');
skyView.className = 'sky-view';
skyView.innerHTML = '<div class="sky-canvas"></div>';
const skyCanvas = skyView.querySelector<HTMLElement>('.sky-canvas')!;
const skyHintEl = document.createElement('p');
skyHintEl.className = 'sky-hint';
// The line from a hovered row in the list to its star.
const leader = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
leader.classList.add('leader');
leader.setAttribute('aria-hidden', 'true');
leader.innerHTML = '<path fill="none"/><circle r="16" fill="none"/>';
const leaderPath = leader.querySelector('path')!;
const leaderRing = leader.querySelector('circle')!;
/** Project whose row is hovered or focused in the list. */
let pointed: string | null = null;
let starsShown = -1;

const wide = () => matchMedia('(min-width: 1040px)').matches;
const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const lerp = (a: number, b: number, k: number) => a + (b - a) * k;

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
  footer.innerHTML = `<p>© ${new Date().getFullYear()} ${esc(profile.name)}. ${t('builtWith')}</p>`;
}

function ensureConstellation() {
  if (constellation || !webgl) return;
  try {
    constellation = new Constellation(skyCanvas, projects, {
      onSelect: (p) => (location.hash = `#/p/${p.slug}`),
      tooltip: (p) => `<strong>${esc(p.title)}</strong><span>${esc(tr(p.tagline))}</span>`,
      clusterLabel: (c) => (c.kind === 'zodiac' ? tr(zodiacById(c.id)!.name) : categoryLabel(c.id as Category)),
      onFrame: skyFrame,
    });
    document.body.prepend(skyView);
    document.body.append(leader);
    hero.append(skyHintEl);
    hero.classList.add('has-sky');
    constellation.resize(); // now that it's in the page and has a size
  } catch (err) {
    console.warn('WebGL unavailable, showing the catalogue only.', err);
    webgl = false;
  }
}

/** Runs after every sky frame: the opening star counter and the leader line. */
function skyFrame() {
  const n = constellation!.appearedCount();
  if (n !== starsShown) {
    starsShown = n;
    const el = document.getElementById('star-count');
    if (el) el.textContent = String(n);
  }

  const row = pointed && wide() ? view.querySelector<HTMLElement>(`[data-slug="${pointed}"]`) : null;
  const star = row && constellation!.screenPosition(pointed!);
  leader.classList.toggle('show', !!star);
  if (!row || !star) return;
  const r = row.getBoundingClientRect();
  const x1 = r.right + 12, y1 = r.top + r.height / 2;
  // stop at the ring, not on the star
  const len = Math.hypot(star.x - x1, star.y - y1) || 1;
  const x2 = star.x - ((star.x - x1) / len) * 18, y2 = star.y - ((star.y - y1) / len) * 18;
  const mx = x1 + (x2 - x1) * 0.45;
  leaderPath.setAttribute('d', `M${x1},${y1} C${mx},${y1} ${mx},${y2} ${x2},${y2}`);
  leaderRing.setAttribute('cx', String(star.x));
  leaderRing.setAttribute('cy', String(star.y));
}

/**
 * Where the camera looks follows the page: beside the title in the hero,
 * drifting in and to the right while you scroll the list, then faded
 * behind the about and contact sections. On a project page it flies to that star.
 */
function updateSky() {
  if (!constellation) return;
  const root = document.documentElement.style;
  const big = wide();
  const route = parseRoute();
  if (route.name === 'project') {
    constellation.focus(route.slug);
    constellation.setView({ shiftX: big ? 0.26 : 0, shiftY: big ? 0 : 0.22, zoom: big ? 1 : 0.7 });
    root.setProperty('--veil-side', big ? '1' : '0');
    root.setProperty('--veil-full', big ? '0' : '0.82');
    return;
  }
  constellation.focus(null);
  const y = scrollY, h = innerHeight;
  const list = document.getElementById('projects');
  const about = document.getElementById('about');
  const toList = list ? clamp01(y / Math.max(1, list.offsetTop - h * 0.15)) : 0;
  const toAbout = about ? clamp01((y + h - about.offsetTop) / (h * 0.7)) : 0;
  constellation.setView(
    big
      ? { shiftX: lerp(0.2, 0.28, toList), shiftY: 0, zoom: lerp(1.1, 1.3, toList) }
      : { shiftX: 0, shiftY: lerp(0.07, 0, toList), zoom: lerp(0.62, 0.8, toList) },
  );
  root.setProperty('--veil-side', String(big ? toList : 0));
  root.setProperty('--veil-full', String(big ? toAbout * 0.8 : Math.max(toList * 0.84, toAbout * 0.84)));
}

function renderHome() {
  ensureConstellation();
  heroCopy.innerHTML = heroText();
  view.innerHTML = homeView(filters, showAllTags);
  skyHintEl.textContent = skyHint();
  starsShown = -1;
  constellation?.setFilter(matches(filters));
}

function render() {
  const route = parseRoute();
  ensureConstellation();
  pointed = null;
  constellation?.highlight(null);
  if (route.name === 'project') {
    hero.hidden = true;
    document.body.classList.add('on-project');
    constellation?.setFilter(null);
    view.innerHTML = projectView(route.slug);
    document.title = `${projects.find((p) => p.slug === route.slug)?.title ?? t('notFound')} · ${profile.name}`;
    window.scrollTo({ top: 0 });
    updateSky();
    constellation?.start();
    return;
  }
  document.body.classList.remove('on-project');

  const tag = route.params.get('tag');
  const cat = route.params.get('cat');
  if (tag !== null || cat !== null) {
    filters.tag = tag || null;
    filters.category = (cat as Category) || 'all';
  }

  hero.hidden = false;
  renderHome();
  document.title = `${profile.name} · ${tr(profile.role)}`;
  constellation?.start();

  const target = route.section && document.getElementById(route.section);
  requestAnimationFrame(() => {
    if (target) target.scrollIntoView({ behavior: 'smooth' });
    else window.scrollTo({ top: 0 });
    updateSky();
  });
}

function rerenderFilters() {
  $('#filters').outerHTML = filtersBar(filters, showAllTags);
  $('#project-grid').innerHTML = grid(filters);
  constellation?.setFilter(matches(filters));
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
  else renderHome();
  constellation?.refreshText();
  window.scrollTo({ top: y });
});

// Pointing at a project in the list lights its star and draws a line to it.
function point(e: Event) {
  const row = (e.target as HTMLElement).closest<HTMLElement>('[data-slug]');
  const slug = e.type === 'mouseover' || e.type === 'focusin' ? (row?.dataset.slug ?? null) : null;
  if (slug === pointed) return;
  pointed = slug;
  constellation?.highlight(slug);
}
for (const type of ['mouseover', 'mouseout', 'focusin', 'focusout']) view.addEventListener(type, point);

addEventListener('scroll', updateSky, { passive: true });
addEventListener('resize', updateSky);

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
