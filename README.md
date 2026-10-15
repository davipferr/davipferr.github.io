# davipferr.github.io

My portfolio, built with **TypeScript + Vite + Three.js** and deployed to GitHub Pages at <https://davipferr.github.io/>.

```bash
npm install
npm run dev
```

`npm test` runs the unit tests. `npm run build` validates the content, type-checks and builds to `dist/`.

## How it works

The site is generated from data files. The code never needs to change to add a project.

```
content/
  profile.json            name, role, intro, about, links (EN + PT)
  project.schema.json     the contract for a project entry
  projects/<slug>.json    one file per project
public/projects/<slug>/   cover and screenshots for that project
```

- **All projects** can be shown as a 3D constellation (the default) or as cards, with a toggle that is remembered per browser. The constellation (`src/hero/`) draws every project as a star. Stars are grouped by category and linked to related projects: the nearest sibling in the same category, plus any project sharing an uncommon tag. Positions are seeded by slug, so adding a project doesn't reshuffle the others. You can drag to rotate it, hover a star to see the project, and click to open it. The category and tag filters fade out the stars that don't match. The scene pauses when it's off-screen or in cards view, and it respects `prefers-reduced-motion`. Without WebGL, only the cards are shown. In constellation view the cards stay in the page for screen readers.
- **The rest of the page is plain HTML**: intro, About and Contact. Project pages live at `#/p/<slug>`. Routing uses the hash because GitHub Pages has no SPA fallback.
- **The site is in English and Portuguese.** Every text field is `{ "en": …, "pt": … }`. The language follows the browser and can be switched in the header.

## Adding a project

The usual way is the **Add to portfolio** button in [Project Launcher](https://github.com/davipferr/project-launcher). It writes `content/projects/<slug>.json` (plus images), runs `npm run validate`, then commits and pushes.

By hand:

1. Create `content/projects/<slug>.json`. Add `"$schema": "../project.schema.json"` at the top to get editor autocomplete.
2. Optional: add `public/projects/<slug>/cover.webp` (16:9) and set `"cover": "projects/<slug>/cover.webp"`. Without a cover, a generated image is used.
3. Optional: add `"constellation": "leo"` (or any of the 12 zodiac ids in `src/data/zodiac.json`) to put the project on a star of that zodiac figure. In the 3D view the figure is drawn with its free stars dashed, and the project's card image becomes the figure with its own star lit up. Each figure has a fixed number of stars (Leo 9, Cancer 5, …). Featured projects get a star first, then the oldest. Any extra projects are shown by category as usual, and `npm run validate` prints a warning listing them.
4. Run `npm run validate`, then push to `main`.

The validator checks the schema, that both languages are filled in, that the file name matches the `slug`, that slugs are unique, and that every referenced image exists. It runs before every build, so a broken entry fails CI and never reaches the live site.

## Deploy

`.github/workflows/deploy.yml` runs tests and builds on every push and PR. Pushes to `main` are deployed to Pages. One-time setup: in the repo, go to **Settings → Pages → Source** and choose **GitHub Actions**.
