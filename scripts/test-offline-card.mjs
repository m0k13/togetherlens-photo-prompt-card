import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtemp, readFile, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import vm from 'node:vm';
import { contexts } from '../index.js';
import { ASSET, NAMES, PUBLIC_CARD, ROOT, buildOffline, renderOffline } from './build-offline-card.mjs';

const html = await readFile(join(ROOT, 'index.html'), 'utf8');
const offline = renderOffline(html);
const guide = await readFile(join(ROOT, 'docs/offline-invitation-start.md'), 'utf8');
const controller = offline.match(/<script>([\s\S]*?)<\/script>/)?.[1];
assert.ok(controller, 'Run the actual emitted standalone controller.');

function mount({ address = 'file:///Users/local-only/private-folder/photo-invitation.html', rejectClipboard = false, missingClipboard = false, rejectPrint = false, rejectHistory = false } = {}) {
	const location = new URL(address);
	const elements = new Map();
	const clipboard = [], focus = [], downloads = [], requested = [], printed = [], revoked = [], timers = [];
	function node(id, dataset = {}) {
		const element = { id, dataset, value: '', textContent: '', hidden: false, handlers: {}, attributes: {},
			addEventListener(event, handler) { this.handlers[event] = handler; },
			setAttribute(key, value) { this.attributes[key] = value; },
			focus() { focus.push(`${id}:focus`); }, select() { focus.push(`${id}:select`); },
			click() { requested.push({ href: this.href, name: this.download }); },
			set innerHTML(value) { assert.fail('Never interpret input as HTML.'); } };
		elements.set(id, element);
		return element;
	}
	for (const id of [...offline.matchAll(/\bid="([^"]+)"/g)].map(match => match[1])) node(id);
	for (const id of ['scene', 'print-app']) elements.get(id).href = offline.match(new RegExp(`<a id="${id}" href="([^"]+)"`))[1].replaceAll('&amp;', '&');
	const app = node('app-anchor');
	app.href = offline.match(/<section class="app">[\s\S]*?href="([^"]+)"/)[1].replaceAll('&amp;', '&');
	const audience = [...offline.matchAll(/data-context="([^"]+)"/g)].map(match => node(`context-${match[1]}`, { context: match[1] }));
	const formats = [...offline.matchAll(/data-format="([^"]+)"/g)].map(match => node(`format-${match[1]}`, { format: match[1] }));
	class BrowserURL extends URL {
		static createObjectURL(blob) { downloads.push(blob); return 'blob:local-only'; }
		static revokeObjectURL(address) { revoked.push(address); }
	}
	const windowHandlers = {};
	const noNetwork = () => assert.fail('No network call belongs in the offline editor.');
	const navigator = missingClipboard ? {} : { clipboard: { async writeText(value) { if (rejectClipboard) throw new Error('Clipboard unavailable'); clipboard.push(value); } } };
	navigator.sendBeacon = noNetwork;
	vm.runInNewContext(controller, {
		URL: BrowserURL, URLSearchParams, Blob, location, navigator,
		fetch: noNetwork, XMLHttpRequest: noNetwork, WebSocket: noNetwork, EventSource: noNetwork,
		get localStorage() { return noNetwork(); }, get sessionStorage() { return noNetwork(); },
		history: { state: null, replaceState(state, title, address) { if (rejectHistory) throw new Error('History unavailable'); const updated = new URL(address, location); assert.equal(updated.protocol, location.protocol); location.href = updated.href; } },
		window: { addEventListener(event, handler) { windowHandlers[event] = handler; }, print() { if (rejectPrint) throw new Error('Printing unavailable'); printed.push({ title: elements.get('title').textContent, note: elements.get('note-preview').textContent, app: elements.get('print-app').href, scene: elements.get('print-scene-url').textContent }); } },
		document: {
			getElementById(id) { assert.ok(elements.has(id), `Unknown node: ${id}`); return elements.get(id); },
			querySelector(selector) { assert.equal(selector, '.app a'); return app; },
			querySelectorAll(selector) { if (selector === '[data-context]') return audience; assert.equal(selector, '[data-format]'); return formats; },
			createElement(tag) { assert.equal(tag, 'a'); return node('download-anchor'); },
		},
		setTimeout(callback, delay) { assert.equal(delay, 1000); timers.push(callback); },
	});
	return { elements, app, location, clipboard, focus, downloads, requested, printed, revoked, timers, windowHandlers,
		choose(context, format) { elements.get('contexts').handlers.click({ target: { dataset: { context } } }); elements.get('formats').handlers.click({ target: { dataset: { format } } }); } };
}

test('standalone output has one classic embedded controller and no runtime assets', () => {
	assert.equal((offline.match(/<script>/g) || []).length, 1);
	assert.doesNotMatch(offline.replace(/<script>[\s\S]*?<\/script>/, ''), /type="module"|\bsrc=|<link\b|<img\b|@import|url\s*\(|<iframe\b|<form\b|type="file"/i);
	assert.doesNotMatch(controller, /\bimport\b|fetch\s*\(|sendBeacon\s*\(|localStorage|sessionStorage/);
	assert.ok(offline.includes('Offline invitation editor.'));
	assert.ok(offline.includes('Scene planning and app-guide links need internet access.'));
	assert.ok(!offline.includes('Hosted by GitHub Pages.'));
	assert.ok(!offline.includes('id="offline-download"'));
});

for (const context of Object.keys(contexts)) for (const format of ['text', 'markdown']) {
	test(`local ${context}/${format} supports note, copy, generic text download, print and public recipient link`, async () => {
		const page = mount();
		page.choose(context, format);
		const note = page.elements.get('note');
		note.value = 'Choose the scene before selecting portraits.';
		note.handlers.input();
		assert.equal(page.elements.get('title').textContent, contexts[context].title);
		assert.ok(page.elements.get('output').value.includes(contexts[context].body));
		assert.ok(page.elements.get('output').value.includes(format === 'markdown' ? note.value.replaceAll('.', '\\.') : note.value));
		assert.ok(page.elements.get('output').value.includes('App photo generation uses paid tokens. Use portraits only with permission.'));
		assert.equal(page.elements.get('scene').href, 'https://togetherlens.app/duel/');
		assert.equal(page.app.href, 'https://togetherlens.app/create/combine-separate-photos/');
		await page.elements.get('copy').handlers.click();
		assert.equal(page.clipboard[0], page.elements.get('output').value);
		page.elements.get('download').handlers.click();
		assert.equal(await page.downloads[0].text(), page.elements.get('output').value);
		assert.equal(page.downloads[0].type, 'text/plain;charset=utf-8');
		assert.deepEqual(page.requested, [{ href: 'blob:local-only', name: `togetherlens-${context}-invitation.${format === 'markdown' ? 'md' : 'txt'}` }]);
		assert.deepEqual(page.revoked, []);
		page.timers[0]();
		assert.deepEqual(page.revoked, ['blob:local-only']);
		page.elements.get('print').handlers.click();
		assert.deepEqual(page.printed, [{ title: contexts[context].title, note: note.value, app: page.app.href, scene: page.elements.get('scene').href }]);
		assert.match(page.elements.get('status').textContent, /^Print dialog requested/);
		await page.elements.get('copy-link').handlers.click();
		assert.equal(page.elements.get('share-url').value, PUBLIC_CARD + `#context=${context}&format=${format}`);
		assert.doesNotMatch(page.elements.get('share-url').value, /file:|private-folder|local-only|Choose|utm_/);
		assert.equal(new URL(page.elements.get('share-url').value).search, '');
		const recipient = mount({ address: page.elements.get('share-url').value });
		assert.equal(recipient.elements.get('title').textContent, contexts[context].title);
		assert.equal(recipient.elements.get('note').value, '');
		assert.ok(!recipient.elements.get('output').value.includes('Choose the scene before selecting portraits'));
		assert.ok(recipient.elements.get('output').value.startsWith(format === 'markdown' ? '> **' : contexts[context].title));
	});
}

for (const missingClipboard of [false, true]) test(`local clipboard fallback selects text and the public link, missing=${missingClipboard}`, async () => {
	const page = mount({ rejectClipboard: true, missingClipboard, rejectHistory: true });
	page.choose('couple', 'markdown');
	page.elements.get('note').value = 'Wait until everyone agrees.';
	page.elements.get('note').handlers.input();
	await page.elements.get('copy').handlers.click();
	assert.deepEqual(page.focus, ['output:focus', 'output:select']);
	assert.ok(page.elements.get('output').value.includes('Wait until everyone agrees\\.'));
	await page.elements.get('copy-link').handlers.click();
	assert.deepEqual(page.focus.slice(-2), ['share-url:focus', 'share-url:select']);
	assert.equal(page.elements.get('share-url').value, PUBLIC_CARD + '#context=couple&format=markdown');
	assert.match(page.elements.get('status').textContent, /does not include your optional note/);
});

for (const query of ['?utm_source=youtube&utm_medium=organic&utm_campaign=starter_playlist_demo_20260914', '?utm_source=reddit&utm_medium=organic&utm_campaign=webapps_card_20261002', '?email=private@example.com&token=private', '?utm_source=other&utm_source=youtube&file=private']) {
	test(`local or rehosted copy never assigns source attribution from ${query}`, async () => {
		for (const base of ['file:///private/file.html', 'https://example.com/rehosted-card.html']) {
			const page = mount({ address: base + query + '#context=team&format=markdown&note=private' });
			await page.elements.get('copy-link').handlers.click();
			assert.equal(page.elements.get('share-url').value, PUBLIC_CARD + '#context=team&format=markdown');
			assert.equal(page.app.href, 'https://togetherlens.app/create/combine-separate-photos/');
			assert.equal(page.elements.get('scene').href, 'https://togetherlens.app/duel/');
			assert.doesNotMatch(page.elements.get('output').value, /utm_|private@example|file:|example\.com|token=|note=/);
		}
	});
}

test('local notes are literal, bounded, reset on audience/hash/reload, and never saved in a URL', async () => {
	const page = mount();
	page.elements.get('note').value = '<script>alert(1)</script> ' + 'x'.repeat(240);
	page.elements.get('note').handlers.input();
	assert.equal(page.elements.get('note').value.length, 240);
	assert.ok(page.elements.get('note-preview').textContent.startsWith('<script>'));
	assert.equal(page.location.search, '');
	page.choose('couple', 'text');
	assert.equal(page.elements.get('note').value, '');
	page.elements.get('note').value = 'A fresh instruction';
	page.elements.get('note').handlers.input();
	page.location.hash = '#context=team&format=markdown';
	page.windowHandlers.hashchange();
	assert.equal(page.elements.get('note').value, '');
	assert.equal(page.elements.get('title').textContent, contexts.team.title);
	assert.equal(mount({ address: page.location.href }).elements.get('note').value, '');
	page.elements.get('note').value = 'Clear this';
	page.elements.get('note').handlers.input();
	page.elements.get('clear-note').handlers.click();
	assert.equal(page.elements.get('note-preview').hidden, true);
	assert.equal(page.focus.at(-1), 'note:focus');
});

test('print failure offers existing alternatives and never claims a saved file', () => {
	const page = mount({ rejectPrint: true });
	page.elements.get('print').handlers.click();
	assert.deepEqual(page.printed, []);
	assert.match(page.elements.get('status').textContent, /Printing is unavailable here/);
	assert.doesNotMatch(page.elements.get('status').textContent, /printed|saved successfully/);
});

test('reject missing notices, scripts, runtime assets and changed packaging seams', () => {
	for (const source of [html.replace('Taking part is optional.', ''), html.replace('parent or guardian', ''), html.replace('Premium is optional and auto-renews', ''), html.replace('</head>', '<script>alert(1)</script></head>'), html.replace('</head>', '<link rel="stylesheet" href="https://example.com/style.css"></head>'), html.replace("import {contexts} from './index.js';", "import {contexts} from './unexpected.js';"), html.replace('const shared=new URL(location.pathname,location.origin);', 'const shared=new URL(location.href);'), html.replace('const knownCampaign=fromPlaylist || fromWebApps;', 'const knownCampaign=true;'), html.replace('render();\n</script>', 'fetch("https://example.com/private");render();\n</script>')]) assert.throws(() => renderOffline(source));
});

test('archive has exactly the reviewed editor, instructions and license, reproducibly and without drafts', async () => {
	const first = await mkdtemp(join(tmpdir(), 'tl-offline-qa-first-'));
	const second = await mkdtemp(join(tmpdir(), 'tl-offline-qa-second-'));
	const a = await buildOffline(first, { allowDirty: true });
	const b = await buildOffline(second, { allowDirty: true });
	assert.equal(a.sha256, b.sha256);
	assert.deepEqual(execFileSync('unzip', ['-Z1', join(first, ASSET)], { encoding: 'utf8' }).trim().split('\n'), NAMES);
	assert.equal(execFileSync('unzip', ['-p', join(first, ASSET), 'photo-invitation.html'], { encoding: 'utf8' }), offline);
	assert.equal(execFileSync('unzip', ['-p', join(first, ASSET), 'README.md'], { encoding: 'utf8' }), guide);
	assert.equal(execFileSync('unzip', ['-p', join(first, ASSET), 'LICENSE'], { encoding: 'utf8' }), await readFile(join(ROOT, 'LICENSE'), 'utf8'));
	assert.equal(await readFile(join(first, 'SHA256SUMS'), 'utf8'), `${a.sha256}  ${ASSET}\n`);
	await assert.rejects(buildOffline(first, { allowDirty: true }), /EEXIST/);
});

test('reject output inside source, symlink output, existing archives and dirty release build', async () => {
	await assert.rejects(buildOffline(ROOT, { allowDirty: true }), /outside/);
	const parent = await mkdtemp(join(tmpdir(), 'tl-offline-output-guards-'));
	const target = await mkdtemp(join(tmpdir(), 'tl-offline-output-target-'));
	await symlink(target, join(parent, 'linked-output'));
	await assert.rejects(buildOffline(join(parent, 'linked-output'), { allowDirty: true }), /not a symlink/);
	const existing = await mkdtemp(join(tmpdir(), 'tl-offline-existing-'));
	await writeFile(join(existing, ASSET), 'preserve me');
	await assert.rejects(buildOffline(existing, { allowDirty: true }), /Refusing to overwrite/);
	assert.equal(await readFile(join(existing, ASSET), 'utf8'), 'preserve me');
	if (execFileSync('git', ['status', '--porcelain', '--untracked-files=no'], { cwd: ROOT, encoding: 'utf8' }).trim()) await assert.rejects(buildOffline(target), /tracked-clean/);
});

test('download discovery and instructions separate offline text from paid online generation', async () => {
	const readme = await readFile(join(ROOT, 'README.md'), 'utf8');
	assert.equal((html.match(/id="offline-download"/g) || []).length, 1);
	assert.ok(html.includes('/releases/tag/offline-invitation-2026-10-09'));
	assert.ok(readme.includes('](docs/offline-invitation-start.md)'));
	for (const file of NAMES) assert.ok(guide.includes('`' + file + '`'));
	for (const boundary of ['text, not photos', 'without a connection', 'need internet access', 'not your local file', 'clears the note', 'paid tokens', 'Premium is optional and auto-renews', 'parent or guardian', 'new AI composition']) assert.ok(guide.includes(boundary), boundary);
	assert.doesNotMatch(guide, /utm_source=|utm_campaign=|automatic sending|free photo generation/);
	assert.ok(readme.includes('/releases/tag/invitation-kit-2026-10-03'));
	assert.equal(JSON.parse(await readFile(join(ROOT, 'package.json'), 'utf8')).version, '0.1.0');
});
