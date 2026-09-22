/* Public militia-history cameos. Dates and affiliations: research.html#opponents. */
(function(root) {
  const sources = {
  "ccdm": {
    "url": "https://forums.eveonline.com/t/ccdm-caldari-faction-warfare/368568",
    "period": "2022",
    "title": "CCDM recruitment by Scylus Black; identifies Templis CALSF"
  },
  "bloc": {
    "url": "https://forums.eveonline.com/t/the-bloc-us-and-eu-tz-caldari-lowsec-pvp-corp-fw-100-pilots/16102",
    "period": "2017",
    "title": "The Bloc recruitment and Caldari fleet reports"
  },
  "ucn": {
    "url": "https://forums.eveonline.com/t/calmil-fw-united-caldari-navy-is-recruiting/356580",
    "period": "2022",
    "title": "UCN recruitment by Nayrok Fenix"
  },
  "ucsc": {
    "url": "https://forums.eveonline.com/t/united-caldari-space-command-alliance-lf-corps/357192",
    "period": "2022–2026",
    "title": "UCSC alliance recruitment"
  },
  "mercury": {
    "url": "https://www.reddit.com/r/evejobs/comments/1evy9lp/",
    "period": "2024",
    "title": "Mercury Arms corporation recruitment"
  },
  "ctoc": {
    "url": "https://forums.eveonline.com/t/c-toc-is-recruiting-low-sec-pvp-and-fw/464019",
    "period": "2024",
    "title": "C-TOC recruitment"
  },
  "blackhand": {
    "url": "https://www.reddit.com/r/evejobs/comments/1badiph/",
    "period": "2024",
    "title": "Caldari Black Hand recruitment"
  },
  "stateNews": {
    "url": "https://caldarifw.com/news",
    "period": "accessed 2026-09-22",
    "title": "Caldari community reports naming KARNAGE, Ghostbirds and Fourth District"
  },
  "bloodbrawl": {
    "url": "https://caldarifw.com/events",
    "period": "2025 Blood Brawl",
    "title": "Caldari community event report credits Abby Aurilen, Corvus Onzo and Nuke Blast"
  },
  "lambda": {
    "url": "https://forums.eveonline.com/t/sayr-achur-state-mountain-report-igs-news-feed/365569/38",
    "period": "2022",
    "title": "Community interview with UCSC officer and UCN FC Lambda Thyl"
  },
  "veterans": {
    "url": "https://forums-archive.eveonline.com/message/1532800/",
    "period": "2012",
    "title": "Contemporary Caldari militia guide: Damar Rocarion, Bad Messenger, Nasranite Watch and Caldari State Capturing"
  },
  "posters": {
    "url": "https://forums.eveonline.com/t/win-a-carrier-with-your-art-caldari-militia-coalition-yc119-propaganda-contest/38490",
    "period": "2017",
    "title": "Propaganda contest names militia directors Diana Kim, CPTRINGO and TheLastSparton"
  },
  "justified": {
    "url": "https://forums.eveonline.com/t/justified-chaos-ustz-gallente-fw-and-sov-null/45165",
    "period": "2017",
    "title": "Justified Chaos recruitment by SmokinJs Arthie"
  },
  "qcats": {
    "url": "https://sovereigntywars.wordpress.com/2011/08/26/quantum-cats-syndicate-gallente/",
    "period": "2011",
    "title": "Contemporary QCATS profile names founder Juan Rayo, CEO Ammon Dei and founding member Chatgris"
  },
  "blackfox": {
    "url": "https://evenews24.com/2016/06/22/faction-warfare-whats-going-on/",
    "period": "2016",
    "title": "Militia interviews including Black Fox Marauders leadership"
  },
  "aideron": {
    "url": "https://forums.eveonline.com/t/join-aideron-robotics-a-gallente-fw-pvp-corp-today/208925",
    "period": "2019",
    "title": "Aideron Robotics Gallente recruitment by youngpuke2"
  },
  "sons": {
    "url": "https://forums.eveonline.com/t/sons-of-luminaire-faction-war-eutz-small-gang-pvp-villore-accords/259591",
    "period": "2020",
    "title": "Sons of Luminaire Gallente recruitment"
  },
  "gmva": {
    "url": "https://forums.eveonline.com/t/wings-of-valor-gallente-militia-captures-the-warzone/227664",
    "period": "2020",
    "title": "Julianus Soter reports a Villore Accords-led warzone campaign"
  },
  "pond": {
    "url": "https://forums.eveonline.com/t/ribbit-alliance-looking-for-new-corps-to-join-the-pond-eu-us/459130",
    "period": "2024",
    "title": "Ribbit recruitment recounts The Frog Pond origins"
  },
  "toads": {
    "url": "https://forums.eveonline.com/t/cr0ak-battle-toads-brigade-gallente-fw-pvp-industry-exploration-ribbit-alliance/486880",
    "period": "2025",
    "title": "Battle Toads Brigade recruitment in RIBBIT"
  },
  "rapid": {
    "url": "https://universe.eveonline.com/interstellar-correspondents/corporations-in-the-spotlight-rapid-withdrawal",
    "period": "2015",
    "title": "Official corporation spotlight: Rapid Withdrawal in Gallente FW"
  },
  "sedition": {
    "url": "https://forums.eveonline.com/t/sedition-gallente-fw-pirates-industry-low-sec-npc-null-ustz-eu/371187",
    "period": "2022",
    "title": "Sedition recruitment by youngpuke2"
  },
  "canary": {
    "url": "https://forums.eveonline.com/t/blue-canary-gallente-fw-eutz/406177",
    "period": "2023",
    "title": "Blue Canary Gallente recruitment"
  },
  "ffl": {
    "url": "https://forums.eveonline.com/t/federation-front-line-faction-warfare-pvp/347797",
    "period": "2022",
    "title": "Federation Front Line recruitment by Frozen Fallout"
  },
  "report": {
    "url": "https://federationfrontlinereport.com/frozen-fallout-for-csm",
    "period": "2024",
    "title": "Frozen Fallout’s public campaign biography and Gallente history"
  },
  "gallentius": {
    "url": "https://zkillboard.com/kill/33770392/",
    "period": "2013",
    "title": "Public kill record: X Gallentius, Justified Chaos, Gallente Federation"
  },
  "thanatos": {
    "url": "https://forums-archive.eveonline.com/message/4846939/",
    "period": "2014",
    "title": "Burn Okkamon discussion by Black Fox Marauders pilot Thanatos Marathon"
  },
  "rinai": {
    "url": "https://forums.eveonline.com/t/nadsc-public-announcement-operation-prevailing-liberty/193421",
    "period": "2019",
    "title": "Rinai Vero signs as FDU general and GMVA diplomat"
  }
};
  const entries = [
    {"id":"calmil-templis-calsf","faction":"calmil","name":"Templis CALSF","fullName":"Templis CALSF","kind":"alliance","source":"ccdm"},
    {"id":"calmil-ccdm","faction":"calmil","name":"CCDM","fullName":"Caldari Colonial Defense Ministry","kind":"corporation","source":"ccdm"},
    {"id":"calmil-the-bloc","faction":"calmil","name":"The Bloc","fullName":"The Bloc","kind":"corporation","source":"bloc"},
    {"id":"calmil-united-caldari-navy","faction":"calmil","name":"United Caldari Navy","fullName":"United Caldari Navy","kind":"corporation","source":"ucn"},
    {"id":"calmil-ucsc","faction":"calmil","name":"UCSC","fullName":"United Caldari Space Command","kind":"alliance","source":"ucsc"},
    {"id":"calmil-mercury-arms-inc","faction":"calmil","name":"Mercury Arms Inc.","fullName":"Mercury Arms Inc.","kind":"corporation","source":"mercury"},
    {"id":"calmil-c-toc","faction":"calmil","name":"C-TOC","fullName":"Caldari Tactical Operations Command","kind":"alliance","source":"ctoc"},
    {"id":"calmil-caldari-black-hand","faction":"calmil","name":"Caldari Black Hand","fullName":"Caldari Black Hand","kind":"corporation","source":"blackhand"},
    {"id":"calmil-karnage","faction":"calmil","name":"KARNAGE","fullName":"KARNAGE","kind":"corporation","source":"stateNews"},
    {"id":"calmil-ghostbirds","faction":"calmil","name":"Ghostbirds","fullName":"Ghostbirds","kind":"alliance","source":"stateNews"},
    {"id":"calmil-fourth-district","faction":"calmil","name":"Fourth District","fullName":"The Caldari Fourth District","kind":"alliance","source":"stateNews"},
    {"id":"calmil-scylus-black","faction":"calmil","name":"Scylus Black","fullName":"Scylus Black","kind":"pilot","source":"ccdm"},
    {"id":"calmil-nayrok-fenix","faction":"calmil","name":"Nayrok Fenix","fullName":"Nayrok Fenix","kind":"pilot","source":"ucn"},
    {"id":"calmil-lambda-thyl","faction":"calmil","name":"Lambda Thyl","fullName":"Lambda Thyl","kind":"pilot","source":"lambda"},
    {"id":"calmil-abby-aurilen","faction":"calmil","name":"Abby Aurilen","fullName":"Abby Aurilen","kind":"pilot","source":"bloodbrawl"},
    {"id":"calmil-corvus-onzo","faction":"calmil","name":"Corvus Onzo","fullName":"Corvus Onzo","kind":"pilot","source":"bloodbrawl"},
    {"id":"calmil-nuke-blast","faction":"calmil","name":"Nuke Blast","fullName":"Nuke Blast","kind":"pilot","source":"bloodbrawl"},
    {"id":"calmil-damar-rocarion","faction":"calmil","name":"Damar Rocarion","fullName":"Damar Rocarion","kind":"pilot","source":"veterans"},
    {"id":"calmil-diana-kim","faction":"calmil","name":"Diana Kim","fullName":"Diana Kim","kind":"pilot","source":"posters"},
    {"id":"calmil-bad-messenger","faction":"calmil","name":"Bad Messenger","fullName":"Bad Messenger","kind":"pilot","source":"veterans"},
    {"id":"calmil-nasranite-watch","faction":"calmil","name":"Nasranite Watch","fullName":"Nasranite Watch","kind":"corporation","source":"veterans"},
    {"id":"calmil-caldari-state-capturing","faction":"calmil","name":"Caldari State Capturing","fullName":"Caldari State Capturing","kind":"alliance","source":"veterans"},
    {"id":"calmil-cptringo","faction":"calmil","name":"CPTRINGO","fullName":"CPTRINGO","kind":"pilot","source":"posters"},
    {"id":"calmil-thelastsparton","faction":"calmil","name":"TheLastSparton","fullName":"TheLastSparton","kind":"pilot","source":"posters"},
    {"id":"galmil-justified-chaos","faction":"galmil","name":"Justified Chaos","fullName":"Justified Chaos","kind":"corporation","source":"justified"},
    {"id":"galmil-qcats","faction":"galmil","name":"QCATS","fullName":"Quantum Cats Syndicate","kind":"corporation","source":"qcats"},
    {"id":"galmil-black-fox-marauders","faction":"galmil","name":"Black Fox Marauders","fullName":"Black Fox Marauders","kind":"corporation","source":"blackfox"},
    {"id":"galmil-aideron-robotics","faction":"galmil","name":"Aideron Robotics","fullName":"Aideron Robotics","kind":"corporation","source":"aideron"},
    {"id":"galmil-sons-of-luminaire","faction":"galmil","name":"Sons of Luminaire","fullName":"Sons of Luminaire","kind":"corporation","source":"sons"},
    {"id":"galmil-villore-accords","faction":"galmil","name":"Villore Accords","fullName":"Villore Accords","kind":"alliance","source":"gmva"},
    {"id":"galmil-the-frog-pond","faction":"galmil","name":"The Frog Pond","fullName":"The Frog Pond","kind":"corporation","source":"pond"},
    {"id":"galmil-ribbit","faction":"galmil","name":"Ribbit.","fullName":"Ribbit.","kind":"alliance","source":"pond"},
    {"id":"galmil-battle-toads-brigade","faction":"galmil","name":"Battle Toads Brigade","fullName":"Battle Toads Brigade","kind":"corporation","source":"toads"},
    {"id":"galmil-rapid-withdrawal","faction":"galmil","name":"Rapid Withdrawal","fullName":"Rapid Withdrawal","kind":"corporation","source":"rapid"},
    {"id":"galmil-sedition","faction":"galmil","name":"Sedition.","fullName":"Sedition.","kind":"alliance","source":"sedition"},
    {"id":"galmil-blue-canary","faction":"galmil","name":"Blue Canary","fullName":"Blue Canary","kind":"corporation","source":"canary"},
    {"id":"galmil-federation-front-line","faction":"galmil","name":"Federation Front Line","fullName":"Federation Front Line","kind":"alliance","source":"ffl"},
    {"id":"galmil-front-line-report","faction":"galmil","name":"Front Line Report","fullName":"Federation Front Line Report","kind":"corporation","source":"report"},
    {"id":"galmil-julianus-soter","faction":"galmil","name":"Julianus Soter","fullName":"Julianus Soter","kind":"pilot","source":"gmva"},
    {"id":"galmil-x-gallentius","faction":"galmil","name":"X Gallentius","fullName":"X Gallentius","kind":"pilot","source":"gallentius"},
    {"id":"galmil-thanatos-marathon","faction":"galmil","name":"Thanatos Marathon","fullName":"Thanatos Marathon","kind":"pilot","source":"thanatos"},
    {"id":"galmil-frozen-fallout","faction":"galmil","name":"Frozen Fallout","fullName":"Frozen Fallout","kind":"pilot","source":"report"},
    {"id":"galmil-youngpuke2","faction":"galmil","name":"youngpuke2","fullName":"youngpuke2","kind":"pilot","source":"sedition"},
    {"id":"galmil-rinai-vero","faction":"galmil","name":"Rinai Vero","fullName":"Rinai Vero","kind":"pilot","source":"rinai"},
    {"id":"galmil-ammon-dei","faction":"galmil","name":"Ammon Dei","fullName":"Ammon Dei","kind":"pilot","source":"qcats"},
    {"id":"galmil-chatgris","faction":"galmil","name":"chatgris","fullName":"chatgris","kind":"pilot","source":"qcats"},
    {"id":"galmil-juan-rayo","faction":"galmil","name":"Juan Rayo","fullName":"Juan Rayo","kind":"pilot","source":"qcats"},
    {"id":"galmil-smokinjs-arthie","faction":"galmil","name":"SmokinJs Arthie","fullName":"SmokinJs Arthie","kind":"pilot","source":"justified"}
  ];
  function pick(factions, random = Math.random, excludedNames = []) {
    const used = new Set(excludedNames.map(name => name.trim().toLowerCase()));
    return factions.map(faction => {
      const choices = entries.filter(entry => entry.faction === faction && !used.has(entry.name.toLowerCase()) && !used.has(entry.fullName.toLowerCase()));
      if (!choices.length) throw new Error('No unused militia identities for ' + faction);
      const entry = choices[Math.min(choices.length - 1, Math.max(0, Math.floor(random() * choices.length)))];
      used.add(entry.name.toLowerCase()); used.add(entry.fullName.toLowerCase());
      return entry;
    });
  }
  const roster = { sources, entries, pick, find: id => entries.find(entry => entry.id === id) };
  if (typeof module !== 'undefined' && module.exports) module.exports = roster;
  else root.GAME_ROSTER = roster;
})(typeof globalThis !== 'undefined' ? globalThis : this);
