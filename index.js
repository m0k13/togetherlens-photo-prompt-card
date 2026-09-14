const FIRST_PARTY_HOST = "togetherlens.app";
const HANDOFF_PATH = "/duel/";
const PRIVATE_QUERY_KEYS = new Set(["session", "token", "invite", "user", "portrait", "request", "private"]);

export const attribution = Object.freeze({
  source: "npm",
  medium: "registry",
  campaign: "npm_photo_prompt",
  content: "package_readme",
  placement: "npm_photo_prompt_handoff",
});

export const contexts = Object.freeze({
  family: Object.freeze({
    title: "A photo everyone can join",
    body: "Choose one shared scene first. Then invite the people whose portraits belong in it, even when everyone is in a different place.",
    cta: "Choose a scene together",
  }),
  couple: Object.freeze({
    title: "Two moments, one scene",
    body: "Pick a visual direction you both want to keep before you bring separate portraits into one frame.",
    cta: "Pick a shared direction",
  }),
  team: Object.freeze({
    title: "A team portrait without a photo call",
    body: "Agree on one setting asynchronously, then let each teammate contribute a permissioned portrait when it suits their schedule.",
    cta: "Set the team direction",
  }),
});

function cleanText(value, fallback, maxLength) {
  const normalized = String(value ?? "").replace(/\s+/g, " ").trim();
  return (normalized || fallback).slice(0, maxLength).trim();
}

function escapeHtml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function safeContext(value) {
  return Object.hasOwn(contexts, value) ? value : "family";
}

export function buildHandoffUrl(pageUrl = `https://${FIRST_PARTY_HOST}${HANDOFF_PATH}`) {
  const url = new URL(String(pageUrl));
  if (url.protocol !== "https:" || url.hostname !== FIRST_PARTY_HOST) {
    throw new Error("TogetherLens links must point to togetherlens.app.");
  }
  url.username = "";
  url.password = "";
  url.hash = "";
  for (const key of Array.from(url.searchParams.keys())) {
    if (key.startsWith("utm_") || PRIVATE_QUERY_KEYS.has(key)) url.searchParams.delete(key);
  }
  for (const [key, value] of Object.entries(attribution)) {
    if (key !== "placement") url.searchParams.set(`utm_${key}`, value);
  }
  return url.toString();
}

export function createPhotoPromptCard({ context = "family", title, body, pageUrl } = {}) {
  const safe = safeContext(context);
  const defaults = contexts[safe];
  const heading = cleanText(title, defaults.title, 140);
  const copy = cleanText(body, defaults.body, 480);
  const link = buildHandoffUrl(pageUrl);
  return {
    context: safe,
    markdown: `> **${heading}**\n>\n> ${copy}\n>\n> [${defaults.cta} →](${link})\n>\n> Scene planning is free. App photo generation is paid.`,
    html: `<aside data-togetherlens-npm-card><strong>${escapeHtml(heading)}</strong><p>${escapeHtml(copy)}</p><a href="${escapeHtml(link)}">${escapeHtml(defaults.cta)} →</a><small>Scene planning is free. App photo generation is paid.</small></aside>`,
    text: `${heading}\n\n${copy}\n\n${defaults.cta}: ${link}\n\nScene planning is free. App photo generation is paid.`,
    url: link,
  };
}

export function isExactAttributionTuple(value) {
  const entries = value instanceof URLSearchParams ? Array.from(value.entries()) : Object.entries(value ?? {});
  const values = new Map(entries);
  return entries.length === 4
    && values.get("utm_source") === attribution.source
    && values.get("utm_medium") === attribution.medium
    && values.get("utm_campaign") === attribution.campaign
    && values.get("utm_content") === attribution.content;
}
