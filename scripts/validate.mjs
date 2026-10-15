// Checks every content/projects/*.json against content/project.schema.json,
// plus the rules a schema can't express: file name = slug, unique slugs,
// and image paths that actually exist in public/.
//
// Runs before every build, so a broken entry fails CI instead of the live site.
// Project Launcher also runs it before publishing.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Ajv from 'ajv';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export function validateAll(rootDir = root) {
  const schema = JSON.parse(fs.readFileSync(path.join(rootDir, 'content', 'project.schema.json'), 'utf8'));
  const check = new Ajv({ allErrors: true }).compile(schema);
  const dir = path.join(rootDir, 'content', 'projects');
  const errors = [];
  const slugs = new Map();
  const projects = [];
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.json'));

  for (const file of files) {
    const fail = (msg) => errors.push(`${file}: ${msg}`);
    let data;
    try {
      data = JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8'));
    } catch (err) {
      fail(`invalid JSON (${err.message})`);
      continue;
    }
    if (!check(data)) {
      for (const e of check.errors) fail(`${e.instancePath || '(root)'} ${e.message}`);
      continue;
    }
    if (`${data.slug}.json` !== file) fail(`slug "${data.slug}" does not match the file name`);
    if (slugs.has(data.slug)) fail(`duplicate slug, also used by ${slugs.get(data.slug)}`);
    slugs.set(data.slug, file);
    projects.push(data);
    for (const img of [data.cover, ...(data.images ?? [])].filter(Boolean)) {
      if (!fs.existsSync(path.join(rootDir, 'public', img))) fail(`image not found: public/${img}`);
    }
  }
  return { count: files.length, errors, warnings: zodiacOverflow(rootDir, projects) };
}

/** Constellations with more projects than stars. Same order as assignZodiac() in src/data/zodiac.ts. */
function zodiacOverflow(rootDir, projects) {
  const zodiacFile = path.join(rootDir, 'src', 'data', 'zodiac.json');
  if (!fs.existsSync(zodiacFile)) return [];
  const { constellations } = JSON.parse(fs.readFileSync(zodiacFile, 'utf8'));
  const warnings = [];
  for (const z of constellations) {
    const members = projects
      .filter((p) => p.constellation === z.id)
      .sort((a, b) => Number(!!b.featured) - Number(!!a.featured) || a.date.localeCompare(b.date) || a.slug.localeCompare(b.slug));
    if (members.length > z.stars.length) {
      const extra = members.slice(z.stars.length).map((p) => p.slug).join(', ');
      warnings.push(`${z.id} has ${z.stars.length} stars but ${members.length} projects; shown by category instead: ${extra}`);
    }
  }
  return warnings;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { count, errors, warnings } = validateAll();
  for (const w of warnings) console.warn(`⚠ ${w}`);
  if (errors.length) {
    console.error(`✖ ${errors.length} problem(s) in content/projects:\n  ${errors.join('\n  ')}`);
    process.exit(1);
  }
  console.log(`✔ ${count} project(s) valid`);
}
