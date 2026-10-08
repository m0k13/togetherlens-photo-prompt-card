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

function mount(query = '', hash = '', { rejectHistory = false, rejectClipboard = false, source = script } = {}) {
  const clipboard = [];
  const downloads = [];
  const focusEvents = [];
  class BrowserURL extends URL {
    static createObjectURL(blob) { downloads.push(blob); return 'blob:local-test'; }
    static revokeObjectURL() {}
  }
  const location = new URL(base + query + hash);
  const historyCalls = [];
  const historyState = { previousPageState: 'preserved' };
  const elements = new Map();
  const makeNode = (id, dataset = {}) => {
    const node = {
      id, dataset, value: '', textContent: '', hidden: false, attributes: {}, handlers: {},
      addEventListener(name, handler) { this.handlers[name] = handler; },
      setAttribute(name, value) { this.attributes[name] = value; },
      focus() { focusEvents.push(`${id}:focus`); }, select() { focusEvents.push(`${id}:select`); }, click() {},
      set innerHTML(value) { assert.fail('Organizer input must never become HTML.'); },
    };
    elements.set(id, node);
    return node;
  };
  for (const id of ['output', 'title', 'body', 'share-result', 'share-url', 'status', 'contexts', 'formats', 'copy', 'copy-link', 'download', 'note', 'note-preview', 'note-count', 'clear-note']) makeNode(id);
  const scene = makeNode('scene');
  const app = makeNode('app');
  scene.href = `https://togetherlens.app/duel/${defaultQuery}`;
  app.href = `https://togetherlens.app/create/combine-separate-photos/${defaultQuery}`;
  const contextButtons = ['family', 'couple', 'team'].map(context => makeNode(`context-${context}`, { context }));
  const formatButtons = ['text', 'markdown'].map(format => makeNode(`format-${format}`, { format }));
  const windowHandlers = {};
  vm.runInNewContext(source, {
    contexts, URL: BrowserURL, URLSearchParams, Blob,
    location,
    history: {
      state: historyState,
      replaceState(state, title, address) {
        if (rejectHistory) throw new Error('History replacement is unavailable');
        assert.equal(state, historyState, 'Retain the browser history entry state.');
        assert.equal(title, '');
        const next = new URL(address, location);
        assert.equal(next.origin, location.origin, 'Do not navigate to another origin.');
        historyCalls.push(next.href);
        location.href = next.href;
      },
      pushState() { assert.fail('Choices must not add Back entries.'); },
    },
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
    navigator: { clipboard: { async writeText(value) { if (rejectClipboard) throw new Error('Clipboard unavailable'); clipboard.push(value); } } },
    setTimeout() {},
  });
  return { elements, scene, app, contextButtons, formatButtons, clipboard, downloads, focusEvents, windowHandlers, location, historyCalls };
}

function choose(page, context, format) {
  page.elements.get('contexts').handlers.click({ target: { dataset: { context } } });
  page.elements.get('formats').handlers.click({ target: { dataset: { format } } });
}

for (const context of ['family', 'couple', 'team']) {
  for (const format of ['text', 'markdown']) {
    test(`selected ${context}/${format} survives address sharing and reload`, () => {
      const page = mount('', '#context=couple&format=markdown');
      choose(page, context, format);
      assert.equal(page.location.href, base + `#context=${context}&format=${format}`);
      assert.equal(page.historyCalls.length, 2);
      const reloaded = mount(page.location.search, page.location.hash);
      assert.equal(reloaded.elements.get('output').value, page.elements.get('output').value);
      assert.equal(reloaded.contextButtons.find(button => button.dataset.context === context).attributes['aria-pressed'], 'true');
      assert.equal(reloaded.formatButtons.find(button => button.dataset.format === format).attributes['aria-pressed'], 'true');
    });
  }
}

for (const query of [redditQuery, ...['starter_playlist_demo_20260914', 'card_link_post_20260915'].map(campaign => `?utm_source=youtube&utm_medium=organic&utm_campaign=${campaign}`)]) {
  test(`choice synchronization preserves the existing exact campaign: ${query}`, async () => {
    const page = mount(query, '#context=family&format=text');
    const scene = page.scene.href;
    const app = page.app.href;
    choose(page, 'team', 'markdown');
    assert.equal(page.location.search, query);
    assert.equal(page.scene.href, scene);
    assert.equal(page.app.href, app);
    const reloaded = mount(page.location.search, page.location.hash);
    assert.equal(reloaded.elements.get('output').value, page.elements.get('output').value);
    await page.elements.get('copy-link').handlers.click();
    assert.equal(page.elements.get('share-url').value, page.location.href);
  });
}

test('initial load and external fragment changes do not rewrite browser history', () => {
  const page = mount('', '#context=couple&format=markdown');
  assert.deepEqual(page.historyCalls, []);
  page.location.hash = 'context=team&format=text';
  page.windowHandlers.hashchange();
  assert.equal(page.elements.get('title').textContent, contexts.team.title);
  assert.ok(page.elements.get('output').value.startsWith(contexts.team.title));
  assert.deepEqual(page.historyCalls, []);
});

test('invalid or duplicate fragment fields retain the existing safe defaults', () => {
  for (const hash of ['#context=private&format=html', '#context=couple&context=team&format=markdown&format=text']) {
    const page = mount('', hash);
    assert.equal(page.elements.get('title').textContent, contexts.family.title);
    assert.ok(page.elements.get('output').value.startsWith(contexts.family.title));
    choose(page, 'team', 'text');
    assert.equal(page.location.hash, '#context=team&format=text');
  }
});

test('synchronized fragments contain only finite public choices, not private extras', async () => {
  const query = redditQuery + '&email=private@example.com';
  const page = mount(query, '#context=family&format=text&token=private-token');
  choose(page, 'couple', 'markdown');
  assert.equal(page.location.search, query, 'Leave the address query untouched, without forwarding it.');
  assert.equal(page.location.hash, '#context=couple&format=markdown');
  assert.equal(page.app.href, `https://togetherlens.app/create/combine-separate-photos/${defaultQuery}`);
  await page.elements.get('copy-link').handlers.click();
  assert.equal(page.elements.get('share-url').value, base + '#context=couple&format=markdown');
  assert.doesNotMatch(page.elements.get('output').value, /private@example|private-token/);
});

test('non-choice clicks and unsupported dataset values leave the card and URL unchanged', () => {
  const page = mount('', '#context=couple&format=markdown');
  const output = page.elements.get('output').value;
  for (const dataset of [{}, { context: 'private' }, { format: 'html' }]) {
    page.elements.get('contexts').handlers.click({ target: { dataset } });
    page.elements.get('formats').handlers.click({ target: { dataset } });
  }
  assert.equal(page.elements.get('output').value, output);
  assert.equal(page.location.href, base + '#context=couple&format=markdown');
  assert.deepEqual(page.historyCalls, []);
});

test('unavailable browser history does not break controls or the explicit recipient link', async () => {
  const page = mount('', '#context=couple&format=markdown', { rejectHistory: true });
  choose(page, 'team', 'text');
  assert.equal(page.elements.get('title').textContent, contexts.team.title);
  assert.ok(page.elements.get('output').value.startsWith(contexts.team.title));
  await page.elements.get('copy-link').handlers.click();
  assert.equal(page.elements.get('share-url').value, base + '#context=team&format=text');
  assert.deepEqual(page.historyCalls, []);
});

test('the repair needs no storage, photos, network requests or extra tracking', () => {
  assert.doesNotMatch(script, /\b(?:fetch|XMLHttpRequest|sendBeacon|localStorage|sessionStorage|indexedDB)\b|document\.cookie/);
  assert.doesNotMatch(html, /<(?:form|iframe)\b|type=["']file["']/i);
});

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

test('an optional organizer note changes copy-ready text without changing links', async () => {
  const page = mount(redditQuery);
  const original = page.elements.get('output').value;
  const scene = page.scene.href;
  const app = page.app.href;
  const note = page.elements.get('note');
  assert.ok(note, 'The actual browser tool needs an optional note field.');
  note.value = 'Please agree on a window-lit scene before choosing portraits.';
  note.handlers.input();
  assert.ok(page.elements.get('output').value.includes(note.value));
  assert.equal(page.elements.get('note-preview').textContent, note.value);
  assert.equal(page.elements.get('note-preview').hidden, false);
  assert.equal(page.scene.href, scene);
  assert.equal(page.app.href, app);
  assert.equal(page.location.href, base + redditQuery);
  await page.elements.get('copy').handlers.click();
  assert.equal(page.clipboard.at(-1), page.elements.get('output').value);
  page.elements.get('clear-note').handlers.click();
  assert.equal(page.elements.get('output').value, original);
});

function enterNote(page, value) {
  page.elements.get('note').value = value;
  page.elements.get('note').handlers.input();
}

function requireReadmeNoteGuide(content) {
  const guide = content.match(/## Send an invitation with your instruction\n([\s\S]*?)\n## Before anyone shares a portrait/)?.[1];
  assert.ok(guide, 'Keep the note-bearing invitation task before the photo permission checklist.');
  for (const label of ['Add an organizer note', 'Copy invitation', 'Download text', 'Copy link to this card']) {
    assert.ok(guide.includes(`**${label}**`), `Document the actual ${label} control.`);
    assert.ok(html.includes(`>${label}<`), `The documented ${label} control must exist.`);
  }
  assert.match(guide, /up to 240 characters/);
  assert.match(guide, /Keep names and contact details out\./);
  assert.match(guide, /Nothing is sent automatically\./);
  assert.match(guide, /Your browser must complete the download\./);
  assert.match(guide, /That link does not include your organizer note\./);
  assert.match(guide, /Changing the audience or reloading the page clears the note\./);
  assert.match(guide, /Do not upload or send anyone's portrait through this tool\./);
  return guide;
}

test('README distinguishes complete invitations from private-note-free preset links', () => {
  requireReadmeNoteGuide(readme);
  for (const [before, after] of [
    ['up to 240 characters', 'up to 500 characters'],
    ['Keep names and contact details out.', 'Include names and contact details.'],
    ['Nothing is sent automatically.', 'The invitation is sent automatically.'],
    ['Your browser must complete the download.', 'The file is already saved.'],
    ['That link does not include your organizer note.', 'That link includes your organizer note.'],
    ['Changing the audience or reloading the page clears the note.', 'The note survives a reload.'],
    ["Do not upload or send anyone's portrait through this tool.", 'Upload the portraits here.'],
  ]) assert.throws(() => requireReadmeNoteGuide(readme.replace(before, after)));
});

for (const context of ['family', 'couple', 'team']) {
  for (const format of ['text', 'markdown']) {
    test(`README note task matches the actual ${context}/${format} recipient path`, async () => {
      requireReadmeNoteGuide(readme);
      const page = mount('', `#context=${context}&format=${format}`);
      const note = "Let's agree on a window-lit scene before choosing portraits.";
      enterNote(page, note);
      assert.equal(page.elements.get('note-preview').textContent, note);
      await page.elements.get('copy').handlers.click();
      const copied = page.clipboard.at(-1);
      assert.ok(copied.includes(format === 'markdown' ? "Let's agree on a window\\-lit scene before choosing portraits\\." : note));
      assert.ok(copied.includes('App photo generation uses paid tokens. Use portraits only with permission.'));
      await page.elements.get('copy-link').handlers.click();
      const recipient = new URL(page.elements.get('share-url').value);
      assert.equal(recipient.hash, `#context=${context}&format=${format}`);
      assert.doesNotMatch(recipient.href, /note=|window-lit|portraits\./);
      const reopened = mount(recipient.search, recipient.hash);
      assert.equal(reopened.elements.get('note').value, '');
      assert.doesNotMatch(reopened.elements.get('output').value, /window-lit/);
      page.elements.get('contexts').handlers.click({target:{dataset:{context:context === 'family' ? 'team' : 'family'}}});
      assert.equal(page.elements.get('note').value, '');
    });
  }
}

test('the optional editor is labelled, bounded and separate from fixed output', () => {
  assert.match(html, /<details class="optional-note"><summary>Add an organizer note<\/summary>/);
  assert.match(html, /<label for="note">Add a note, optional<\/label>/);
  assert.match(html, /<textarea id="note" maxlength="240" rows="3" autocomplete="off" aria-describedby="note-help note-count"/);
  assert.match(html, /<textarea id="output" readonly/);
  assert.match(html, /Card links do not include it\. Changing the audience clears it\./);
  assert.match(html, /#note-preview\{[^}]*overflow-wrap:anywhere/);
});

for (const context of ['family', 'couple', 'team']) {
  for (const format of ['text', 'markdown']) {
    test(`empty-note ${context}/${format} output is exactly the original card`, () => {
      const page = mount('', `#context=${context}&format=${format}`);
      const c = contexts[context];
      const link = page.scene.href;
      const appGuide = page.app.href;
      const note = 'Scene planning is free. App photo generation uses paid tokens. Use portraits only with permission.';
      const expected = format === 'markdown'
        ? `> **${c.title}**\n>\n> ${c.body}\n>\n> [${c.cta}](${link})\n>\n> [How to make the photo and get the app](${appGuide})\n>\n> ${note}`
        : `${c.title}\n\n${c.body}\n\n${c.cta}: ${link}\n\nHow to make the photo and get the app: ${appGuide}\n\n${note}`;
      assert.equal(page.elements.get('output').value, expected);
      assert.equal(page.elements.get('note-preview').hidden, true);
      assert.equal(page.elements.get('clear-note').disabled, true);
    });
  }
}

test('format changes keep the note, audience changes clear it, same audience does not', () => {
  const page = mount();
  enterNote(page, 'Choose a winter scene.');
  page.elements.get('formats').handlers.click({target:{dataset:{format:'markdown'}}});
  assert.equal(page.elements.get('note').value, 'Choose a winter scene.');
  assert.ok(page.elements.get('output').value.includes('> Choose a winter scene\\.'));
  page.elements.get('contexts').handlers.click({target:{dataset:{context:'family'}}});
  assert.equal(page.elements.get('note').value, 'Choose a winter scene.');
  page.elements.get('contexts').handlers.click({target:{dataset:{context:'team'}}});
  assert.equal(page.elements.get('note').value, '');
  assert.doesNotMatch(page.elements.get('output').value, /winter scene/);
  assert.equal(page.elements.get('note-preview').hidden, true);
});

test('card links, guide links, address synchronization and reload never include note text', async () => {
  for (const query of ['', redditQuery, '?utm_source=youtube&utm_medium=organic&utm_campaign=starter_playlist_demo_20260914']) {
    const page = mount(query, '#context=couple&format=text');
    const originalScene = page.scene.href;
    const originalApp = page.app.href;
    enterNote(page, 'synthetic-only-private-canary@example.invalid');
    page.elements.get('formats').handlers.click({target:{dataset:{format:'markdown'}}});
    await page.elements.get('copy-link').handlers.click();
    const recipient = new URL(page.elements.get('share-url').value);
    assert.equal(recipient.hash, '#context=couple&format=markdown');
    assert.doesNotMatch(recipient.href, /private-canary|example\.invalid|note=/);
    assert.doesNotMatch(page.location.href, /private-canary|example\.invalid|note=/);
    assert.equal(page.scene.href, originalScene);
    assert.equal(page.app.href, originalApp);
    assert.match(page.elements.get('status').textContent, /without your optional note/);
    const reloaded = mount(recipient.search, recipient.hash);
    assert.equal(reloaded.elements.get('note').value, '');
    assert.doesNotMatch(reloaded.elements.get('output').value, /private-canary/);
    assert.deepEqual(Object.keys(reloaded.elements.get('note').handlers), ['input']);
  }
});

test('external card fragment changes clear local notes; free text in a URL is ignored', () => {
  const page = mount('', '#context=couple&format=text&note=do-not-import');
  assert.equal(page.elements.get('note').value, '');
  enterNote(page, 'Only in this tab.');
  page.location.hash = '#context=team&format=text&note=do-not-import';
  page.windowHandlers.hashchange();
  assert.equal(page.elements.get('note').value, '');
  assert.doesNotMatch(page.elements.get('output').value, /Only in this tab|do-not-import/);
});

test('notes are bounded, control-cleaned, literal text; fixed notices cannot be removed', () => {
  const page = mount();
  enterNote(page, 'x'.repeat(239) + '\uD83D\uDE00' + 'y'.repeat(50));
  assert.equal(page.elements.get('note').value.length, 239);
  assert.equal(page.elements.get('note-preview').textContent.length, 239);
  assert.equal(page.elements.get('note-count').textContent, '239 / 240 characters');
  enterNote(page, '  <img src=x onerror=alert(1)>\n\u0000\t[link](javascript:alert(1)) **bold**  ');
  const literal = '<img src=x onerror=alert(1)> [link](javascript:alert(1)) **bold**';
  assert.equal(page.elements.get('note-preview').textContent, literal);
  assert.ok(page.elements.get('output').value.includes(literal));
  page.elements.get('formats').handlers.click({target:{dataset:{format:'markdown'}}});
  const output = page.elements.get('output').value;
  assert.ok(output.includes('> \\<img src=x onerror=alert\\(1\\)\\> \\[link\\]\\(javascript:alert\\(1\\)\\) \\*\\*bold\\*\\*'));
  assert.ok(output.endsWith('Scene planning is free. App photo generation uses paid tokens. Use portraits only with permission.'));
});

test('clipboard fallback selects the complete note-bearing invitation, preset fallback excludes it', async () => {
  const page = mount('', '', {rejectClipboard:true});
  enterNote(page, 'A manually shared planning instruction.');
  await page.elements.get('copy').handlers.click();
  assert.deepEqual(page.focusEvents, ['output:focus','output:select']);
  assert.ok(page.elements.get('output').value.includes('A manually shared planning instruction.'));
  await page.elements.get('copy-link').handlers.click();
  assert.deepEqual(page.focusEvents.slice(-2), ['share-url:focus','share-url:select']);
  assert.doesNotMatch(page.elements.get('share-url').value, /planning instruction/);
  assert.match(page.elements.get('status').textContent, /does not include your optional note/);
  assert.equal(page.clipboard.length, 0);
});

test('existing download prepares exact note-bearing text or Markdown, with generic filenames', async () => {
  for (const format of ['text','markdown']) {
    const page = mount('', `#context=family&format=${format}`);
    enterNote(page, 'Agree on the scene first.');
    page.elements.get('download').handlers.click();
    assert.equal(page.downloads.length, 1);
    assert.equal(await page.downloads[0].text(), page.elements.get('output').value);
    assert.equal(page.elements.get('download-anchor').download, `togetherlens-family-invitation.${format==='markdown'?'md':'txt'}`);
    assert.match(page.elements.get('status').textContent, /download requested/);
  }
});

test('negative controls reject leaking the note, rendering HTML, losing fixed notices or stale audience text', async () => {
  for (const [name, mutated] of [
    ['URL note',script.replace('shared.hash=new URLSearchParams({context,format}).toString();','shared.hash=new URLSearchParams({context,format,note:organizerNote()}).toString();')],
    ['HTML sink',script.replace("$('note-preview').textContent=extra", "$('note-preview').innerHTML=extra")],
    ['missing notices',script.replace('App photo generation uses paid tokens. Use portraits only with permission.', '')],
    ['stale audience note',script.replace("if(context!==e.target.dataset.context)$('note').value='';", '')],
  ]) {
    assert.notEqual(mutated, script, `${name} must really change the implementation`);
    await assert.rejects(async()=>{
      const page = mount('', '', {source:mutated});
      enterNote(page, 'synthetic-canary');
      await page.elements.get('copy-link').handlers.click();
      assert.doesNotMatch(page.elements.get('share-url').value, /synthetic-canary|note=/);
      assert.ok(page.elements.get('output').value.endsWith('App photo generation uses paid tokens. Use portraits only with permission.'));
      page.elements.get('contexts').handlers.click({target:{dataset:{context:'team'}}});
      assert.equal(page.elements.get('note').value, '');
    }, undefined, name);
  }
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
