import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { lstat, mkdir, readFile, utimes, writeFile } from 'node:fs/promises';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { contexts } from '../index.js';

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const ASSET = 'togetherlens-offline-invitation-2026-10-09.zip';
export const NAMES = ['LICENSE', 'README.md', 'photo-invitation.html'];
export const PUBLIC_CARD = 'https://m0k13.github.io/togetherlens-photo-prompt-card/';
const INPUTS = ['index.html', 'index.js', 'docs/offline-invitation-start.md', 'LICENSE'];
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');

function replaceOnce(source, before, after) {
	assert.equal(source.split(before).length, 2, `Expected one reviewed input: ${before}`);
	return source.replace(before, after);
}

export function renderOffline(html) {
	assert.equal((html.match(/<script\b/g) || []).length, 1, 'Review additional scripts before packaging.');
	let result = replaceOnce(html, '<script type="module">', '<script>');
	result = replaceOnce(result, "import {contexts} from './index.js';", `const contexts=${JSON.stringify(contexts).replaceAll('<', '\\u003c')};`);
	result = replaceOnce(result, 'const knownCampaign=fromPlaylist || fromWebApps;', 'const knownCampaign=false;');
	result = replaceOnce(result, 'const shared=new URL(location.pathname,location.origin);', `const shared=new URL('${PUBLIC_CARD}');`);
	const tagged = '?utm_source=github&amp;utm_medium=referral&amp;utm_campaign=prompt_card_demo_20260914';
	assert.equal(result.split(tagged).length - 1, 5, 'All five static scene/app destinations must be reviewed.');
	result = result.replaceAll(tagged, '');
	result = replaceOnce(result, '<title>Make a shared-photo invitation | TogetherLens</title>', '<title>Offline photo invitation | TogetherLens</title>');
	result = result.replace(/^<meta (?:property="og:|name="twitter:)[^\n]+\n/gm, '');
	const download = result.match(/<p class="note" id="offline-download">[^\n]+<\/p>\n/)?.[0];
	assert.ok(download, 'The public editor must expose the reviewed download.');
	result = replaceOnce(result, download, '');
	result = replaceOnce(result, '<div class="workspace">', '<p class="intro" id="offline-help">Offline invitation editor. You can edit, copy or print without a connection. Scene planning and app-guide links need internet access. Nothing is sent automatically.</p>\n<div class="workspace">');
	result = replaceOnce(result, 'Hosted by GitHub Pages.', 'Offline copy. External links need internet access.');
	const markup = result.replace(/<script>[\s\S]*?<\/script>/, '');
	assert.doesNotMatch(markup, /<(?:img|iframe|form|input[^>]*type=["']file|link|video|audio)\b|\bon[a-z]+\s*=|@import|url\s*\(/i);
	const controller = result.match(/<script>([\s\S]*?)<\/script>/)?.[1];
	assert.ok(controller);
	assert.doesNotMatch(controller, /\b(?:import|fetch|XMLHttpRequest|sendBeacon|localStorage|sessionStorage|indexedDB|WebSocket|EventSource)\b|document\.cookie|eval\s*\(|new\s+Function\b/);
	for (const href of [...result.matchAll(/href="([^"]+)"/g)].map(match => match[1])) {
		const url = new URL(href);
		assert.equal(url.protocol, 'https:');
		assert.ok(['github.com', 'togetherlens.app'].includes(url.hostname));
		assert.equal(url.search, '');
	}
	for (const notice of ['Taking part is optional.', 'parent or guardian', 'new AI composition', 'paid tokens', 'Premium is optional and auto-renews', 'does not generate a photo, send portraits or import a prompt']) {
		assert.ok(result.includes(notice), `Missing notice: ${notice}`);
	}
	return result;
}

export async function buildOffline(outputDir, { allowDirty = false } = {}) {
	const status = execFileSync('git', ['status', '--porcelain', '--untracked-files=no'], { cwd: ROOT, encoding: 'utf8' });
	assert.ok(allowDirty || !status.trim(), 'Release builds require a tracked-clean checkout.');
	const revision = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: ROOT, encoding: 'utf8' }).trim();
	const sources = [];
	for (const input of INPUTS) {
		assert.ok((await lstat(join(ROOT, input))).isFile(), 'Do not package symlinks or directories.');
		sources.push(await readFile(join(ROOT, input), 'utf8'));
	}
	assert.match(sources[1], /export const contexts = Object\.freeze/);
	assert.match(sources[3], /^MIT License/);
	const output = resolve(outputDir);
	const pathFromRoot = relative(ROOT, output);
	assert.ok(pathFromRoot.startsWith('..' + '/') || pathFromRoot === '..', 'Build outside the source checkout.');
	assert.ok((await lstat(output)).isDirectory(), 'Use an existing directory, not a symlink.');
	const files = { 'LICENSE': sources[3], 'README.md': sources[2], 'photo-invitation.html': renderOffline(sources[0]) };
	assert.deepEqual(Object.keys(files).sort(), NAMES);
	const stage = join(output, 'offline-invitation');
	await mkdir(stage); // Exclusive staging prevents clobbering a prior kit.
	const stamp = new Date('2026-10-09T00:00:00Z');
	for (const name of NAMES) {
		const path = join(stage, name);
		await writeFile(path, files[name], { flag: 'wx', mode: 0o644 });
		await utimes(path, stamp, stamp);
	}
	const zipPath = join(output, ASSET);
	try {
		await lstat(zipPath);
		throw new Error('The ZIP already exists. Refusing to overwrite it.');
	} catch (error) {
		if (error.code !== 'ENOENT') throw error;
	}
	execFileSync('zip', ['-X', '-q', zipPath, ...NAMES], { cwd: stage, env: { PATH: process.env.PATH, TZ: 'UTC' } });
	const bytes = await readFile(zipPath);
	const digest = sha256(bytes);
	await writeFile(join(output, 'SHA256SUMS'), `${digest}  ${ASSET}\n`, { flag: 'wx' });
	const manifest = { sourceRevision: revision, trackedDirtyForQA: Boolean(status.trim()), archive: ASSET,
		sha256: digest, bytes: bytes.length, files: NAMES.map(name => ({ name, sha256: sha256(files[name]) })) };
	await writeFile(join(output, 'build-manifest.json'), JSON.stringify(manifest, null, 2) + '\n', { flag: 'wx' });
	return manifest;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
	assert.equal(process.argv[2], '--output-dir', 'Use --output-dir with an existing empty output directory.');
	assert.ok(process.argv[3] && process.argv.length === 4);
	console.log(JSON.stringify(await buildOffline(process.argv[3]), null, 2));
}
