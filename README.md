# New Eden: Faction Warfare

A free EVE Online Monopoly parody for one human and three bots. Enlist with Calmil or Galmil, fight over 22 warzone hotspots, and explain in Local why losing the ship was part of the plan.

[Play on GitHub Pages](https://cyberbalsa.github.io/eveonline-monopoly/) · [Source repository](https://github.com/cyberbalsa/eveonline-monopoly)

## Play

Serve this folder with any static server:

```sh
python3 -m http.server 8080
```

Open `http://localhost:8080`. No build step, backend, account, API key, or runtime package install is needed. Ship art is local; web fonts have system fallbacks. Campaigns save after each completed rules action, including pending decisions. An animation interrupted by reload resumes at the resolved position.

Choose a militia and hull, then deploy. Highest opening roll starts. Use **Assets & Buildings** to manage deeds and held cards, **Trade** to negotiate, and **Pause Bots** to think between actions. Clicking a deed pauses bot activity while its detail window is open. Militia and hull choices are cosmetic: this remains a four-player, last-pilot-standing game, not team Monopoly.

The board fits the available browser viewport automatically. **Follow On** zooms into movement, tracks the ship, holds at the destination, and returns to the full board. **Fit Board** immediately cancels that camera move without changing the rules action. Use **+/−** and drag to inspect the board, or click a roster entry to locate its numbered ship. **Tilt Board** changes the board angle. Reduced-motion preferences disable automatic camera moves. Both decks stay face down until a card is drawn.

Pawns and citadels use real EVE mesh geometry, simplified for board-sized miniatures, with project-authored metallic finishes. These are not full EVE client shaders or paint schemes. Each built deed shows an Astrahus or Keepstar mesh plus its exact count. Models and the renderer are local; WebGL failures fall back to local ship images. The colored icons come from CCP's original 2014 Phoebe pack. See [asset provenance and rendering notes](research.html#art).

Every drawn card opens a modal naming its pilot and ship. **Dismiss Card** applies its effect to that pilot; **Keep Card & Dismiss** puts an escape card in their hand. This is manual for bots too: no card advances on a timer, Escape, or a backdrop click. Pending cards survive reloads.

Bot trade offers also pause play in a centered modal. The offering pilot appears above **You Receive** and **You Give**, including cash, claims, held cards, and mortgage charges. Accept Contract completes the exchange; Decline leaves your assets unchanged. Unanswered offers survive reloads.

When proposing a trade, **Diplomatic Standing** updates as you change ISK, deeds, cards, or the counterparty. It gives a coarse EVE-style reception: Terrible / Bad / Neutral / Good / Excellent. Bots do not explain their valuation, disclose a price target, or promise acceptance in the preview. Submit for a plain acceptance or rejection. This changes neither bot strategy nor permanent reputation.

**Local · Action Log** records human and bot rolls, movement, purchases, bids, trades, building, liquidation, card resolutions, payments, reshipping, and turn changes. Search or filter by pilot; Earlier/Newer page through the complete saved history, and Export downloads it as text. Only 100 entries enter the DOM at once. Existing saves retain the history the old version kept; already discarded entries cannot be recovered. Browser storage limits still apply; the save indicator warns if saving fails.

Rent paid by you or received from a bot produces a red or green wallet popup after landing, with payer, recipient, property, and the amount actually transferred. It disappears after 6.5 seconds or with ×. Debt produces no receipt until settled, and resumed saves do not replay old payments. Tax and card transfers remain in Local but are not mislabeled as rent.

**SFX On/Off** and its volume slider control seven local clips independently of Webamp. Rolls use a 0.36-second dice clatter; movement uses one quiet 1.05-second thruster burst, never a sound on every square. Those two supplemental effects are from Kenney's CC0 packs. Five EVE notification, skill-completion, cargo, capacitor, and structure sounds accompany other actions. Default volume is 35%; mute and volume are saved. Effects unlock after user input, stop when the tab is hidden, and never block play if audio fails. The small clips are loaded once, not streamed or looped. [Sound credits and preparation](research.html#sfx).

Open **Jukebox** for Webamp and the 14-track [EVE Online soundtrack](https://archive.org/details/eve-online-soundtrack/) by Jón Hallur Haraldsson. Press Play to start; music never autoplays. Hide keeps it playing, × pauses and closes the panel, and Reset restores the player layout. Music volume is independent of the game's sound effects. Webamp 2.3.1 loads on demand from jsDelivr with an integrity check. MP3s are hotlinked to Archive.org, not stored in this repository. If either service is unavailable, the board still works and the player offers a direct Archive link.

## GitHub Pages

1. Push these files to your repository.
2. In Settings → Pages, select **Deploy from a branch**.
3. Choose the branch and **/ (root)**, then save.

The public repository publishes from `main`, at `/ (root)`, with HTTPS enabled. Pushes to `main` update the site. The `.nojekyll` file and relative asset paths also support forks at project URLs such as `username.github.io/eveonline-monopoly/`.

## Rules and bots

The baseline is the US Hasbro C1009 rulebook (2017), with the classic pre-2021 card effects. Start with 1500; GO pays 200; taxes are 200 and 100. Four houses become one hotel, with a finite 32/12 supply. The game includes even building and selling, mandatory public auctions, building shortages, mortgages, trades, held cards, jail options, doubles, liquidation, bankruptcy transfers and a last-player-standing win condition. There are no loans, free-parking prizes, or turn limits. Values are displayed in millions of ISK.

**Reship Bay** is the Jail corner; **Gate Camp** sends you there without collecting 200M. Visiting, doubles, the 50M payment, held cards, and rent collection follow classic rules. **Ship Spinning** is Free Parking and pays nothing. [Rules mapping](research.html#rules).

The three bots use public-board heuristics: rent exposure, group completion, denial, auction ceilings, three-house rushes, supply pressure, mortgage recovery, trade valuation, and changing jail strategy. They do not inspect future rolls or decks. They are designed to punish loose trades; they have not been proven stronger than expert humans or published research agents.

In a reproducible local benchmark, one hard bot faced three fixed buying/building policies with rotating seats. It won 53 of 96 games (55.2%); 29 went to baseline opponents and 14 remained unfinished at the test horizon. The second 48-game run used a separate seed set after tuning. [Recorded results and limits](tests/benchmark-results.json).

## Warzone and opponent research

The 22 property spaces are individual fighting systems, from Fliet and Old Man Star through Nennamaila, Heydieles, Aldranette and Tama. We fetched the public ESI roster of 90 Caldari–Gallente FW systems and twelve complete months of zKillboard statistics: **September 2025–August 2026**. Ranking uses median monthly recorded kills, then the annual total. The selection takes the top 21 plus Fliet, a documented near-tie substitution for Pynekastoh. Color groups and board adjacency are game abstractions. [Hotspot evidence and monthly charts](research.html#hotspots).

The figures measure recorded killmails in those systems, including non-militia activity; they are not militia victory scores. The current partial month is excluded, and missing months remain unknown. [Saved API responses, limitations and reproduction](research/README.md).

Each campaign randomly chooses **three distinct opponents from 48 sourced names: 24 Calmil and 24 Galmil**. The pool includes recognizable pilots, corporations and alliances from militia history. One Calmil bot, one Galmil bot, and one bot opposite your chosen faction give the table two identities from each side. Names are sampled without replacement, exclude your callsign, and persist when you resume. Names do not change the bots’ three strategies. [Full roster with dated affiliation sources](research.html#opponents).

Historical cameos are not claims of current membership, endorsement, or real-world automation. The new theme uses its own browser save key; existing Renter’s Edition saves are left intact and are not loaded into the renamed board.

All 32 cards have [reference notes](research.html#cards), linked from each drawn card. **Militia Orders** and **Local Comms** cover plex gates, LP cash-outs, squids and frogs, FC pings, reships, shipcasters, seagulls, and propaganda. Card prose is original parody; amounts, destinations, effects, and deck positions retain their classic equivalents.

## Files

- `data.js`: board, classic-equivalent cards, militia copy, bot strategies.
- `bot-roster.js`: 48 sourced identities and random selection without replacement.
- `research/`, `scripts/research-warzone*.py`: frozen public API evidence and refresh scripts.
- `faction-war.css`, `assets/warzone-command.svg`: blue/green militia theme and original command-map graphic.
- `engine.js`: finances, construction, ownership, trade valuation.
- `session.js`: serializable turns, cards, auctions, debts, jail, bankruptcy.
- `bots.js`: opponent decisions; independent of DOM and animation.
- `game.js`: UI, animations, audio, autosave and human controls.
- `board-camera.js`, `board-pieces.js`, `board-ui.css`: viewport fitting, follow camera, numbered pieces, and old-style colored controls.
- `board-models.js`: renderer source; `vendor/board-models.min.js`: checked-in Three.js bundle; `assets/models/`: local geometry-only GLBs.
- `music.js`, `jukebox.html`, `jukebox.js`, `jukebox.css`, `soundtrack.js`: optional Webamp panel and Archive-hosted playlist.
- `sound-effects.js`, `assets/sounds/`: cached EVE/CC0 effects, independent volume, provenance.
- `activity-log.js`, `game-feedback.js`, `feedback.css`: saved action history, rent notifications, and card-pilot identity.
- `trade-standing.js`: EVE-themed display of the bot’s existing trade valuation; no change to its acceptance policy.
- `styles.css`, `index.html`, `assets/`: static presentation.

## Verification

```sh
npm ci
npm test
npx playwright install chromium
npm run test:e2e
npm run benchmark -- 48 99001
npm run build:graphics
# With the local static server running:
npm run benchmark:frames -- http://127.0.0.1:8080
```

Node tests cover roster selection, API evidence consistency, classic rule edge cases, seeded campaigns with conservation checks after every action, camera bounds, mesh contents, asset provenance, complete history, and settled rent events. Playwright covers desktop and mobile, militia selection, persistent randomized identities, all 32 cards, manual bot-card dismissal and ownership, rent popups and reload suppression, history pagination/search/export, real MP3 decoding, audio failure/mute/persistence, hidden decks, camera follow/cancellation, viewport resizing, model rendering, WebGL failure, off-screen rendering suspension, pending-decision reloads, auctions, jail cards, debt management, project-subpath hosting, and the jukebox lifecycle. Jukebox CI tests mock the external player and test CDN failure; actual Archive playback is checked separately in a browser. `.github/workflows/tests.yml` runs both suites on pushes and pull requests.

The frame benchmark measures idle and moving boards with four ships, then a legal maximum-supply layout (32 houses and 12 hotels). It records rAF frame pacing, slow frames, renderer CPU submission time, and GPU identification in [tests/frame-benchmark-results.json](tests/frame-benchmark-results.json). An optional second URL compares a previous build. Run it without other browser test suites competing for the same CPU/GPU. Mobile results are viewport emulation, not measurements on physical phones. Mesh rendering is capped at 30 Hz while moving and sleeps at rest; the camera uses display-rate animation. Fixed structure views are cached rather than re-rendered every frame.

The recorded comparison against `b0976e4` used headless Chromium with the SwiftShader software GPU, 1440×1000 and 390×844 viewports, and 3.5-second samples after warm-up. The updated scenarios measured 58.3–60.0 FPS. The heavily built desktop board improved from 21.1 to 58.9 FPS during movement; its 95th-percentile frame time fell from 83.3 to 16.8 ms. These are local measurements, not a universal performance promise. The previous mobile layout cropped the board, so its mobile result is not an equal-content comparison with the new auto-fit view.

The sound/log update was also tested with 10,000 historical entries, all six audio clips decoded, sound enabled, and synthetic rent popups during movement. Across eight scenarios it measured 57.2–60.0 FPS, with no frames above 34 ms; the fully built desktop board moved at 58.3 FPS. [Feedback stress results](tests/feedback-frame-results.json) include audio status and the bounded 100-entry DOM count. Reproduce without overwriting the earlier comparison:

```sh
EVE_BENCH_FEEDBACK=1 EVE_FRAME_OUTPUT=tests/feedback-frame-results.json npm run benchmark:frames -- http://127.0.0.1:8080
```

Changing renderer source requires `npm run build:graphics` before publishing. Asset-import scripts document the pinned mesh source, geometry-only conversion, simplification, and byte-identical icon extraction. The original texture packs are not required to play or build the renderer.

EVE artwork and hull geometry are CCP intellectual property; Monopoly belongs to Hasbro. This is an unofficial, non-commercial fan project. The stylized warzone command map is original SVG artwork, not a navigation map. This material is used with limited permission of CCP Games. No official affiliation or endorsement by CCP Games is stated or implied. See the linked credits and source terms.
