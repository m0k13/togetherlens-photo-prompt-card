# @togetherlens/photo-prompt-card

Create a small, local-first group-photo prompt card for a README, community page, or internal handbook. The package does not read files, call a network, require an account, or upload a photo.

## Install

```bash
npm install https://togetherlens.app/resources/downloads/togetherlens-photo-prompt-card-0.1.0.tgz
```

This archive is hosted by TogetherLens. The package is not published on the npm registry.

## Use

```js
import { createPhotoPromptCard } from "@togetherlens/photo-prompt-card";

const card = createPhotoPromptCard({ context: "family" });
console.log(card.markdown);
```

The returned `markdown`, `html`, and `text` fields are ready to paste. The optional link is a public scene choice with this exact tuple:

`utm_source=npm&utm_medium=registry&utm_campaign=npm_photo_prompt&utm_content=package_readme`

The link does not upload a portrait. A store handoff, if a reader chooses one, is separately marked as `npm_photo_prompt_handoff`.

## Contexts

Use `family`, `couple`, or `team`. You can replace the title and body while keeping the card useful and short.

TogetherLens is not affiliated with npm. This package is provided as a free, MIT-licensed starter.
