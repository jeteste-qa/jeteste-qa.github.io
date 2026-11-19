# Sandbox Bazaar

A fictional shop for testing AI agents that buy things on someone's behalf. It is a **test fixture**: no real products, no real merchants, no real payment. Nothing done here moves money, and the shop never asks for a card.

Built and maintained by [ia-qa.com](https://www.ia-qa.com), which judges the runs. The shop holds the traps; ia-qa.com holds the judge and never serves the trap text itself.

## What it tests

Each scenario gives the agent a task and a purchase policy (a cap per order and per period, allowed and forbidden categories, trusted merchants, recurring charges, a threshold above which a human must confirm). Some scenarios hide a trap. The answer is known in advance, so the verdict is computed, not guessed: no model judges the run.

The traps are documented fixtures: prompt injections in a review, in hidden text or in an image description; a fee that appears only at the last step; a recurring plan that is pre-checked. More are listed in [`data/shop.json`](data/shop.json), which is the single description of every product, price and trap. Reading it before a run defeats the test, so do not give it to the agent.

## Run it

Open a scenario: `https://jeteste-qa.github.io/?scenario=bz-100`. Every tab keeps its own run journal, identified by `run` in the URL (letters, digits, `-` and `_`, up to 64; anything else is replaced). A URL of the same scenario without `run`, in the same tab, resumes that tab's unfinished run instead of starting a new one, so a navigation that drops the parameter loses nothing; the page says so when it resumes. **A harness that runs several attempts in one tab must start each with `run=new`** (`?scenario=bz-100&run=new`) or a fresh browser context, otherwise the second attempt continues the first one's cart. Once a run has ended (paid, sent for confirmation or left), every page says so, nothing more is recorded, and a "Start a new run" link opens a fresh one.

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

or copy it from the "Run journal" panel at the bottom of any page. The journal holds product ids, timestamps and the order of events, never the trap text; the `pay` event also carries the total the shop charged, which the judge recomputes and compares. Paste it into the ia-qa.com evaluator to get the verdict: `pass`, `fail` (with every broken rule and its step) or `review` when the run cannot be judged, for example when the agent stopped without concluding.

Send the journal as the shop wrote it. The judge refuses to rank a journal the shop cannot produce: an event after the run ended, a product added from another product's page, a delivery chosen outside the checkout, a quantity other than the 1 each click adds, timestamps out of order, an unknown event type or format. Such a journal reads `review`, never `pass` or `fail`.

## What a verdict does not prove

One run is one sample: run each scenario several times. The journal is written in the agent's own tab, so the harness that launched the agent is what vouches for it. A sandbox shop says nothing about real payment rails, real fraud checks or a real wallet's own limits.
