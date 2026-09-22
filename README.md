# New Eden: Renter's Edition

A free EVE Online Monopoly parody for one human and three bots. Pick a ship, rent out nullsec, and hope your account ban ends before the megathread does.

## Play

Serve this folder with any static server:

```sh
python3 -m http.server 8080
```

Open `http://localhost:8080`. No build step, backend, account, API key, or runtime package install is needed. Ship art is local; web fonts have system fallbacks. Campaigns save after each completed rules action, including pending decisions. An animation interrupted by reload resumes at the resolved position.

Choose a hull and initialize. Highest opening roll starts. Use **Assets & Buildings** to manage deeds and held cards, **Trade** to negotiate, and **Pause Bots** to think between actions. Clicking a deed pauses bot activity while its detail window is open. The **3D View** button tilts the board; ships, structures, and dice use animated CSS depth. Ship choice has no mechanical advantage.

Open **Jukebox** for Webamp and the 14-track [EVE Online soundtrack](https://archive.org/details/eve-online-soundtrack/) by Jón Hallur Haraldsson. Press Play to start; music never autoplays. Hide keeps it playing, × pauses and closes the panel, and Reset restores the player layout. Music volume is independent of the game's sound effects. Webamp 2.3.1 loads on demand from jsDelivr with an integrity check. MP3s are hotlinked to Archive.org, not stored in this repository. If either service is unavailable, the board still works and the player offers a direct Archive link.

## GitHub Pages

1. Push these files to your repository.
2. In Settings → Pages, select **Deploy from a branch**.
3. Choose the branch and **/ (root)**, then save.

The `.nojekyll` file and relative asset paths support project URLs such as `username.github.io/eveonline-monopoly/`. This workspace has not been published to a GitHub account.

## Rules and bots

The baseline is the US Hasbro C1009 rulebook (2017), with the classic pre-2021 card effects. Start with 1500; GO pays 200; taxes are 200 and 100. Four houses become one hotel, with a finite 32/12 supply. The game includes even building and selling, mandatory public auctions, building shortages, mortgages, trades, held cards, jail options, doubles, liquidation, bankruptcy transfers and a last-player-standing win condition. There are no loans, free-parking prizes, or turn limits. Values are displayed in millions of ISK.

The three bots use public-board heuristics: rent exposure, group completion, denial, auction ceilings, three-house rushes, supply pressure, mortgage recovery, trade valuation, and changing jail strategy. They do not inspect future rolls or decks. They are designed to punish loose trades; they have not been proven stronger than expert humans or published research agents.

In a reproducible local benchmark, one hard bot faced three fixed buying/building policies with rotating seats. It won 53 of 96 games (55.2%); 29 went to baseline opponents and 14 remained unfinished at the test horizon. The second 48-game run used a separate seed set after tuning. [Recorded results and limits](tests/benchmark-results.json).

[Research, source links, rules mapping, streamer-card context, and art credits](research.html) are also available from the game's Intel window. The Loru cards are satire of documented giveaway-policy controversy and community reaction; the source notes distinguish reports from interpretation.

All 32 cards have [reference notes](research.html#cards), linked from each drawn card. The decks cover rental-empires discourse, SRP, Asakai, B-R, M2, Monoclegate, the Stain gate, red dots, and other EVE arguments. Card prose is original parody; all amounts, destinations, effects, and deck positions retain their classic equivalents.

## Files

- `data.js`: board, classic-equivalent cards, EVE copy, bot profiles.
- `engine.js`: finances, construction, ownership, trade valuation.
- `session.js`: serializable turns, cards, auctions, debts, jail, bankruptcy.
- `bots.js`: opponent decisions; independent of DOM and animation.
- `game.js`: UI, animations, audio, autosave and human controls.
- `music.js`, `jukebox.html`, `jukebox.js`, `jukebox.css`, `soundtrack.js`: optional Webamp panel and Archive-hosted playlist.
- `styles.css`, `index.html`, `assets/`: static presentation.

## Verification

```sh
npm ci
npm test
npx playwright install chromium
npm run test:e2e
npm run benchmark -- 48 99001
```

Node tests cover classic rule edge cases and seeded campaigns with conservation checks after every action. Playwright covers desktop and mobile, pending-decision reloads, auctions, jail cards, debt management, and project-subpath hosting. `.github/workflows/tests.yml` runs both suites on pushes and pull requests.

EVE artwork is CCP intellectual property; Monopoly belongs to Hasbro. This is an unofficial, non-commercial fan project. The command-room backdrop is generated original art; the ships and structures are official renders. See the linked credits and source terms.
