const test = require("node:test");
const assert = require("node:assert/strict");
const soundtrack = require("../soundtrack");

test("soundtrack uses all 14 ordered Archive MP3s with explicit metadata and no local audio", () => {
  assert.equal(soundtrack.tracks.length, 14);
  assert.equal(new Set(soundtrack.tracks.map((t) => t.url)).size, 14);
  soundtrack.tracks.forEach((track, index) => {
    const url = new URL(track.url);
    assert.equal(url.origin, "https://archive.org");
    assert.match(url.pathname, /^\/download\/eve-online-soundtrack\//);
    assert.ok(decodeURIComponent(url.pathname).split("/").at(-1).startsWith(String(index + 1).padStart(2, "0") + " "));
    assert.ok(url.pathname.endsWith(".mp3"));
    assert.equal(track.metaData.artist, soundtrack.artist);
    assert.ok(track.metaData.title.length > 0 && track.duration > 0);
  });
  assert.match(soundtrack.webamp.url, /webamp@2\.3\.1\/built\/webamp\.bundle\.min\.js$/);
  assert.match(soundtrack.webamp.integrity, /^sha384-[A-Za-z0-9+/]{64}$/);
  assert.equal(soundtrack.tracks[6].metaData.title, "Do You Know Where You Are?");
  assert.ok(!soundtrack.tracks[6].url.includes("%3F"), "question mark belongs to the title, not the filename");
});
