import type { Project } from '../data/types';
import { asset, zodiac } from '../data/projects';
import type { Seat } from '../data/zodiac';
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

/** Art for a project sitting on a zodiac star: the whole figure, with its own star lit up. */
export function zodiacArt(p: Project, seat: Seat) {
  const color = CATEGORY_COLORS[p.category];
  const taken = zodiac.occupants.get(seat.zodiac.id)!.map((o) => o !== null);
  const at = (i: number) => {
    const [x, y] = seat.zodiac.stars[i];
    return [110 + x * 180, 10 + y * 180] as const;
  };
  const lines = seat.zodiac.lines
    .map(([a, b]) => {
      const [[x1, y1], [x2, y2]] = [at(a), at(b)];
      const solid = taken[a] && taken[b];
      return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke-opacity="${solid ? 0.5 : 0.22}"${solid ? '' : ' stroke-dasharray="3 3"'}/>`;
    })
    .join('');
  const stars = seat.zodiac.stars
    .map((_, i) => {
      if (i === seat.star) return '';
      const [x, y] = at(i);
      return taken[i] ? `<circle cx="${x}" cy="${y}" r="2.4" fill-opacity=".85"/>` : `<circle cx="${x}" cy="${y}" r="1.5" fill-opacity=".35"/>`;
    })
    .join('');
  const [sx, sy] = at(seat.star);
  const r = rng(hash(seat.zodiac.id));
  const dust = Array.from({ length: 40 }, () => `<circle cx="${r() * 400}" cy="${r() * 200}" r="${0.4 + r() * 0.7}"/>`).join('');
  const id = `z-${p.slug}`;
  return `<svg class="cover-art" viewBox="0 0 400 200" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
    <defs><radialGradient id="${id}" cx="${sx / 4}%" cy="${sy / 2}%" r="45%">
      <stop offset="0" stop-color="${color}" stop-opacity=".35"/><stop offset="1" stop-color="${color}" stop-opacity="0"/>
    </radialGradient></defs>
    <rect width="400" height="200" fill="#070a12"/><rect width="400" height="200" fill="url(#${id})"/>
    <g fill="#8090b0" fill-opacity=".45">${dust}</g>
    <g stroke="#c8d6f0" stroke-width="1">${lines}</g>
    <g fill="#dfe7f7">${stars}</g>
    <circle cx="${sx}" cy="${sy}" r="13" fill="${color}" fill-opacity=".25"/>
    <circle cx="${sx}" cy="${sy}" r="4.5" fill="${color}"/>
    <circle cx="${sx}" cy="${sy}" r="2" fill="#fff"/>
    <text x="18" y="186" fill="#c8d6f0" fill-opacity=".7" font-size="13" letter-spacing="3" font-family="var(--font)">${esc(tr(seat.zodiac.name).toUpperCase())}</text>
  </svg>`;
}

/**
 * Cards show the zodiac figure for projects on a constellation; the project
 * page prefers a real cover image when there is one.
 */
export function cover(p: Project, { eager = false, page = false } = {}) {
  const seat = zodiac.seats.get(p.slug);
  const img = p.cover && `<img src="${asset(p.cover)}" alt="" loading="${eager ? 'eager' : 'lazy'}" decoding="async">`;
  if (seat && !(page && img)) return zodiacArt(p, seat);
  return img || coverArt(p);
}

export function categoryBadge(p: Project) {
  return `<span class="badge" style="--c:${CATEGORY_COLORS[p.category]}">${esc(categoryLabel(p.category))}</span>`;
}

export function projectCard(p: Project) {
  return `<article class="card" style="--c:${CATEGORY_COLORS[p.category]}">
    <a class="card-link" href="${projectHref(p)}" aria-label="${esc(p.title)}">
      <div class="card-cover">${cover(p)}</div>
      <div class="card-body">
        <div class="card-meta">${categoryBadge(p)}<span>${esc(formatDate(p.date))}</span></div>
        <h3>${esc(p.title)}</h3>
        <p>${esc(tr(p.tagline))}</p>
        <ul class="tags">${p.tags.slice(0, 3).map((t) => `<li>${esc(t)}</li>`).join('')}</ul>
      </div>
    </a>
  </article>`;
}

export const icons = {
  linkedin: `<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path fill="currentColor" d="M20.45 20.45h-3.56v-5.57c0-1.33-.03-3.04-1.85-3.04-1.85 0-2.14 1.45-2.14 2.94v5.67H9.35V9h3.41v1.56h.05c.48-.9 1.64-1.85 3.37-1.85 3.6 0 4.27 2.37 4.27 5.46v6.28zM5.34 7.43a2.06 2.06 0 1 1 0-4.13 2.06 2.06 0 0 1 0 4.13zM7.12 20.45H3.56V9h3.56v11.45zM22.22 0H1.77C.79 0 0 .77 0 1.73v20.54C0 23.23.79 24 1.77 24h20.45c.98 0 1.78-.77 1.78-1.73V1.73C24 .77 23.2 0 22.22 0z"/></svg>`,
  mail: `<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3.5 6.5 8.5 6.5 8.5-6.5"/></g></svg>`,
  sky: `<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-width="1.6" stroke-opacity=".6"><path d="M5 17 10 7l9 4-6 8z"/></g><g fill="currentColor"><circle cx="5" cy="17" r="2"/><circle cx="10" cy="7" r="2.4"/><circle cx="19" cy="11" r="1.8"/><circle cx="13" cy="19" r="1.6"/></g></svg>`,
  grid: `<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-width="1.8"><rect x="4" y="4" width="7" height="7" rx="1.5"/><rect x="13" y="4" width="7" height="7" rx="1.5"/><rect x="4" y="13" width="7" height="7" rx="1.5"/><rect x="13" y="13" width="7" height="7" rx="1.5"/></g></svg>`,
  github: `<svg viewBox="0 0 16 16" width="18" height="18" aria-hidden="true"><path fill="currentColor" d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/></svg>`,
  external: `<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/></svg>`,
  arrowLeft: `<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="M19 12H5M11 18l-6-6 6-6"/></svg>`,
  arrowRight: `<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="M5 12h14M13 6l6 6-6 6"/></svg>`,
};
