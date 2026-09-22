#!/usr/bin/env python3
"""Rank the ESI warzone roster using twelve complete months of public zKill data.

Requests are sequential, compressed, locally cached, and spaced by 1.1 seconds.
Uses the documented public statistics endpoint; no account or SSO is needed.
"""
import argparse
import datetime
import gzip
import hashlib
import json
from pathlib import Path
import statistics
import time
import urllib.error
import urllib.request

ROOT = Path(__file__).resolve().parents[1]
USER_AGENT = "New-Eden-FW-Research/1.0 (https://github.com/cyberbalsa/eveonline-monopoly)"


def month_key(offset):
    year, month = divmod(offset, 12)
    return f"{year:04}{month + 1:02}"


def fetch(identifier):
    url = f"https://zkillboard.com/api/stats/solarSystemID/{identifier}/kills/"
    for attempt in range(4):
        time.sleep(1.1)
        try:
            request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT, "Accept": "application/json", "Accept-Encoding": "gzip"})
            with urllib.request.urlopen(request, timeout=30) as response:
                raw = response.read()
                if response.headers.get("Content-Encoding") == "gzip":
                    raw = gzip.decompress(raw)
                body = json.loads(raw)
                if not isinstance(body, dict) or "error" in body or not isinstance(body.get("months"), dict):
                    raise ValueError(f"Missing monthly statistics for {identifier}: {str(body)[:120]}")
                return body, {"url": url, "retrievedAt": datetime.datetime.now(datetime.timezone.utc).isoformat(), "responseSha256": hashlib.sha256(raw).hexdigest()}
        except urllib.error.HTTPError as error:
            if error.code not in (420, 429, 500, 502, 503, 504) or attempt == 3:
                raise
            time.sleep(min(60, int(error.headers.get("Retry-After", 5 * (attempt + 1)))))
        except (urllib.error.URLError, TimeoutError):
            if attempt == 3:
                raise
            time.sleep(5 * (attempt + 1))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--as-of", type=datetime.date.fromisoformat, default=datetime.datetime.now(datetime.timezone.utc).date())
    parser.add_argument("--refresh", action="store_true", help="Replace cached monthly observations")
    args = parser.parse_args()
    current = args.as_of.year * 12 + args.as_of.month - 1
    months = [month_key(offset) for offset in range(current - 12, current)]
    partial = month_key(current)
    roster = json.loads((ROOT / "research/warzone-snapshot.json").read_text())["systems"]
    target = ROOT / "research/warzone-history.json"
    cached = json.loads(target.read_text()) if target.exists() else {}
    systems = {row["id"]: row for row in cached.get("systems", [])} if cached.get("months") == months and not args.refresh else {}
    for i, system in enumerate(roster):
        identifier = system["id"]
        if identifier not in systems:
            body, source = fetch(identifier)
            # Preserve the exact selected monthly objects. Missing months stay missing.
            raw_months = {key: body["months"][key] for key in months + [partial] if key in body["months"]}
            counts = [raw_months[key].get("shipsDestroyed", 0) for key in months if key in raw_months]
            complete = len(counts) == 12
            total = sum(counts)
            systems[identifier] = {
                "id": identifier, "name": system["name"], "region": system["region"], "constellation": system["constellation"],
                "source": source, "rawMonths": raw_months, "monthsReturned": len(counts),
                "totalRecordedKills": total if complete else None,
                "medianMonthlyKills": statistics.median(counts) if complete else None,
                "monthsOver100Kills": sum(count >= 100 for count in counts) if complete else None,
                "largestMonthShare": round(max(counts) / total, 4) if complete and total else None,
                "partialMonthRecordedKills": raw_months.get(partial, {}).get("shipsDestroyed"),
            }
        ranked = sorted(systems.values(), key=lambda row: (-(row["medianMonthlyKills"] if row["medianMonthlyKills"] is not None else -1), -(row["totalRecordedKills"] or 0), row["name"]))
        result = {
            "asOf": args.as_of.isoformat(), "retrievedAt": datetime.datetime.now(datetime.timezone.utc).isoformat(),
            "months": months, "partialMonth": partial, "expectedSystems": len(roster), "fetchedSystems": len(systems),
            "method": "Twelve complete UTC calendar months before asOf; current partial month shown separately and excluded from ranks. Rank every Caldari–Gallente ESI FW system by median monthly zKillboard shipsDestroyed, breaking ties by annual total. The median favors persistent combat locations over one battle. Preserve exact returned monthly objects; missing months are unknown, not invented zeroes. Incomplete records are excluded from ranks.",
            "limitations": "Calendar-year proxy, not an exact rolling 365-day interval. zKillboard shipsDestroyed counts recorded killmails, including capsules/structures and potentially player losses to NPCs; it is not a count of unique fights or exclusively militia PvP. Voluntary killmail coverage is incomplete. Regional affiliation is from ESI; militia involvement needs separate evidence. Statistics may be backfilled. This is a frozen research snapshot, not live game data.",
            "systems": ranked,
        }
        temporary = target.with_suffix(".tmp")
        temporary.write_text(json.dumps(result, indent=2) + "\n")
        temporary.replace(target)
        if i % 10 == 0 or i == len(roster) - 1:
            print(f'{i + 1}/{len(roster)} systems: {system["name"]}', flush=True)
    print(f"Period: {months[0]}–{months[-1]}; partial {partial} separate.")
    for row in ranked[:35]:
        print(f'{row["name"]:16} {row["region"]:13} total={str(row["totalRecordedKills"]):>7} median={str(row["medianMonthlyKills"]):>6} active100={row["monthsOver100Kills"]}/12 spike={row["largestMonthShare"]}')


if __name__ == "__main__":
    main()
