import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const svg = readFileSync(new URL('../assets/invitation-share.svg', import.meta.url), 'utf8');
const image = readFileSync(new URL('../assets/invitation-share.png', import.meta.url));
const base = execFileSync('git', ['show', 'e6291764bbba61e256e7d52467658ea67d3b54f7:index.html'], {encoding:'utf8'});
const page = 'https://m0k13.github.io/togetherlens-photo-prompt-card/';
const imageUrl = `${page}assets/invitation-share.png`;
const description = 'Create a free invitation card for a family, couple or small team photo. Copy it as text or Markdown. No photo upload.';
const alt = 'TogetherLens invitation text tool with a family card. Creates text, not photos; app photo generation uses paid tokens.';
const expected = new Map([
  ['og:type', 'website'], ['og:site_name', 'TogetherLens'],
  ['og:title', 'Make a shared-photo invitation | TogetherLens'],
  ['og:description', description], ['og:url', page],
  ['og:image', imageUrl], ['og:image:type', 'image/png'],
  ['og:image:width', '1200'], ['og:image:height', '630'], ['og:image:alt', alt],
  ['twitter:card', 'summary_large_image'],
  ['twitter:title', 'Make a shared-photo invitation | TogetherLens'],
  ['twitter:description', description], ['twitter:image', imageUrl], ['twitter:image:alt', alt],
]);

function validate(source) {
  const head = source.split('</head>')[0];
  for (const [key, value] of expected) {
    const matches = [...head.matchAll(/<meta\s+(?:property|name)="([^"]+)"\s+content="([^"]*)"\s*\/?\s*>/g)].filter(m => m[1] === key);
    assert.equal(matches.length, 1, `${key} must occur once`);
    assert.equal(matches[0][2], value, `${key} must identify this public text tool`);
  }
}

test('complete, exact rich-preview metadata for the existing invitation tool', () => validate(html));
test('preview URLs never include visitor choices, campaigns or private input', () => {
  validate(html);
  for (const url of [page, imageUrl]) {
    const parsed = new URL(url);
    assert.equal(parsed.search, ''); assert.equal(parsed.hash, '');
    assert.equal(parsed.protocol, 'https:');
  }
});
test('image is an actual 1200 by 630 PNG under 200 KiB', () => {
  assert.equal(image.subarray(0,8).toString('hex'), '89504e470d0a1a0a');
  assert.equal(image.toString('ascii',12,16), 'IHDR');
  assert.equal(image.readUInt32BE(16), 1200); assert.equal(image.readUInt32BE(20), 630);
  assert.ok(image.length > 10000 && image.length < 200 * 1024);
});
test('preview remains a permission-aware text invitation, not a generated photo offer', () => {
  assert.match(svg, /Creates text, not photos/);
  assert.match(svg, /No account or photo upload/);
  assert.match(svg, /Use portraits with permission/);
  assert.match(svg, /separate app uses paid tokens/);
  assert.doesNotMatch(svg.replace('xmlns="http://www.w3.org/2000/svg"', ''), /<script|<foreignObject|href=|url\(|https?:|<image/i);
});
test('existing title, description, app disclosure and static outgoing routes stay byte-identical', () => {
  assert.equal(html.match(/<title>[\s\S]*?<\/title>/)[0], base.match(/<title>[\s\S]*?<\/title>/)[0]);
  assert.equal(html.match(/<meta name="description"[^>]+>/)[0], base.match(/<meta name="description"[^>]+>/)[0]);
  assert.equal(html.match(/<section class="app">[\s\S]*?<\/section>/)[0], base.match(/<section class="app">[\s\S]*?<\/section>/)[0]);
  const withoutPrintDetails = html.replace(/<aside class="print-details"[\s\S]*?<\/aside>/, '')
    .replace(/<p class="note" id="offline-download">[\s\S]*?<\/p>\n/, '');
  assert.deepEqual([...withoutPrintDetails.matchAll(/href="([^"]+)"/g)].map(match=>match[1]), [...base.matchAll(/href="([^"]+)"/g)].map(match=>match[1]));
  assert.equal(html.match(/<a id="print-app" href="([^"]+)"/)[1], base.match(/<section class="app">[\s\S]*?href="([^"]+)"/)[1], 'The print-only guide mirrors the existing exact destination.');
});
for (const key of ['og:title','og:type','og:url','og:image','og:image:alt','twitter:card']) {
  test(`reject missing ${key}`, () => assert.throws(() => validate(html.replace(new RegExp(`<meta (?:property|name)="${key}"[^>]+>\\n`), ''))));
}
test('reject duplicate image and a private/campaign-bearing image URL', () => {
  assert.throws(() => validate(html.replace('</head>', `<meta property="og:image" content="${imageUrl}">\n</head>`)));
  assert.throws(() => validate(html.replace(`content="${imageUrl}"`, `content="${imageUrl}?invite=private&context=family` + '"')));
});
