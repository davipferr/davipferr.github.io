import type { Category, Project } from '../data/types';
import { profile, projects, tagCounts, usedCategories } from '../data/projects';
import { CATEGORY_COLORS } from '../hero/layout';
import { categoryLabel, t, tr } from '../i18n';
import { esc, icons, projectCard, richText } from './components';

export interface Filters {
  category: Category | 'all';
  tag: string | null;
}

const TAGS_SHOWN = 14;

export type ViewMode = 'sky' | 'cards';

export function heroText() {
  return `<p class="eyebrow">${esc(tr(profile.role))}</p>
    <h1>${esc(profile.name)}</h1>
    <p class="lead">${esc(tr(profile.intro))}</p>
    <div class="hero-actions">
      <a class="btn btn-primary" href="#/projects">${t('seeProjects')} ${icons.arrowRight}</a>
      ${profile.links.github ? `<a class="btn" href="${esc(profile.links.github)}" target="_blank" rel="noopener">${icons.github} GitHub</a>` : ''}
    </div>`;
}

export const skyHint = () =>
  `${t(matchMedia('(hover: none)').matches ? 'heroHintTouch' : 'heroHint')} · ${t('projectsCount', { n: projects.length })}`;

function viewToggle(mode: ViewMode) {
  const btn = (m: ViewMode, label: string, icon: string) =>
    `<button type="button" class="toggle-btn${mode === m ? ' active' : ''}" aria-pressed="${mode === m}" data-view="${m}">${icon}<span>${label}</span></button>`;
  return `<div class="view-toggle" role="group" aria-label="${t('viewAs')}">
    ${btn('sky', t('viewSky'), icons.sky)}
    ${btn('cards', t('viewCards'), icons.grid)}
  </div>`;
}

/** `mode` is null when WebGL is unavailable: cards only, no toggle. */
export function homeView(filters: Filters, showAllTags: boolean, mode: ViewMode | null) {
  const sky = mode === 'sky';
  return `
    <section class="section" id="projects" aria-labelledby="projects-h">
      <div class="section-head">
        <h2 id="projects-h">${t('allProjects')}</h2>
        ${mode ? viewToggle(mode) : ''}
      </div>
      ${filtersBar(filters, showAllTags)}
      ${mode ? '<div id="sky-slot"></div>' : ''}
      <div class="grid${sky ? ' sr-only' : ''}" id="project-grid" aria-live="polite">${grid(filters)}</div>
    </section>

    <section class="section about" id="about" aria-labelledby="about-h">
      <h2 id="about-h">${t('about')}</h2>
      <div class="prose">${richText(tr(profile.about))}</div>
    </section>

    <section class="section contact" id="contact" aria-labelledby="contact-h">
      <h2 id="contact-h">${t('contact')}</h2>
      <p>${t('contactText')}</p>
      <div class="hero-actions">
        ${profile.links.github ? `<a class="btn" href="${esc(profile.links.github)}" target="_blank" rel="noopener">${icons.github} github.com/${esc(profile.links.github.split('/').pop()!)}</a>` : ''}
        ${profile.links.linkedin ? `<a class="btn" href="${esc(profile.links.linkedin)}" target="_blank" rel="noopener">LinkedIn</a>` : ''}
        ${profile.links.email ? `<a class="btn" href="mailto:${esc(profile.links.email)}">${esc(profile.links.email)}</a>` : ''}
      </div>
    </section>`;
}

export function filtersBar(f: Filters, showAllTags: boolean) {
  const cats = usedCategories(projects);
  const tags = tagCounts(projects);
  const shownTags = showAllTags ? tags : tags.slice(0, TAGS_SHOWN);
  // keep the active tag visible even when it is outside the top N
  if (f.tag && !shownTags.some(([tag]) => tag === f.tag)) shownTags.push([f.tag, 0]);
  const chip = (label: string, attrs: string, active: boolean, color?: string) =>
    `<button type="button" class="chip${active ? ' active' : ''}" aria-pressed="${active}" ${attrs}${color ? ` style="--c:${color}"` : ''}>${label}</button>`;

  return `<div class="filters" id="filters">
    <div class="chips" role="group" aria-label="${t('category')}">
      ${chip(t('all'), 'data-cat="all"', f.category === 'all')}
      ${cats.map((c) => chip(`<i class="dot"></i>${esc(categoryLabel(c))}`, `data-cat="${c}"`, f.category === c, CATEGORY_COLORS[c])).join('')}
    </div>
    <div class="chips chips-tags" role="group" aria-label="Tags">
      ${shownTags.map(([tag, n]) => chip(`#${esc(tag)}${n ? `<span class="count">${n}</span>` : ''}`, `data-tag="${esc(tag)}"`, f.tag === tag)).join('')}
      ${tags.length > TAGS_SHOWN ? `<button type="button" class="chip chip-more" data-more>${showAllTags ? '−' : `+${tags.length - TAGS_SHOWN}`}</button>` : ''}
    </div>
  </div>`;
}

export const matches = (f: Filters) => (p: Project) =>
  (f.category === 'all' || p.category === f.category) && (!f.tag || p.tags.includes(f.tag));

export function grid(f: Filters) {
  const list = projects.filter(matches(f));
  if (!list.length) {
    return `<div class="empty"><p>${t('noResults')}</p><button type="button" class="btn" data-clear>${t('clearFilters')}</button></div>`;
  }
  return list.map((p) => projectCard(p)).join('');
}
