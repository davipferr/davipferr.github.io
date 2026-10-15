import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
// @ts-expect-error plain .mjs script, no type declarations
import { validateAll } from '../scripts/validate.mjs';

const schema = fs.readFileSync(path.resolve(__dirname, '../content/project.schema.json'), 'utf8');
const good = {
  slug: 'demo',
  title: 'Demo',
  tagline: { en: 'x', pt: 'x' },
  description: { en: 'x', pt: 'x' },
  category: 'web',
  tags: ['ts'],
  date: '2026-01-01',
};

let dir: string;
function site(files: Record<string, unknown>) {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'portfolio-'));
  fs.mkdirSync(path.join(dir, 'content', 'projects'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'content', 'project.schema.json'), schema);
  for (const [name, data] of Object.entries(files)) {
    fs.writeFileSync(path.join(dir, 'content', 'projects', name), typeof data === 'string' ? data : JSON.stringify(data));
  }
  return dir;
}
afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

describe('validateAll', () => {
  it('accepts a valid entry', () => {
    expect(validateAll(site({ 'demo.json': good })).errors).toEqual([]);
  });

  it('rejects missing translations, bad JSON, wrong file names and missing images', () => {
    const { errors } = validateAll(
      site({
        'demo.json': { ...good, tagline: { en: 'only english' } },
        'broken.json': '{ nope',
        'other.json': { ...good, slug: 'not-other' },
        'pic.json': { ...good, slug: 'pic', cover: 'projects/pic/cover.webp' },
      }),
    );
    expect(errors.join('\n')).toMatch(/demo\.json: \/tagline must have required property 'pt'/);
    expect(errors.join('\n')).toMatch(/broken\.json: invalid JSON/);
    expect(errors.join('\n')).toMatch(/other\.json: slug "not-other" does not match/);
    expect(errors.join('\n')).toMatch(/pic\.json: image not found/);
  });
});
