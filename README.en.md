<div align="center">

<img src="icon.svg" width="72" alt="dsh-group-status"/>

# dsh-group-status — live status on collapsed folders

[中文](./README.md) | **English**

[![version](https://img.shields.io/badge/version-0.2.0-0EA5E9)](https://github.com/dsh-plugin-collection/dsh-group-status)
[![license](https://img.shields.io/badge/license-MIT-green)](LICENSE)
[![DSH](https://img.shields.io/badge/DeepSeek%20Harness-0.2.0--rc.2-4D6BFE)](https://github.com/deepseek-ai/deepseek-harness)

</div>

> In the DSH sidebar, **folding a workspace group takes every session status inside down with it** — running, approvals, reviews, all gone. This plugin gives the collapsed folder row its own aggregated badge: **yellow = pending approval, spinner = running, green = completed**, plus clock and review icons fed by other plugins, with a count and hover details. Expanded groups are untouched — child rows carry their own statuses.

---

## Preview

**Collapsed folder rows carry the aggregate badge** — `tmp` has one running session (spinner), one completed (green dot), one scheduled task (clock), count `3`:

<p align="center">
<img src="docs/media/screenshot-folders.png" width="267" alt="Collapsed sidebar group tmp: spinner, green dot, clock icon and count 3"/>
</p>

**Hover for details** — the hover card appends aggregated detail lines under the path and creation time:

<p align="center">
<img src="docs/media/screenshot-hover.png" width="300" alt="Hover card: 1 Waiting for answer · 1 Running"/>
</p>

> The badge reuses DSH's native `StateDot`, so colors stay identical to the session rows. Both images are real screenshots.

---

## How to use

Fold any group that has live sessions; a badge appears after the folder name:

| Glyph | Meaning | Color |
|---|---|---|
| Yellow dot | Pending approval / plan review / answer inside | warning (same as rows) |
| Spinner | Running sessions inside, incl. running subagents | ongoing (`StateDot` animation) |
| Green dot | Completed-unread sessions inside | done (same as the row) |
| Clock | Scheduled tasks inside (data from dsh-later) | purple · orange (≤5 min) · red (overdue) |
| Hourglass | Sessions waiting for a PR review (data from dsh-gitea-dispatch) | amber · red (the CI wait window lapsed) |

Rules:

- **Completed reaches the badge**: `done` (completed-unread) now shows a green dot while folded, reusing the same `StateDot` state as the session row; a group with nothing but completed sessions shows a badge just like any other.
- **The count** = approvals + running (**including running subagents**) + completed + sessions with scheduled tasks + sessions waiting for review. Whether the number renders at all is gated by `countThreshold` (default 2 — a lone item shows dots only).
- **Hover details**: the folder row's hover card appends lines in the order `approval · plan review · answer · running · subagents · waiting review · scheduled tasks · completed`, e.g. `1 Waiting for answer · 1 Running`. The waiting-review line carries **which PR** and **how long is left**, e.g. `1 Waiting for review (3min left) · #2783`.
- **Expanding defers to the rows**: the aggregate badge only renders while collapsed; expanded groups keep their per-row statuses with no duplication.
- **Accessible**: the badge is `role="img"` with a localized `aria-label` (e.g. `1 Waiting for answer · 1 Running`) and the same text as its `title`. Waiting and overdue are **two different sentences** (`Waiting for review` / `Waiting for review (overdue)`), not one sentence in two colours.
- **Only scheduled reminders pulse.** A lapsed review wait does not animate, matching how dsh-gitea-dispatch draws its own session-row icon for that state: it stops the animation on purpose (its words: "stillness means no longer expecting"), and its `overdue` means only that CI stopped waiting, not that the review failed. A pulsing folder next to a still row icon would state the same fact twice. The red colour stays, same token as the publisher.

### Settings

**Plugins** in the sidebar → **dsh-group-status** (the config form on the bundle's page, between its description and the component rows):

| Field | Default | Meaning |
|---|---|---|
| `showRunningInBadge` | `true` | Whether the folded badge shows the "running" spinning dot |
| `showPendingInBadge` | `true` | Whether the folded badge shows the "pending" yellow dot (approval / plan review / waiting for answer) |
| `showCompletedInBadge` | `true` | Whether the folded badge shows a green "completed" dot |
| `showScheduledInBadge` | `true` | Whether the folded badge shows the "scheduled" clock icon (data from dsh-later) |
| `showWaitingReviewInBadge` | `true` | Whether the folded badge shows the "waiting for review" hourglass icon (data from dsh-gitea-dispatch) |
| `showHoverDetails` | `true` | Whether the hover card shows the aggregated status detail lines |
| `countThreshold` | `2` | The count is shown on the badge only when the total is >= this value (default 2, i.e. omits the count when it equals 1 — the dots already convey "something is happening"; set to 1 to always show) |

Switching a source off takes it out of the folded row's aggregate entirely — no dot/icon, no contribution to the badge count, no hover detail line, and it no longer keeps the badge alive. **The state dot on a session row itself is unaffected**: that is row-level state, not a folder hint. With `showHoverDetails` off, the hover card shows only the title, path, and creation time.

Saving applies it live, with no refresh; the Host writes it into the profile patch's `dsh-group-status` entry `config`, so it survives a page reload. When the settings face cannot be read (e.g. the Host serves no settings service), it falls back to the default "show", matching the schema default — failing to read a config is not the user turning it off.

---

## Feature overview

- **Visible when folded**: the aggregate only exists while collapsed; an expanded sidebar is pixel-identical to stock. Nested groups are supported too — when a parent group is folded, its badge aggregates sessions from all descendant groups.
- **Same source of truth as rows**: priority, colors and wording all reuse the row derivation and `StateDot`; blank and archived sessions are skipped.
- **Cross-plugin aggregation** (optional): scheduled tasks from dsh-later, waiting PR reviews from dsh-gitea-dispatch — works fine with neither installed.
- **Usable with zero config**: sensible defaults out of the box; 7 settings let you fine-tune which sources appear in the folded badge, hover details, and count display.
- **No stock files touched**: not a single file of the published `dsh-client-ui-workspace` is modified; all changes live in this repo's source, and the profile patch is two lines (add this package, disable the stock row).
- **Localized**: follows the DSH UI language (中文 / English) by reusing the stock locale keys. This package adds `status.waitingReview`, `status.scheduled`, a fallback `status.needsAttention` for facets that ship no wording, and the three waiting-review states `status.waitingReviewOverdue` / `status.waitingReviewImminent` / `status.waitingReviewLeft`.

---

## Cross-plugin status: the facet protocol

A folded group badge can show state owned by **another plugin**. The direction is inverted: **the owner registers its facts in**, and this plugin's aggregation and render paths **know no specific source** (not one branch keyed on who is reporting). The full contract lives in [docs/facet-protocol.md](docs/facet-protocol.md).

Two exceptions remain open, both transitional: the `legacy/` directory still houses one proxy adapter each for dsh-later and dsh-gitea-dispatch (each yields automatically via `FACET_ORIGIN_RANK` once the owner registers a facet under the same id, at which point the directory goes away); and those two sources each own a dedicated setting, so adding a **third** toggle still means 14 touchpoints in this plugin (cost and the planned consolidation are in that document's final section, 「已知取舍」 — the contract docs are Chinese-only).

```js
const gs = require('dsh-group-status/client')
const unregister = gs?.registerGroupStatusFacet?.({
  protocol: gs.GROUP_STATUS_FACET_PROTOCOL_VERSION,
  id: 'my-plugin.review',              // '<package>.<state>'
  subscribe: store.subscribe,           // an external-store face, not a React hook
  getSnapshot: store.getSnapshot,
  fold: (snapshot, sessionIds, now) => ({ count, tone, pulse, data }),
  merge, label, renderIcon, settingKey, order,   // all optional
})
ctx.effect(() => () => unregister?.(), 'my-plugin: group status facet')
```

- The five required members alone already render: `N Needs attention` plus a tone-coloured generic dot. Your internal id is **never** read out to the user.
- Icon and wording belong to the owner (`renderIcon` / `label`): what a state looks like, and whether a lapsed wait should sit still or pulse, is its knowledge. Previously this plugin inferred it from state names and ended up contradicting the owner, which draws `overdue` **statically** while the badge pulsed.
- A collapsed parent spans the whole subtree, so same-facet folds get merged again. That is why `fold` returns structured `data` rather than text: text cannot be merged. Without `merge` the default rule applies (counts add, the more urgent tone wins, `data` is dropped).
- When this plugin is absent or disabled `require` throws: catch it and carry on, your own features are unaffected.
- Same-id conflicts are settled **by origin, not by registration order** (the host does not order plugin `apply`): the owner always wins over a transitional adapter.

### Why `subscribe` / `getSnapshot` instead of a React hook

The badge is a React component, and hook order must be constant across renders of one component. Facets register and unregister at runtime: calling each owner's hook would change the hook count the moment the registry moves, and React throws "Rendered more hooks than during the previous render". This plugin subscribes once and reads one version number, however many sources stand behind it.

### Transition: the two sources this plugin still hosts

| facet id | Today | What the owner must do |
|---|---|---|
| `dsh-gitea-dispatch.waiting-review` | this plugin reads the `dsh-gitea-dispatch/client` summary store and registers on its behalf | register the same id itself |
| `dsh-later.schedule` | this plugin reads the `dsh-later/client` summary store and registers on its behalf | register the same id itself |

Once both do, delete [`src/client/legacy/`](src/client/legacy) and the two matching `dsh.client.external` entries. Until then that path keeps working and nothing breaks if neither adopts it.

> ⚠️ Cross-plugin **value imports** do not work in this project (measured: `Could not resolve "dsh-group-status"`: a client bundle is a self-contained closure factory). Owners therefore use only the runtime symbols from `require('dsh-group-status/client')` and never `import` this package's types; copying the structural declarations from the protocol doc is enough.
---

## Quick start

### Install into DSH

**npm install (recommended, pre-built, no auth required):**

```bash
dsh plugin --profile web add dsh-group-status
# Takes effect after restarting dsh web (the whole sidebar package is swapped)
```

Or install from GitHub:

```bash
dsh plugin --profile web add "github:dsh-plugin-collection/dsh-group-status"
# restart dsh web
```

For local development, link a checkout and rebuild as you edit `src/`:

```bash
git clone https://github.com/dsh-plugin-collection/dsh-group-status.git
cd dsh-group-status
pnpm install && pnpm build

dsh plugin --profile web add "link:$PWD"
# restart dsh web
```

> Dev tip: `pnpm watch` rebuilds on every `src/` change — but the sidebar is swapped as a whole, so **a dsh web restart is still required**.

### Verify

1. Fold a group with running / pending sessions → a badge appears after the folder name;
2. Hover the folder row → the detail lines appear (matching the badge's wording);
3. Expand the group → the badge disappears and child rows show their own statuses;
4. No errors in the browser console.

### Roll back

```bash
dsh plugin --profile web remove dsh-group-status
# Both patch lines are withdrawn together; the stock row comes back. Restart to apply.
```

---

## Compatibility

| Item | Value |
|---|---|
| DSH core | `0.2.0-rc.2` |
| peer dependency | `@deepseek-ai/cordis ~4.0.4` |
| Upstream base | `@deepseek-ai/dsh-client-ui-workspace 0.2.0-rc.2` (source vendored into `src/`) |
| Install shape | fork override: same slots registered, stock row disabled via `cordis.patch.yml` |
| Optional partners | dsh-later (schedule summary), dsh-gitea-dispatch (waiting-review summary) |

Every upstream generation requires a manual rebase — see the [upgrade runbook](./docs/upgrading.md). If upstream renames a slot, changes a component signature or the context contract, this package will not follow on its own.

---

## Development

```sh
pnpm install
pnpm build        # tsc typecheck + tsdown bundle → lib/
pnpm watch        # rebuild on src/ changes (a dsh web restart is still required)
pnpm test         # = test:node (node --test, 12 cases) + test:spec (vitest + jsdom, 96 cases)
pnpm test:spec    # the upstream spec suite only
```

`tests/` is a copy of the upstream suite plus this repository's own [tests/group-status.client.spec.ts](tests/group-status.client.spec.ts), which covers the fold aggregation itself (counts, priority, cross-plugin sources, blank/archived skipping).

Seven further upstream specs only run inside the DSH monorepo: they either need `dsh-client-test-runtime`'s deep imports of **unpublished sources**, or take runtime values out of a published `…/client` bundle whose closure expects the host app to preload its whole dependency set. They are explicitly skipped at the top of [vitest.config.ts](vitest.config.ts) with the reason spelled out per group — **do not light them up with stubs**; that would only test the stub.

---

## Known limitations

- **Upstream bumps need a manual rebase**: the upstream source is vendored (`src/`, `tests/`) and this is not a stable public API; slot names, component signatures and context contracts may shift under it. Steps are in the [upgrade runbook](./docs/upgrading.md).
- **One extra full measurement pass per status change**: aggregation shares the expanded derivation, and to make collapsed parents count correctly **expanded groups get measured too** — they draw no badge themselves, but a collapsed ancestor needs their numbers. Huge groups (hundreds of sessions) cost one extra traverse plus a fold up the tree per status change — same order as expanded rendering, acceptable. A perf spec guards this cost.
- **It produces no status itself**: the cross-plugin icons depend entirely on the summary APIs published by dsh-later / dsh-gitea-dispatch. Without them you simply lose those two icons.
- **The count is coarser than the details**: scheduled tasks are counted per *session*, not per task; the exact task count lives in dsh-later's own UI.
- **Collapsed sidebar only**: this plugin only adds an aggregate display — it does not touch the session state machine or the per-row badge predicates.

---

## Technical documentation

Developer and maintainer material, kept out of this README:

- [Upstream upgrade runbook](./docs/upgrading.md) — where the baseline came from, what changed locally, how to rebase and verify on the next upstream release
- [Cross-plugin summary template](./src/client/cross-plugin-summary.ts) — the provider-side skeleton itself; its header is the design note and carries the measured "copy, do not import" evidence

## License

MIT (inherited from the upstream `@deepseek-ai/dsh-client-ui-workspace`).

---

<div align="center">

<img src="icon.svg" width="48" alt="dsh-group-status"/>

</div>
