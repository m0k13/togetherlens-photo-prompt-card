import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { lstat, mkdir, readFile, utimes, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const ASSET = 'togetherlens-html-invitation-kit-2026-10-03.zip';
export const NAMES = ['LICENSE', 'README.md', 'add-invitation-block.md', 'invitation-block-snippet.html', 'invitation-block.html'];
const INPUTS = ['LICENSE', 'docs/publisher-kit-start.md', 'docs/add-invitation-block.md', 'examples/invitation-block.html'];
const normalize = value => value.trim().split('\n').map(line => line.trim()).join('\n');
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');

export function renderFiles({ license, start, guide, example }) {
	assert.equal((example.match(/<!-- invitation-block:start -->/g) || []).length, 1);
	assert.equal((example.match(/<!-- invitation-block:end -->/g) || []).length, 1);
	const snippet = example.match(/<!-- invitation-block:start -->([\s\S]*?)<!-- invitation-block:end -->/)[1].trim() + '\n';
	const documented = guide.match(/```html\n([\s\S]*?)\n```/)?.[1];
	assert.equal(normalize(snippet), normalize(documented), 'The guide and actual block must match.');
	assert.equal((example.match(/href="\.\.\/"/g) || []).length, 1);
	const preview = example.replace('href="../"', 'href="https://m0k13.github.io/togetherlens-photo-prompt-card/"');
	for (const html of [preview, snippet]) {
		assert.doesNotMatch(html, /<(?:script|iframe|form|input|img|link|video|audio)\b|\bon[a-z]+\s*=|url\s*\(|@import|\b(?:fetch|localStorage|sessionStorage|sendBeacon)\s*[.(]/i);
		for (const href of [...html.matchAll(/href="([^"]+)"/g)].map(match => match[1])) {
			const url = new URL(href);
			assert.equal(url.protocol, 'https:');
			assert.ok(['m0k13.github.io', 'github.com', 'togetherlens.app'].includes(url.hostname));
			assert.equal(url.search, '');
		}
		for (const notice of ['It is fine to say no.', 'paid tokens', 'Premium is optional', "parent or guardian", 'This block sends nothing.']) {
			assert.ok(html.includes(notice), `Missing notice: ${notice}`);
		}
	}
	assert.match(license, /^MIT License/);
	assert.match(start, /This ZIP is a separate website-integration kit/);
	const files = { 'LICENSE': license, 'README.md': start, 'add-invitation-block.md': guide,
		'invitation-block-snippet.html': snippet, 'invitation-block.html': preview };
	assert.deepEqual(Object.keys(files).sort(), NAMES);
	return files;
}

export async function buildKit(outputDir, { allowDirty = false } = {}) {
	const status = execFileSync('git', ['status', '--porcelain', '--untracked-files=no'], { cwd: ROOT, encoding: 'utf8' });
	assert.ok(allowDirty || status.trim() === '', 'Release builds require a tracked-clean checkout.');
	const revision = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: ROOT, encoding: 'utf8' }).trim();
	const sources = [];
	for (const input of INPUTS) {
		assert.ok((await lstat(join(ROOT, input))).isFile(), 'Do not package symlinks or directories.');
		sources.push(await readFile(join(ROOT, input), 'utf8'));
	}
	const files = renderFiles({ license: sources[0], start: sources[1], guide: sources[2], example: sources[3] });
	const output = resolve(outputDir);
	const stage = join(output, 'html-invitation-kit');
	await mkdir(stage); // Existing output or stage is an error; never clobber it.
	const stamp = new Date('2026-10-03T00:00:00Z');
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
	console.log(JSON.stringify(await buildKit(process.argv[3]), null, 2));
}
