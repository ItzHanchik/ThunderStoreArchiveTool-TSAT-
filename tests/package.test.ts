import { describe, it, expect } from 'vitest';
import { unzipSync, strFromU8 } from 'fflate';
import { buildPackage, ignoredPath, isPng256, mergeAssets, safePath, validate } from '../src/lib/package';
import { newProject } from '../src/lib/model';
import { readFileSync } from 'node:fs';
function project() { return { ...newProject('Example_Mod', 'valheim'), icon: new Uint8Array(readFileSync('public/icon.png')) }; }
describe('archive paths', () => {
  it.each(['../evil.dll', '/abs', 'a\\b', 'a/../b', 'a//b', 'C:/foo', 'CON.txt', 'x/aux', 'foo.', 'a\0b', 'a:b', ''])('rejects unsafe path %s', path => expect(safePath(path)).toBe(false));
  it('accepts nested mod resources', () => expect(safePath('BepInEx/plugins/MyMod/plugin.dll')).toBe(true));
  it.each(['.git/config', '.env', '.env.local', 'x/node_modules/a.js', 'release.zip', 'tool.exe'])('filters %s', path => expect(ignoredPath(path)).toBe(true));
  it('replaces files case-insensitively, excludes reserved files', () => { const data = new Uint8Array([1]); const result = mergeAssets([{ path: 'mod.dll', data }], [{ path: 'MOD.dll', data: new Uint8Array([2]) }, { path: 'manifest.json', data }]); expect(result).toHaveLength(1); expect(result[0].data[0]).toBe(2); });
});
describe('manifest and icon', () => {
  it('accepts valid PNG and metadata-only project with warning', () => { const p = project(); expect(isPng256(p.icon)).toBe(true); expect(validate(p).filter(c => c.status === 'error')).toEqual([]); expect(validate(p).find(c => c.id === 'payload')?.status).toBe('warning'); });
  it('rejects missing and wrong-size PNG', () => { expect(isPng256()).toBe(false); const p = project(); p.icon[19] = 1; expect(isPng256(p.icon)).toBe(false); });
  it.each(['../bad', 'bad name', 'Мод', ''])('rejects name %s', name => { const p = project(); p.manifest.name = name; expect(validate(p).find(c => c.id === 'name')?.status).toBe('error'); });
  it.each(['v1.0.0', '1.0', '1.0.0-beta', '2147483648.0.0'])('rejects version %s', version => { const p = project(); p.manifest.version_number = version; expect(validate(p).find(c => c.id === 'version')?.status).toBe('error'); });
  it('rejects oversized description and unsafe URLs', () => { const p = project(); p.manifest.description = 'x'.repeat(251); p.manifest.website_url = 'javascript:alert(1)'; expect(validate(p).filter(c => c.status === 'error').map(c => c.id)).toEqual(['description', 'website']); });
  it('rejects duplicate dependency packages and self dependencies', () => { const p = project(); p.manifest.dependencies = ['Team-Mod-1.0.0', 'Team-Mod-2.0.0']; expect(validate(p).find(c => c.id === 'dependencies')?.status).toBe('error'); p.team = 'Team'; p.manifest.dependencies = ['Team-Example_Mod-1.0.0']; expect(validate(p).find(c => c.id === 'dependencies')?.status).toBe('error'); });
  it('rejects duplicate file paths and reserved root paths', () => { const p = project(); p.files = [{ path: 'README.md', data: new Uint8Array() }]; expect(validate(p).find(c => c.id === 'paths')?.status).toBe('error'); });
});
describe('real ZIP export', () => {
  it('writes required files at root, preserves nested assets and UTF-8', async () => { const p = project(); p.readme = '# Привет, моды'; p.files = [{ path: 'BepInEx/plugins/Mod.dll', data: new Uint8Array([7, 8, 9]) }]; const bytes = await buildPackage(p); const zip = unzipSync(bytes); expect(Object.keys(zip).sort()).toEqual(['CHANGELOG.md', 'README.md', 'icon.png', 'manifest.json', 'BepInEx/plugins/Mod.dll'].sort()); expect(strFromU8(zip['README.md'])).toBe(p.readme); expect(JSON.parse(strFromU8(zip['manifest.json']))).toEqual(p.manifest); expect(zip['BepInEx/plugins/Mod.dll']).toEqual(p.files[0].data); expect(strFromU8(zip['manifest.json'])).not.toContain('team'); });
  it('blocks invalid projects', async () => { const p = project(); p.manifest.name = '../bad'; await expect(buildPackage(p)).rejects.toThrow(); });
  it('omits empty changelog', async () => { const p = project(); p.changelog = ''; const zip = unzipSync(await buildPackage(p)); expect(zip['CHANGELOG.md']).toBeUndefined(); });
});
