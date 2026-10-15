import { asset, bySlug, projects, zodiac } from '../data/projects';
import { CATEGORY_COLORS } from '../hero/layout';
import { formatDate, statusLabel, t, tr } from '../i18n';
import { categoryBadge, cover, esc, icons, projectHref, richText, tagHref } from './components';

export function projectView(slug: string) {
  const p = bySlug(slug);
  if (!p) {
    return `<section class="section narrow"><a class="back" href="#/projects">${icons.arrowLeft} ${t('back')}</a><h1>${t('notFound')}</h1></section>`;
  }
  const seat = zodiac.seats.get(p.slug);
  const i = projects.indexOf(p);
  const prev = projects[(i - 1 + projects.length) % projects.length];
  const next = projects[(i + 1) % projects.length];

  return `<article class="project" style="--c:${CATEGORY_COLORS[p.category]}">
    <div class="section narrow">
      <a class="back" href="#/projects">${icons.arrowLeft} ${t('back')}</a>
      <header class="project-head">
        ${categoryBadge(p)}
        <h1>${esc(p.title)}</h1>
        <p class="lead">${esc(tr(p.tagline))}</p>
        <div class="hero-actions">
          ${p.liveUrl ? `<a class="btn btn-primary" href="${esc(p.liveUrl)}" target="_blank" rel="noopener">${t('liveDemo')} ${icons.external}</a>` : ''}
          ${p.repoUrl ? `<a class="btn" href="${esc(p.repoUrl)}" target="_blank" rel="noopener">${icons.github} ${t('source')}</a>` : ''}
        </div>
      </header>

      <div class="project-cover">${cover(p, { eager: true, page: true })}</div>

      <div class="project-body">
        <div class="prose">${richText(tr(p.description))}</div>
        <aside class="project-meta">
          <dl>
            <dt>${t('started')}</dt><dd>${esc(formatDate(p.date))}</dd>
            ${p.status ? `<dt>${t('status')}</dt><dd>${esc(statusLabel(p.status))}</dd>` : ''}
            ${seat ? `<dt>${t('constellation')}</dt><dd>${esc(tr(seat.zodiac.name))}</dd>` : ''}
          </dl>
          <ul class="tags">${p.tags.map((tag) => `<li><a href="${tagHref(tag)}">${esc(tag)}</a></li>`).join('')}</ul>
        </aside>
      </div>

      ${p.images?.length ? `<div class="gallery">${p.images.map((img) => `<a href="${asset(img)}" target="_blank" rel="noopener"><img src="${asset(img)}" alt="" loading="lazy" decoding="async"></a>`).join('')}</div>` : ''}

      ${projects.length > 1 ? `<nav class="pager" aria-label="${t('allProjects')}">
        <a href="${projectHref(prev)}"><span>${icons.arrowLeft} ${t('previous')}</span><strong>${esc(prev.title)}</strong></a>
        <a href="${projectHref(next)}" class="pager-next"><span>${t('next')} ${icons.arrowRight}</span><strong>${esc(next.title)}</strong></a>
      </nav>` : ''}
    </div>
  </article>`;
}
