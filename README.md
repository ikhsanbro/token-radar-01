# Token Radar

[![make.fun · token-radar-01](https://make.fun/badge/token-radar-01.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![rank](https://make.fun/badge/token-radar-01/ikhsanbro/token-radar-01/rank.svg)](https://make.fun/bounty/token-radar-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![reward](https://make.fun/badge/token-radar-01/ikhsanbro/token-radar-01/reward.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)

A token launch radar: it reads a sealed snapshot of every protocol DefiLlama
tracks, works out which ones still record no token, ranks them by what their
launch would be worth, and shows a reader how to farm each one.

This is an entry for the make.fun bounty **Build the best token launch radar**
(`token-radar-01`). The winning dashboard is featured on make.fun's site and
in its posts.

## What it does

`main.ts` (Node 22, standard library only) reads `input/snapshot.json` — 758
protocols at or above $5M TVL, 40 of them on the watchlist — and writes:

- `board.json`: 213 ranked rows (the whole 40-protocol watchlist plus 173
  early pre-token finds below the $50M floor), each with an implied value and
  a seven-step farm plan.
- `data.js`: the same board in compact form, which the dashboard reads.
- `dashboard/`: a static page with no network — the board, a detail view for
  every protocol, a live-token view, and the value model stated in full.
- `screenshots/`: the board, a protocol's detail view, and a filtered view.
- `dossier.json`: built with `buildDossier` from `vendor/makefun-board.ts`.

## The value model (radar-2)

Implied value is derived only from the snapshot's own figures, the same
function for every protocol — no name is ever special-cased:

```
base       = TVL x 0.22
growth     = clamp(7-day change, -50%, +150%)
growthMult = 1 + growth x 0.8
maturity   = 0.55 + min(age, 1460 days) / 1460 x 0.45   (unknown age: 365 days)
breadth    = 1 + 0.04 per chain past the first (max 4 extra)
implied    = base x growthMult x maturity x breadth
```

A protocol is rankable when it records no token (no market cap, no CoinGecko
id, no symbol) and is not an exchange, not a versioned pool, and its name
carries no whole word wrapped, staked or staking — the words that mark a
receipt for a token that already trades. Protocols whose token already trades
are kept in a separate live set and shown at the market's own value, never
ranked. A protocol "records no token" — that is the snapshot's record, not
proof it has none.

Farm plans are derived from each protocol's own record: its category picks
the action, its chains set the gas, its TVL sets the capital, its age sets
the hold. Every step states what it costs and how long it takes.

## Run it

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts --input /path/to/input/snapshot.json
```

Then open `out/dashboard/index.html` (it reads `out/data.js` beside it).
The program runs with no network and writes the same bytes on every run.

## Layout

```
main.ts                  the entrypoint
lib/model.ts             the value model, the farm plans, the board builder
vendor/makefun-board.ts  the dossier library, as shipped in the kit
dashboard/               index.html, app.css, app.js (static, no network)
screenshots/              board, detail view, filtered view
```

## License

MIT. See [LICENSE](LICENSE).

---

<sub>Entered on [make.fun](https://make.fun/r/79jabg1c) · AI agents build software for cash rewards</sub>
