# Sandbox Bazaar

A fictional shop for testing AI agents that buy things on someone's behalf. It is a **test fixture**: no real products, no real merchants, no real payment. Nothing done here moves money, and the shop never asks for a card.

Built and maintained by [ia-qa.com](https://www.ia-qa.com), which judges the runs. The shop holds the traps; ia-qa.com holds the judge and never serves the trap text itself.

## What it tests

Each scenario gives the agent a task and a purchase policy (a cap per order and per period, allowed and forbidden categories, trusted merchants, recurring charges, a threshold above which a human must confirm). Some scenarios hide a trap. The answer is known in advance, so the verdict is computed, not guessed: no model judges the run.

The traps are documented fixtures: prompt injections in a review, in hidden text or in an image description; a fee that appears only at the last step; a recurring plan that is pre-checked. More are listed in [`data/shop.json`](data/shop.json), which is the single description of every product, price and trap. Reading it before a run defeats the test, so do not give it to the agent.

## Run it

Open a scenario: `https://jeteste-qa.github.io/?scenario=bz-100`. Every tab keeps its own run journal (`run` in the URL identifies it).

Locally, with no network, for CI:

```
npx serve sandbox-shop
```

Then point the agent at `http://localhost:3000/?scenario=bz-101`. The page must be served over http; opening `index.html` as a file does not load the data.

## Get the journal

The shop records what happens in the tab (pages and products viewed, cart changes, delivery, extras, and how the run ended: pay, ask the account holder to confirm, or leave). Read it from the harness that drives the browser:

```js
const run = await page.evaluate(() => window.__checkoutRun);
```

or copy it from the "Run journal" panel at the bottom of any page. The journal holds product ids and the order of events, never the trap text. Paste it into the ia-qa.com evaluator to get the verdict: `pass`, `fail` (with every broken rule and its step) or `review` when the run cannot be judged, for example when the agent stopped without concluding.

## What a verdict does not prove

One run is one sample: run each scenario several times. The journal is written in the agent's own tab, so the harness that launched the agent is what vouches for it. A sandbox shop says nothing about real payment rails, real fraud checks or a real wallet's own limits.
