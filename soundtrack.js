// Titles, filenames and durations checked against the Archive item metadata.
// Audio stays on Archive.org; no soundtrack files are bundled with the game.
const EVE_SOUNDTRACK = {
  source: "https://archive.org/details/eve-online-soundtrack/",
  artist: "Jón Hallur Haraldsson",
  album: "EVE Online - Original Soundtrack",
  webamp: {
    url: "https://cdn.jsdelivr.net/npm/webamp@2.3.1/built/webamp.bundle.min.js",
    integrity: "sha384-9waE2xOw4VkyDDXbmumm9jR3ovD2w9gGl0+ehyi66rJSOPx9lyNxs8+jSS2HruM6"
  },
  tracks: [
    ["01 Surplus of Rare Artifacts.mp3", "Surplus of Rare Artifacts", 349.13],
    ["02 Below the Asteroids.mp3", "Below the Asteroids", 249.91],
    ["03 The Green Nebula.mp3", "The Green Nebula", 352.03],
    ["04 Primordial Star Clouds.mp3", "Primordial Star Clouds", 320.03],
    ["05 Merchants, Looters and Ghosts.mp3", "Merchants, Looters and Ghosts", 384.03],
    ["06 Nouvelle Rouvenor Hero.mp3", "Nouvelle Rouvenor Hero", 301.77],
    ["07 Do You Know Where You Are.mp3", "Do You Know Where You Are?", 336.04],
    ["08 I Saw Your Ship.mp3", "I Saw Your Ship", 276.04],
    ["09 We Fight Proud for The Holder.mp3", "We Fight Proud for The Holder", 240.04],
    ["10 Rose of Victory.mp3", "Rose of Victory", 324.05],
    ["11 Love, Honour and Obey.mp3", "Love, Honour and Obey", 312.03],
    ["12 Gallentean Refuge.mp3", "Gallentean Refuge", 281.63],
    ["13 Omens.mp3", "Omens", 240.04],
    ["14 All Which Was Lost Has Now Been Regained.mp3", "All Which Was Lost Has Now Been Regained", 386.82]
  ].map(([filename, title, duration]) => ({
    url: `https://archive.org/download/eve-online-soundtrack/${encodeURIComponent(filename)}`,
    metaData: { artist: "Jón Hallur Haraldsson", title, album: "EVE Online - Original Soundtrack" },
    duration
  }))
};

if (typeof module !== "undefined" && module.exports) module.exports = EVE_SOUNDTRACK;
