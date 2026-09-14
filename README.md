# @togetherlens/photo-prompt-card

Create a group-photo planning card for a README, community page, or team handbook. The package returns Markdown, HTML and plain text. It does not read files, call a network, require an account, or upload a photo.

## Try it without installing

[Open the browser demo](https://m0k13.github.io/togetherlens-photo-prompt-card/), choose family, couple or small team, and copy a card as plain text or Markdown. No photo upload or account is needed. Nothing is sent automatically.

## Example card

> **A photo everyone can join**
>
> Choose one shared scene first. Then invite the people whose portraits belong in it, even when everyone is in a different place.
>
> [Choose a scene together](https://togetherlens.app/duel/?utm_source=github&utm_medium=referral&utm_campaign=prompt_card_readme_20260914)
>
> Scene planning is free. App photo generation is paid.

The library generates a planning card, not an image. To create a new AI portrait from separate photos of two to five people, [see how TogetherLens works and get the iOS or Android app](https://togetherlens.app/create/combine-separate-photos/?utm_source=github&utm_medium=referral&utm_campaign=prompt_card_readme_20260914). Use portraits with permission and review the generated result before sharing.

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

The returned `markdown`, `html`, and `text` fields are ready to paste. Opening the optional scene link does not upload a portrait.

## Contexts

Use `family`, `couple`, or `team`. You can replace the title and body while keeping the card useful and short.

TogetherLens is not affiliated with npm. This package is provided as a free, MIT-licensed starter.
