# Faction Warfare research snapshot

Collected September 22, 2026 UTC (September 21 in New York). The playable board uses 22 individual systems. The 90-system dataset is research evidence, not an additional game directory.

## Public APIs and selection

`warzone-snapshot.json` records the public ESI faction-war roster, joined to system, constellation and region metadata. Filter **original** `owner_faction_id` to Caldari State (500001) and Gallente Federation (500004), so occupied systems remain in the right warzone. It contains 90 systems. Current occupiers and ESI's cached 24-hour kills/jumps are supplementary observations, not permanent board ownership or the hotspot selection criterion.

`warzone-history.json` contains public zKillboard statistics for all 90 systems. The window is **September 2025 through August 2026**, the latest twelve complete UTC calendar months. September 2026 is retained separately and excluded from totals and ranks. This is a calendar-year comparison, not a rolling interval ending on the retrieval day.

For each system, preserve the API's selected monthly objects, source URL, retrieval time, and SHA-256 of the decompressed full response. Compute the median monthly `shipsDestroyed`, annual sum, number of months with at least 100 records, and largest month's share of the annual total. Sort by median, breaking ties by annual total. A missing month is unknown, not zero. **Immuri returned 11 months and is excluded**; the other 89 systems have all twelve.

Median monthly activity favors recurring fighting grounds over one spectacular battle. Select the top 21 systems, plus **Fliet** as one explicit editorial substitution: its median of 400 nearly ties 22nd-place Pynekastoh's 401, and Fliet has the larger annual total (8,119 versus 7,137). The final deeds are Aldranette (3,483 median; 39,292 total) and Tama (5,818 median; 71,532 total). Selected properties ascend by median activity around the classic board. Color groups, prices and board adjacency are game abstractions.

`shipsDestroyed` is a count of recorded killmails. It can include capsules, structures, and player losses to NPCs; it does not count unique fights or isolate militia-versus-militia PvP. Public submission coverage is incomplete, and statistics may be backfilled. A busy system can contain pirates, gate camps, duels and third parties. These limitations are also shown with the [22-system table and monthly charts](../research.html#hotspots).

The ESI snapshot script initially ranks the supplementary daily observation. That ordering is not used by the historical selection. The checked-in board and evidence page are frozen and never fetch APIs during play.

## Reproduce or refresh

Python 3 standard library only; no EVE account, SSO or API key is required. Run from the repository root:

```sh
# Refresh the warzone roster, geography and supplementary 24-hour observation:
python3 scripts/research-warzone.py

# Resume/recompute the saved year using cached system responses:
python3 scripts/research-warzone-history.py --as-of 2026-09-22

# Explicitly fetch that year's statistics again (backfilled counts may change):
python3 scripts/research-warzone-history.py --as-of 2026-09-22 --refresh
```

Without `--as-of`, the history script uses the current UTC date. It requests zKillboard sequentially with a descriptive User-Agent, gzip, 1.1-second spacing, retries for throttling/server errors, and a local cache saved after each system. Cache entries retain their own retrieval timestamps. `--refresh` replaces those observations. Review API usage requirements before increasing the request rate. Refreshing data does not automatically rename the board or rewrite `research.html`; those editorial changes require review together.

## Militia identities and humor

[`bot-roster.js`](../bot-roster.js) is the source catalog for **48 identities, 24 per side**. It records a stable ID, display name, full name, pilot/corporation/alliance type, faction, and reference key. References include a URL, date or historical period, and what establishes the affiliation. The [readable roster](../research.html#opponents) lists every entry and its reference.

Recruitment posts, public biographies, contemporary profiles, event reports and militia discussions establish recognizable organizations and documented participants. This is a curated cameo pool, not an objective fame ranking or a current membership database. Older affiliations are dated explicitly. Simulated board opponents do not imply endorsement, reproduce the named players' behavior, or allege that real players automate EVE.

Each campaign draws three unique names without replacement: one Calmil, one Galmil, and a third opposite the human's chosen faction. Your callsign is excluded. Saved identity IDs restore the same opponents on reload. Identity selection does not alter the three bot strategy profiles. Militia affiliation remains cosmetic under the classic four-player rules.

The [32 card notes](../research.html#cards) separate official mechanics from community vocabulary and original jokes. Themes include Navy plex gates, LP stores, shipcasters, reshipping, FC pings, squids/frogs, seagulling, and rival propaganda. No card attributes a fictional mishap to a named player or corporation. We avoid presenting historical tier payouts, docking access or live system control as fixed rules.

## Primary API references

- [ESI FW systems](https://esi.evetech.net/latest/fw/systems/?datasource=tranquility)
- [ESI system kills](https://esi.evetech.net/latest/universe/system_kills/?datasource=tranquility)
- [ESI system jumps](https://esi.evetech.net/latest/universe/system_jumps/?datasource=tranquility)
- [zKillboard API documentation](https://zkillboard.com/api/docs/)
- [Example statistics endpoint: Tama](https://zkillboard.com/api/stats/solarSystemID/30002813/kills/)
- [CCP Uprising notes: eleven systems removed from FW in 2022](https://www.eveonline.com/news/view/patch-notes-version-20-10)

All per-system request URLs and retrieval times are included in the JSON evidence. Further mechanics, history, recruitment and humor references are linked in `research.html` and `bot-roster.js`.
