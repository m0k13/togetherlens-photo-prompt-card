import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';
import { contexts } from '../index.js';

const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
const readme = await readFile(new URL('../README.md', import.meta.url), 'utf8');
const script = html.match(/<script type="module">([\s\S]*?)<\/script>/)?.[1]
  .replace("import {contexts} from './index.js';", '');
assert.ok(script, 'Exercise the actual browser script, not a copied resolver.');

const base = 'https://m0k13.github.io/togetherlens-photo-prompt-card/';
const redditQuery = '?utm_source=reddit&utm_medium=organic&utm_campaign=webapps_card_20261002';
const defaultQuery = '?utm_source=github&utm_medium=referral&utm_campaign=prompt_card_demo_20260914';

function mount(query = '', hash = '') {
  const clipboard = [];
  const elements = new Map();
  const makeNode = (id, dataset = {}) => {
    const node = {
      id, dataset, value: '', textContent: '', hidden: false, attributes: {}, handlers: {},
      addEventListener(name, handler) { this.handlers[name] = handler; },
      setAttribute(name, value) { this.attributes[name] = value; },
      focus() {}, select() {}, click() {},
    };
    elements.set(id, node);
    return node;
  };
  for (const id of ['output', 'title', 'body', 'share-result', 'share-url', 'status', 'contexts', 'formats', 'copy', 'copy-link', 'download']) makeNode(id);
  const scene = makeNode('scene');
  const app = makeNode('app');
  scene.href = `https://togetherlens.app/duel/${defaultQuery}`;
  app.href = `https://togetherlens.app/create/combine-separate-photos/${defaultQuery}`;
  const contextButtons = ['family', 'couple', 'team'].map(context => makeNode(`context-${context}`, { context }));
  const formatButtons = ['text', 'markdown'].map(format => makeNode(`format-${format}`, { format }));
  const windowHandlers = {};
  vm.runInNewContext(script, {
    contexts, URL, URLSearchParams, Blob,
    location: new URL(base + query + hash),
    window: { addEventListener(name, handler) { windowHandlers[name] = handler; } },
    document: {
      getElementById(id) { assert.ok(elements.has(id), `Unknown element ${id}`); return elements.get(id); },
      querySelector(selector) { assert.equal(selector, '.app a'); return app; },
      querySelectorAll(selector) {
        if (selector === '[data-context]') return contextButtons;
        assert.equal(selector, '[data-format]');
        return formatButtons;
      },
      createElement(name) { assert.equal(name, 'a'); return makeNode('download-anchor'); },
    },
    navigator: { clipboard: { async writeText(value) { clipboard.push(value); } } },
    setTimeout() {},
  });
  return { elements, scene, app, contextButtons, formatButtons, clipboard, windowHandlers };
}

const readmePresetLinks = Array.from(readme.matchAll(/\]\((https:\/\/m0k13\.github\.io\/togetherlens-photo-prompt-card\/#[^)]+)\)/g), match => new URL(match[1]));

test('README offers exactly the six supported audience and format presets', () => {
  assert.equal(readmePresetLinks.length, 6);
  assert.deepEqual(new Set(readmePresetLinks.map(url => url.hash)), new Set(
    ['family', 'couple', 'team'].flatMap(context => ['text', 'markdown'].map(format => `#context=${context}&format=${format}`))
  ));
  for (const url of readmePresetLinks) assert.equal(url.search, '', 'Do not label README visits as another campaign.');
});

for (const url of readmePresetLinks) {
  const preset = new URLSearchParams(url.hash.slice(1));
  const context = preset.get('context');
  const format = preset.get('format');
  test(`README ${context}/${format} link restores the actual browser card`, async () => {
    const page = mount(url.search, url.hash);
    assert.equal(page.elements.get('title').textContent, contexts[context].title);
    assert.equal(page.contextButtons.find(button => button.dataset.context === context).attributes['aria-pressed'], 'true');
    assert.equal(page.formatButtons.find(button => button.dataset.format === format).attributes['aria-pressed'], 'true');
    const output = page.elements.get('output').value;
    assert.ok(output.startsWith(format === 'markdown' ? `> **${contexts[context].title}**` : contexts[context].title));
    assert.ok(output.includes('App photo generation uses paid tokens. Use portraits only with permission.'));
    assert.equal(page.app.href, `https://togetherlens.app/create/combine-separate-photos/${defaultQuery}`);
    await page.elements.get('copy-link').handlers.click();
    assert.equal(page.elements.get('share-url').value, url.href);
  });
}

test('exact Reddit entry reaches both guides and generated text', async () => {
  const page = mount(redditQuery);
  assert.equal(page.scene.href, `https://togetherlens.app/duel/${redditQuery}`);
  assert.equal(page.app.href, `https://togetherlens.app/create/combine-separate-photos/${redditQuery}`);
  assert.ok(page.elements.get('output').value.includes(page.scene.href));
  assert.ok(page.elements.get('output').value.includes(page.app.href));
  assert.ok(page.elements.get('output').value.includes('App photo generation uses paid tokens.'));
  await page.elements.get('copy').handlers.click();
  assert.equal(page.clipboard[0], page.elements.get('output').value);
});

test('changed choices and recipient links preserve only the validated tuple', async () => {
  const page = mount(redditQuery, '#context=family&format=text&email=private@example.com');
  page.elements.get('contexts').handlers.click({ target: { dataset: { context: 'couple' } } });
  page.elements.get('formats').handlers.click({ target: { dataset: { format: 'markdown' } } });
  await page.elements.get('copy-link').handlers.click();
  const shared = page.elements.get('share-url').value;
  assert.equal(shared, base + redditQuery + '#context=couple&format=markdown');
  assert.equal(page.clipboard[0], shared);
  assert.equal(page.elements.get('share-result').hidden, false);
  assert.equal(page.contextButtons[1].attributes['aria-pressed'], 'true');
  assert.equal(page.formatButtons[1].attributes['aria-pressed'], 'true');
  const recipient = new URL(shared);
  const restored = mount(recipient.search, recipient.hash);
  assert.ok(restored.elements.get('output').value.startsWith('> **Two moments, one scene**'));
  assert.equal(restored.app.href, page.app.href);
});

for (const campaign of ['starter_playlist_demo_20260914', 'card_link_post_20260915']) {
  test(`existing YouTube campaign remains unchanged: ${campaign}`, async () => {
    const query = `?utm_source=youtube&utm_medium=organic&utm_campaign=${campaign}`;
    const page = mount(query);
    assert.equal(page.scene.href, `https://togetherlens.app/duel/${query}`);
    await page.elements.get('copy-link').handlers.click();
    assert.equal(page.elements.get('share-url').value, base + query + '#context=family&format=text');
  });
}

const invalidEntries = [
  '',
  '?utm_source=reddit&utm_medium=organic&utm_campaign=unknown',
  '?utm_source=Reddit&utm_medium=organic&utm_campaign=webapps_card_20261002',
  '?utm_source=reddit&utm_medium=paid&utm_campaign=webapps_card_20261002',
  '?utm_source=youtube&utm_medium=organic&utm_campaign=webapps_card_20261002',
  redditQuery + '&utm_source=reddit',
  redditQuery + '&utm_medium=organic',
  redditQuery + '&utm_campaign=webapps_card_20261002',
  redditQuery + '&email=private@example.com',
  redditQuery + '&utm_content=extra',
];

for (const [index, query] of invalidEntries.entries()) {
  test(`unknown, duplicate or extra query is not forwarded: ${index}`, async () => {
    const page = mount(query);
    assert.equal(page.scene.href, `https://togetherlens.app/duel/${defaultQuery}`);
    assert.equal(page.app.href, `https://togetherlens.app/create/combine-separate-photos/${defaultQuery}`);
    await page.elements.get('copy-link').handlers.click();
    assert.equal(page.elements.get('share-url').value, base + '#context=family&format=text');
  });
}
