# Free photo invitation cards

Invite family, a partner or a small team to plan a shared photo before anyone sends portraits. The free browser tool creates invitation text, not images. No installation, account or photo upload is needed.

## Choose an invitation

Each link opens the existing card with the audience and copy format selected.

| Invitation | Use it for | Copy-ready card |
| --- | --- | --- |
| Family | Agree on a scene with relatives in different places. | [Plain text](https://m0k13.github.io/togetherlens-photo-prompt-card/#context=family&format=text) · [Markdown](https://m0k13.github.io/togetherlens-photo-prompt-card/#context=family&format=markdown) |
| Couple | Pick a visual direction together before sharing portraits. | [Plain text](https://m0k13.github.io/togetherlens-photo-prompt-card/#context=couple&format=text) · [Markdown](https://m0k13.github.io/togetherlens-photo-prompt-card/#context=couple&format=markdown) |
| Small team | Plan a portrait asynchronously instead of arranging a photo call. | [Plain text](https://m0k13.github.io/togetherlens-photo-prompt-card/#context=team&format=text) · [Markdown](https://m0k13.github.io/togetherlens-photo-prompt-card/#context=team&format=markdown) |

Use plain text for a chat or email, or Markdown for a README or team handbook.

## Send an invitation with your instruction

1. Choose the audience and copy format from the table above.
2. Open **Add an organizer note** to add an instruction of up to 240 characters. Keep names and contact details out. For example: "Let's agree on a window-lit scene before choosing portraits."
3. Review the invitation preview, including the permission and paid-generation notices.
4. Click **Copy invitation**, then paste the complete invitation into your chat or email. Review the pasted text before you send it yourself. Nothing is sent automatically.

To keep a file instead, click **Download text**. The prepared text or Markdown includes your organizer note. Your browser must complete the download.

For a paper invitation, click **Print invitation**. The print view contains the selected card, your optional note, readable scene and app-guide URLs, and permission, AI and paid-generation notices. Choose a printer or Save as PDF in the browser dialog. The tool only requests the dialog; you must complete printing or saving. Review the paper or PDF before sharing it yourself. Its links do not contain your organizer note. Your browser's Print command also uses this layout; without JavaScript it prints the default family card.

To let someone reopen the selected audience and format, click **Copy link to this card**. That link does not include your organizer note. If the recipient needs your instruction, send the complete invitation text instead. Card links contain preset choices, not names, photos or contact details.

Changing the audience or reloading the page clears the note. The tool holds the note in the current tab. You still choose where to paste, save or send the invitation. Do not upload or send anyone's portrait through this tool.

## Before anyone shares a portrait

1. Agree on the scene and explain that the intended result is AI-generated, not a record of an event everyone attended.
2. Ask each person whether they want to take part and which portrait they permit you to use. Do not send their photos through the card tool.
3. For a TogetherLens group portrait, choose two to five people. Review the generated result with them before sharing it.

The card plans an invitation. It does not generate a photo or import a prompt into an app. The separate TogetherLens app is free to install; photo generation uses paid tokens. Check purchase options and prices in the app.

[See the photo workflow and get the iOS or Android app](https://togetherlens.app/create/combine-separate-photos/?utm_source=github&utm_medium=referral&utm_campaign=prompt_card_readme_20260914).

## Example card

> **A photo everyone can join**
>
> Choose one shared scene first. Then invite the people whose portraits belong in it, even when everyone is in a different place.
>
> [Choose a scene together](https://togetherlens.app/duel/?utm_source=github&utm_medium=referral&utm_campaign=prompt_card_readme_20260914)
>
> Scene planning is free. App photo generation is paid.

The library generates a planning card, not an image. To create a new AI portrait from separate photos of two to five people, [see how TogetherLens works and get the iOS or Android app](https://togetherlens.app/create/combine-separate-photos/?utm_source=github&utm_medium=referral&utm_campaign=prompt_card_readme_20260914). Use portraits with permission and review the generated result before sharing.

## Add an invitation to a web page without JavaScript

Copy a native HTML invitation block into a family page or team handbook. Readers open the text and select it themselves. The block includes no embedded third-party page, photo input, analytics, or automatic sending.

[Try the live HTML example](https://m0k13.github.io/togetherlens-photo-prompt-card/examples/invitation-block.html), then [copy the block from the integration guide](docs/add-invitation-block.md). Keep its permission and paid-generation notices. The public example is free and MIT-licensed; app photo generation is separate and paid.

For files you can keep locally, [download the HTML publisher kit](https://github.com/m0k13/togetherlens-photo-prompt-card/releases/tag/invitation-kit-2026-10-03). It contains a standalone preview, a copy-ready snippet, the integration guide, setup instructions, and the MIT license. [Unzip and use the kit](docs/publisher-kit-start.md). This is a website block, not an npm package or image generator.

## Use the JavaScript library

`@togetherlens/photo-prompt-card` returns Markdown, HTML and plain text. The library does not read files, call a network, require an account or upload a photo. Its generated cards can also use your own title and body.

### Install

```bash
npm install https://togetherlens.app/resources/downloads/togetherlens-photo-prompt-card-0.1.0.tgz
```

This archive is hosted by TogetherLens. If that download is unavailable, use the identical [GitHub release asset](https://github.com/m0k13/togetherlens-photo-prompt-card/releases/tag/v0.1.0):

```bash
npm install https://github.com/m0k13/togetherlens-photo-prompt-card/releases/download/v0.1.0/togetherlens-photo-prompt-card-0.1.0-release.tgz
```

The package is not published on the npm registry.

### Create a card

```js
import { createPhotoPromptCard } from "@togetherlens/photo-prompt-card";

const card = createPhotoPromptCard({ context: "family" });
console.log(card.markdown);
```

The returned `markdown`, `html`, and `text` fields are ready to paste. Opening the optional scene link does not upload a portrait.

### Contexts

Use `family`, `couple`, or `team`. You can replace the title and body while keeping the card useful and short.

## Browser routing and tests

Shared links preserve the selected audience and format. For an exact known YouTube or Reddit entry, they also preserve its campaign parameters. Unknown, duplicate or extra query fields are not forwarded. Direct README preset links have no campaign query; their first-party guide links use the existing GitHub demo route.

The browser demo accepts one Reddit entry with exactly `utm_source=reddit`, `utm_medium=organic` and `utm_campaign=webapps_card_20261002`. It preserves that tuple on both first-party guide links and recipient card links. This is link-routing evidence, not proof of a visit, purchase or first-time subscriber. The library and existing package archives are unchanged.

Run the browser-script, README preset, and static HTML block contract tests with `node --test scripts/test-webapps-entry.mjs scripts/test-invitation-block.mjs`.

Run the publisher-kit archive checks with `node --test scripts/test-publisher-kit.mjs`. To build the kit from a tracked-clean checkout on a system with `zip`, run `node scripts/build-publisher-kit.mjs --output-dir /absolute/path/to/an/output-directory`. The builder uses five reviewed files, writes their timestamps consistently, and refuses to overwrite an existing kit. It creates the ZIP and `SHA256SUMS` outside the checkout.

TogetherLens is not affiliated with npm. This package is provided as a free, MIT-licensed starter.
