#!/usr/bin/env python3
"""Refresh the public ESI evidence used to choose Caldari–Gallente board systems.

No authentication, player data, or runtime game dependency. Run from any folder.
"""
import concurrent.futures
import datetime
import json
from pathlib import Path
import time
import urllib.error
import urllib.request

ROOT = Path(__file__).resolve().parents[1]
API = "https://esi.evetech.net/latest"
FACTIONS = {500001: "Caldari State", 500004: "Gallente Federation"}
USER_AGENT = "New-Eden-Faction-Warfare-Board/1.0 (https://github.com/cyberbalsa/eveonline-monopoly)"


def fetch(route):
    url = API + route + "?datasource=tranquility"
    for attempt in range(4):
        try:
            request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT, "Accept": "application/json"})
            with urllib.request.urlopen(request, timeout=30) as response:
                return json.load(response), {
                    "url": url,
                    "retrievedAt": datetime.datetime.now(datetime.timezone.utc).isoformat(),
                    "lastModified": response.headers.get("Last-Modified"),
                    "expires": response.headers.get("Expires"),
                }
        except urllib.error.HTTPError as error:
            if error.code not in (420, 429, 500, 502, 503, 504) or attempt == 3:
                raise
            time.sleep(min(30, int(error.headers.get("Retry-After", 2 ** (attempt + 1)))))
        except (urllib.error.URLError, TimeoutError):
            if attempt == 3:
                raise
            time.sleep(2 ** attempt)


def main():
    fw, fw_source = fetch("/fw/systems/")
    kills, kills_source = fetch("/universe/system_kills/")
    jumps, jumps_source = fetch("/universe/system_jumps/")
    warzone = [system for system in fw if system["owner_faction_id"] in FACTIONS]
    kills = {system["system_id"]: system for system in kills}
    jumps = {system["system_id"]: system["ship_jumps"] for system in jumps}
    print(f"Resolving {len(warzone)} Caldari–Gallente FW systems…", flush=True)
    with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
        details = list(pool.map(lambda system: fetch(f'/universe/systems/{system["solar_system_id"]}/')[0], warzone))
        constellation_ids = sorted({system["constellation_id"] for system in details})
        constellations = dict(zip(constellation_ids, pool.map(lambda identifier: fetch(f"/universe/constellations/{identifier}/")[0], constellation_ids)))
        region_ids = sorted({constellation["region_id"] for constellation in constellations.values()})
        regions = dict(zip(region_ids, pool.map(lambda identifier: fetch(f"/universe/regions/{identifier}/")[0], region_ids)))
    systems = []
    for fw_system, detail in zip(warzone, details):
        identifier = fw_system["solar_system_id"]
        constellation = constellations[detail["constellation_id"]]
        activity = kills.get(identifier, {})
        systems.append({
            "id": identifier,
            "name": detail["name"],
            "region": regions[constellation["region_id"]]["name"],
            "constellation": constellation["name"],
            "security": detail["security_status"],
            "originalFaction": FACTIONS[fw_system["owner_faction_id"]],
            "occupierAtSnapshot": FACTIONS.get(fw_system["occupier_faction_id"], str(fw_system["occupier_faction_id"])),
            "shipKills": activity.get("ship_kills", 0),
            "podKills": activity.get("pod_kills", 0),
            "npcKills": activity.get("npc_kills", 0),
            "jumps": jumps.get(identifier, 0),
        })
    systems.sort(key=lambda system: (-system["shipKills"], -system["podKills"], system["name"]))
    snapshot = {
        "retrievedAt": datetime.datetime.now(datetime.timezone.utc).isoformat(),
        "sources": [fw_source, kills_source, jumps_source],
        "metadataRoutes": [API + route for route in ["/universe/systems/{system_id}/", "/universe/constellations/{constellation_id}/", "/universe/regions/{region_id}/"]],
        "method": "Filter FW systems by original owner_faction_id 500001 or 500004. Join ESI's previous-24-hour ship kills, pod kills and jumps by system ID. Rank by ship kills, then pod kills; jumps are context only. Missing activity records mean zero. NPC kills are recorded separately and never count towards the ranking.",
        "limitations": "One cached 24-hour observation, not a long-term ranking. Ship and pod totals include all activity, not just militia combat; ESI does not identify factions or distinguish gate camps, duels and fleet battles. Endpoint cache windows can differ. Occupancy is snapshot evidence, never permanent board ownership.",
        "systems": systems,
    }
    target = ROOT / "research" / "warzone-snapshot.json"
    target.parent.mkdir(exist_ok=True)
    temporary = target.with_suffix(".tmp")
    temporary.write_text(json.dumps(snapshot, indent=2) + "\n")
    temporary.replace(target)
    print(f"Saved {target}")
    for system in systems[:35]:
        print(f'{system["name"]:16} {system["region"]:13} ships={system["shipKills"]:4} pods={system["podKills"]:4} jumps={system["jumps"]:5}')


if __name__ == "__main__":
    main()
