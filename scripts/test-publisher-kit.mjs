import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { ASSET, NAMES, ROOT, buildKit, renderFiles } from './build-publisher-kit.mjs';

const source = {
	license: await readFile(join(ROOT, 'LICENSE'), 'utf8'),
	start: await readFile(join(ROOT, 'docs/publisher-kit-start.md'), 'utf8'),
	guide: await readFile(join(ROOT, 'docs/add-invitation-block.md'), 'utf8'),
	example: await readFile(join(ROOT, 'examples/invitation-block.html'), 'utf8'),
};
const files = renderFiles(source);

test('only five reviewed files ship, with exact guide and license', () => {
	assert.deepEqual(Object.keys(files).sort(), NAMES);
	assert.equal(files.LICENSE, source.license);
	assert.equal(files['add-invitation-block.md'], source.guide);
	assert.equal(files['README.md'], source.start);
	assert.doesNotMatch(files['invitation-block.html'], /href="\.\.\//);
	assert.equal(files['invitation-block.html'], source.example.replace('href="../"', 'href="https://m0k13.github.io/togetherlens-photo-prompt-card/"'));
});

test('reject scripts, local handoffs, altered snippets and missing notices', () => {
	for (const example of [source.example.replace('</head>', '<script>alert(1)</script></head>'),
		source.example.replace('href="../"', 'href="file:///private/example"'),
		source.example.replace('It is fine to say no.', 'Please take part.'),
		source.example.replace('<!-- invitation-block:end -->', '<!-- missing -->')]) {
		assert.throws(() => renderFiles({ ...source, example }));
	}
});

test('setup names the real five files and does not imply free photo generation', () => {
	for (const name of NAMES) assert.ok(source.start.includes('`' + name + '`'));
	assert.match(source.start, /photo generation uses paid tokens and Premium is optional/);
	assert.match(source.start, /not on a public page/);
	assert.match(source.start, /Keep its copyright and permission notice/);
});

test('ZIP round-trip is exact and reproducible; duplicate output is refused', async () => {
	const first = await mkdtemp(join(tmpdir(), 'tl-kit-qa-first-'));
	const second = await mkdtemp(join(tmpdir(), 'tl-kit-qa-second-'));
	const a = await buildKit(first, { allowDirty: true });
	const b = await buildKit(second, { allowDirty: true });
	assert.equal(a.sha256, b.sha256);
	const names = execFileSync('unzip', ['-Z1', join(first, ASSET)], { encoding: 'utf8' }).trim().split('\n');
	assert.deepEqual(names, NAMES);
	for (const name of NAMES) assert.equal(execFileSync('unzip', ['-p', join(first, ASSET), name], { encoding: 'utf8' }), files[name]);
	assert.equal(await readFile(join(first, 'SHA256SUMS'), 'utf8'), `${a.sha256}  ${ASSET}\n`);
	await assert.rejects(buildKit(first, { allowDirty: true }), /EEXIST/);
});

test('README exposes the kit without changing the package install contract', async () => {
	const readme = await readFile(join(ROOT, 'README.md'), 'utf8');
	assert.ok(readme.includes('/releases/tag/invitation-kit-2026-10-03'));
	assert.ok(readme.includes('](docs/publisher-kit-start.md)'));
	assert.ok(readme.includes('releases/download/v0.1.0/togetherlens-photo-prompt-card-0.1.0-release.tgz'));
	const pkg = JSON.parse(await readFile(join(ROOT, 'package.json'), 'utf8'));
	assert.equal(pkg.version, '0.1.0');
	assert.equal(pkg.exports['.'], './index.js');
});
