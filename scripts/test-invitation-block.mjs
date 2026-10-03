import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const example = await readFile(new URL('../examples/invitation-block.html', import.meta.url), 'utf8');
const guide = await readFile(new URL('../docs/add-invitation-block.md', import.meta.url), 'utf8');
const readme = await readFile(new URL('../README.md', import.meta.url), 'utf8');
const block = example.match(/<!-- invitation-block:start -->([\s\S]*?)<!-- invitation-block:end -->/)?.[1];
const documentedBlock = guide.match(/```html\n([\s\S]*?)\n```/)?.[1];
assert.ok(block && documentedBlock, 'Exercise the actual published and documented blocks.');
const normalize = value => value.trim().split('\n').map(line => line.trim()).join('\n');

test('the documented block is the actual live example', () => {
	assert.equal(normalize(block), normalize(documentedBlock));
	assert.ok(readme.includes('](docs/add-invitation-block.md)'));
	assert.ok(readme.includes('https://m0k13.github.io/togetherlens-photo-prompt-card/examples/invitation-block.html'));
});

test('native controls need no scripts, forms, embeds, assets, or private fields', () => {
	for (const html of [example, block, documentedBlock]) {
		assert.doesNotMatch(html, /<(?:script|iframe|form|input|img|link|video|audio)\b|\bon[a-z]+\s*=|url\s*\(|@import|\b(?:fetch|localStorage|sessionStorage|sendBeacon)\s*[.(]/i);
	}
	assert.match(block, /<details>\s*<summary>Open invitation text<\/summary>/);
	assert.match(block, /<label>Invitation text to copy\s*<textarea readonly rows="12" spellcheck="false">/);
	assert.doesNotMatch(block, /\bid=|\bname=|\bcontenteditable=/);
});

test('permission, refusal, guardian, AI, price, and manual-sending boundaries stay visible', () => {
	for (const copy of [
		'It is fine to say no.',
		"For a child's photo, we will ask their parent or guardian first.",
		'not a record of an event we attended together',
		'agree who may see it before sharing',
		'Add personal details in your own chat',
		'This block sends nothing.',
		'photo generation uses paid tokens',
		'Premium is optional.',
		'Review current prices and terms before buying.',
	]) assert.ok(block.includes(copy), `Missing boundary: ${copy}`);
	assert.doesNotMatch(block, /generation is free|Premium is required|full-quality|more scenes|sends automatically|imports your prompt/i);
	assert.match(guide, /static text is visible to anyone who can view the page/);
});

test('only two exact untagged handoffs exist in the reusable block', () => {
	const links = [...block.matchAll(/href="([^"]+)"/g)].map(match => new URL(match[1]));
	assert.deepEqual(links.map(url => url.href), [
		'https://m0k13.github.io/togetherlens-photo-prompt-card/',
		'https://togetherlens.app/create/combine-separate-photos/',
	]);
	for (const url of links) {
		assert.equal(url.search, '');
		assert.equal(url.hash, '');
	}
});

test('reusable CSS is scoped and supports readable mobile controls and focus', () => {
	const css = block.match(/<style>([\s\S]*?)<\/style>/)?.[1];
	assert.ok(css);
	const selectors = [...css.matchAll(/([^{}]+)\{[^{}]*\}/g)].map(match => match[1].trim());
	for (const selector of selectors) {
		for (const part of selector.split(',')) assert.ok(part.trim().startsWith('.tl-photo-invite'), `Unscoped selector: ${part}`);
	}
	assert.match(css, /width: 100%/);
	assert.match(css, /min-height: 44px/);
	assert.match(css, /:focus-visible \{ outline: 3px solid/);
});
