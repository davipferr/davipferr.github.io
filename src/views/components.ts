import type { Project } from '../data/types';
import { asset } from '../data/projects';
import { CATEGORY_COLORS, hash, rng } from '../hero/layout';
import { categoryLabel, formatDate, tr } from '../i18n';

export const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

/** Blank lines → paragraphs, `code` → <code>. Everything else is escaped. */
export const richText = (s: string) =>
  s
    .split(/\n\s*\n/)
    .map((para) => `<p>${esc(para.trim()).replace(/`([^`]+)`/g, '<code>$1</code>')}</p>`)
    .join('');

export const projectHref = (p: Project) => `#/p/${p.slug}`;
export const tagHref = (tag: string) => `#/projects?tag=${encodeURIComponent(tag)}`;

/** Generated art for projects without a cover image: a tiny seeded constellation. */
export function coverArt(p: Project) {
  const color = CATEGORY_COLORS[p.category];
  const r = rng(hash(p.slug));
  // sorted left to right so the line reads like a constellation, not a scribble
  const pts = Array.from({ length: 7 }, () => [30 + r() * 340, 30 + r() * 120, 1.4 + r() * 2.2] as const).sort((a, b) => a[0] - b[0]);
  const lines = pts
    .slice(1)
    .map((q, i) => `<line x1="${pts[i][0]}" y1="${pts[i][1]}" x2="${q[0]}" y2="${q[1]}" />`)
    .join('');
  const dots = pts.map(([x, y, s]) => `<circle cx="${x}" cy="${y}" r="${s}" />`).join('');
  const id = `g-${p.slug}`;
  return `<svg class="cover-art" viewBox="0 0 400 225" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
    <defs><radialGradient id="${id}" cx="${30 + r() * 40}%" cy="${30 + r() * 40}%" r="80%">
      <stop offset="0" stop-color="${color}" stop-opacity=".45"/><stop offset="1" stop-color="${color}" stop-opacity="0"/>
    </radialGradient></defs>
    <rect width="400" height="225" fill="var(--surface-2)"/><rect width="400" height="225" fill="url(#${id})"/>
    <g stroke="${color}" stroke-opacity=".35" stroke-width="1">${lines}</g>
    <g fill="${color}">${dots}</g>
    <text x="24" y="205" fill="${color}" fill-opacity=".9" font-size="54" font-weight="700" font-family="var(--font-display)">${esc(p.title.slice(0, 2))}</text>
  </svg>`;
}

export function cover(p: Project, eager = false) {
  return p.cover
    ? `<img src="${asset(p.cover)}" alt="" loading="${eager ? 'eager' : 'lazy'}" decoding="async">`
    : coverArt(p);
}

export function categoryBadge(p: Project) {
  return `<span class="badge" style="--c:${CATEGORY_COLORS[p.category]}">${esc(categoryLabel(p.category))}</span>`;
}

export function projectCard(p: Project, big = false) {
  return `<article class="card${big ? ' card-big' : ''}" style="--c:${CATEGORY_COLORS[p.category]}">
    <a class="card-link" href="${projectHref(p)}" aria-label="${esc(p.title)}">
      <div class="card-cover">${cover(p)}</div>
      <div class="card-body">
        <div class="card-meta">${categoryBadge(p)}<span>${esc(formatDate(p.date))}</span></div>
        <h3>${esc(p.title)}</h3>
        <p>${esc(tr(p.tagline))}</p>
        <ul class="tags">${p.tags.slice(0, 5).map((t) => `<li>${esc(t)}</li>`).join('')}</ul>
      </div>
    </a>
  </article>`;
}

export const icons = {
  github: `<svg viewBox="0 0 16 16" width="18" height="18" aria-hidden="true"><path fill="currentColor" d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/></svg>`,
  external: `<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/></svg>`,
  arrowLeft: `<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="M19 12H5M11 18l-6-6 6-6"/></svg>`,
  arrowRight: `<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="M5 12h14M13 6l6 6-6 6"/></svg>`,
};
