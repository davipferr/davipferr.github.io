import type { Category, Project } from '../data/types';
import { profile, projects, tagCounts, usedCategories } from '../data/projects';
import { CATEGORY_COLORS } from '../hero/layout';
import { categoryLabel, t, tr } from '../i18n';
import { designation, esc, icons, projectHref, richText } from './components';

export interface Filters {
  category: Category | 'all';
  tag: string | null;
}

const TAGS_SHOWN = 14;

export function heroText() {
  return `<h1>${esc(profile.name)}</h1>
    <p class="hero-role">${esc(tr(profile.role))}</p>
    <p class="hero-claim"><span id="star-count" class="star-count">${projects.length}</span> ${t('starClaim')}</p>
    <p class="lead">${esc(tr(profile.intro))}</p>
    <div class="hero-actions">
      <a class="btn btn-primary" href="#/projects">${t('seeProjects')}</a>
      ${profile.links.github ? `<a class="btn" href="${esc(profile.links.github)}" target="_blank" rel="noopener">${icons.github} GitHub</a>` : ''}
    </div>`;
}

export const skyHint = () => t(matchMedia('(hover: none)').matches ? 'heroHintTouch' : 'heroHint');

export function homeView(filters: Filters, showAllTags: boolean) {
  const email = profile.links.email;
  return `
    <section class="section catalogue" id="projects" aria-labelledby="projects-h">
      <div class="catalogue-side">
        <h2 id="projects-h">${t('allProjects')}</h2>
        <p class="catalogue-note">${t('catalogueNote', { n: projects.length })}</p>
        ${filtersBar(filters, showAllTags)}
      </div>
      <ol class="catalogue-list" id="project-grid" aria-live="polite">${grid(filters)}</ol>
    </section>

    <section class="section about" id="about" aria-labelledby="about-h">
      <h2 id="about-h">${t('about')}</h2>
      <div class="prose">${richText(tr(profile.about))}</div>
    </section>

    <section class="section contact" id="contact" aria-labelledby="contact-h">
      <h2 id="contact-h">${t('contact')}</h2>
      <div>
        <p>${t('contactText')}</p>
        ${email ? `<a class="contact-mail" href="mailto:${esc(email)}">${esc(email)}</a>` : ''}
        <div class="contact-links">
          ${profile.links.github ? `<a href="${esc(profile.links.github)}" target="_blank" rel="noopener">${icons.github} github.com/${esc(profile.links.github.split('/').pop()!)}</a>` : ''}
          ${profile.links.linkedin ? `<a href="${esc(profile.links.linkedin)}" target="_blank" rel="noopener">${icons.linkedin} LinkedIn</a>` : ''}
        </div>
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
    <div class="chips chips-cats" role="group" aria-label="${t('category')}">
      ${chip(t('all'), 'data-cat="all"', f.category === 'all')}
      ${cats.map((c) => chip(`<i class="dot"></i>${esc(categoryLabel(c))}`, `data-cat="${c}"`, f.category === c, CATEGORY_COLORS[c])).join('')}
    </div>
    <div class="chips chips-tags" role="group" aria-label="Tags">
      ${shownTags.map(([tag, n]) => chip(`${esc(tag)}${n ? `<span class="count">${n}</span>` : ''}`, `data-tag="${esc(tag)}"`, f.tag === tag)).join('')}
      ${tags.length > TAGS_SHOWN ? `<button type="button" class="chip chip-more" data-more>${showAllTags ? t('fewerTags') : t('moreTags', { n: tags.length - TAGS_SHOWN })}</button>` : ''}
    </div>
  </div>`;
}

export const matches = (f: Filters) => (p: Project) =>
  (f.category === 'all' || p.category === f.category) && (!f.tag || p.tags.includes(f.tag));

function entry(p: Project) {
  return `<li class="entry" style="--c:${CATEGORY_COLORS[p.category]}">
    <a href="${projectHref(p)}" data-slug="${p.slug}">
      <span class="entry-mark">${designation(p)}</span>
      <span class="entry-main">
        <strong>${esc(p.title)}</strong>
        <span class="entry-tagline">${esc(tr(p.tagline))}</span>
      </span>
      <span class="entry-year">${esc(p.date.slice(0, 4))}</span>
    </a>
  </li>`;
}

export function grid(f: Filters) {
  const list = projects.filter(matches(f));
  if (!list.length) {
    return `<li class="empty"><p>${t('noResults')}</p><button type="button" class="btn" data-clear>${t('clearFilters')}</button></li>`;
  }
  return list.map(entry).join('');
}
