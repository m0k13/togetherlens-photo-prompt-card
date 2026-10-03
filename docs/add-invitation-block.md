# Add a photo invitation to your page

Add a selectable invitation to a family page or team handbook. The block uses HTML and scoped CSS, with no JavaScript, iframe, photo input, account, or package installation.

1. Open the [live example](https://m0k13.github.io/togetherlens-photo-prompt-card/examples/invitation-block.html).
2. Open **Open invitation text**. Select the text to check the recipient-facing invitation.
3. Copy the HTML below into the body of your page. If your site restricts inline CSS, move the style rules into its stylesheet.
4. Preview your page on a phone. Open the disclosure with the keyboard and check that the text stays selectable.

Keep the permission, AI disclosure, and paid-generation notices when you change the invitation. Add personal details in your own chat, not to a public page. The static text is visible to anyone who can view the page.

```html
<style>
	.tl-photo-invite { max-width: 720px; padding: clamp(22px, 4vw, 36px); border: 1px solid #c8d7ee; border-left: 8px solid #285cbd; border-radius: 3px 28px 28px 3px; background: #fff; color: #172b47; font: 17px/1.6 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
	.tl-photo-invite, .tl-photo-invite * { box-sizing: border-box; }
	.tl-photo-invite h2 { margin: 0 0 16px; font: 600 30px/1.2 Georgia, serif; }
	.tl-photo-invite p { margin: 0 0 18px; }
	.tl-photo-invite details { margin: 24px 0; }
	.tl-photo-invite summary { padding: 14px 16px; border: 1px solid #c8d7ee; border-radius: 9px; cursor: pointer; font-weight: 600; }
	.tl-photo-invite label { display: block; margin-top: 20px; font-size: 14px; font-weight: 600; }
	.tl-photo-invite textarea { display: block; width: 100%; min-height: 250px; margin-top: 8px; padding: 14px; resize: vertical; border: 1px solid #c8d7ee; border-radius: 9px; background: #fff; color: #172b47; font: 15px/1.6 ui-monospace, monospace; }
	.tl-photo-invite a { color: #285cbd; overflow-wrap: anywhere; }
	.tl-photo-invite .tl-photo-invite-link { display: inline-flex; align-items: center; min-height: 44px; }
	.tl-photo-invite .tl-photo-invite-note { margin: 0; color: #51617a; font-size: 14px; }
	.tl-photo-invite :focus-visible { outline: 3px solid #cf7a24; outline-offset: 4px; }
</style>
<section class="tl-photo-invite" aria-label="Photo invitation">
	<h2>Ask before you collect portraits.</h2>
	<p>Use this invitation to agree on an AI-created portrait before anyone sends photos. It is fine to say no.</p>
	<details>
		<summary>Open invitation text</summary>
		<label>Invitation text to copy
			<textarea readonly rows="12" spellcheck="false">Would you like to plan an AI-created portrait together? We can agree on a scene before anyone sends photos. Please share a portrait only if you want to take part, and tell me what use you permit. It is fine to say no. For a child's photo, we will ask their parent or guardian first. The result would be AI-created, not a record of an event we attended together. We will review it together and agree who may see it before sharing. The invitation is free. If we use TogetherLens to generate the photo, generation uses paid tokens and Premium is optional. We will check current prices and terms before buying.</textarea>
		</label>
		<p class="tl-photo-invite-note">Select and copy the text. Add personal details in your own chat, then send it yourself. This block sends nothing.</p>
	</details>
	<p><a class="tl-photo-invite-link" href="https://m0k13.github.io/togetherlens-photo-prompt-card/">Choose a family, couple or small-team invitation</a></p>
	<p><a class="tl-photo-invite-link" href="https://togetherlens.app/create/combine-separate-photos/">See the separate-photo workflow and app options</a></p>
	<p class="tl-photo-invite-note">This block collects no photos or contact details. It creates no image and imports nothing into an app. TogetherLens is free to install; photo generation uses paid tokens. Premium is optional. Review current prices and terms before buying.</p>
</section>
```

The snippet includes no external asset, form, storage, or analytics. Its two linked pages load when a reader opens them. The links have no campaign parameters, so an external publisher is not labelled as GitHub traffic.

The invitation and layout are free and MIT-licensed. TogetherLens photo generation is a separate paid app feature. The existing JavaScript library and release archives remain unchanged.
