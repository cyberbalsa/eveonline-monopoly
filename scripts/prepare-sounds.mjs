// Inputs: extracted EVE Warnings and Chimes v2, Kenney Casino Audio 1.1,
// and Kenney Sci-fi Sounds 1.0. Only named audio files are read, never code.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
const [input, casino, scifi] = process.argv.slice(2);
if (!input || !casino || !scifi) throw new Error('Usage: node scripts/prepare-sounds.mjs EVE_DIRECTORY CASINO_DIRECTORY SCIFI_DIRECTORY');
const output = resolve('assets/sounds');
mkdirSync(output, { recursive: true });
const clips = [
  ['interface', 'Cargo Warning', 0.88],
  ['notification', 'Notification Ping', 3.96],
  ['complete', 'Skill Completed Chime [wo Aura]', 4.0],
  ['capacitor', 'Capacitor Warning', 1.17],
  ['structure', 'Structure Warning', 1.84]
];
const sha = (file) => createHash('sha256').update(readFileSync(file)).digest('hex');
const files = clips.map(([name, original, duration]) => {
  const source = join(resolve(input), `EVE Online - ${original}.mp3`);
  const target = join(output, `${name}.mp3`);
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', source, '-t', String(duration), '-af', `afade=t=in:d=0.015,afade=t=out:st=${duration - 0.15}:d=0.15`, '-ac', '1', '-ar', '44100', '-codec:a', 'libmp3lame', '-b:a', '96k', '-map_metadata', '-1', target]);
  return { file: `assets/sounds/${name}.mp3`, source: 'eve', original: `EVE Online - ${original}.mp3`, duration, originalSHA256: sha(source), sha256: sha(target) };
});
// Natural two-dice impacts settle before the 385ms roll animation ends.
// The engine is a single soft launch, not a loop or an alarm on each square.
for (const clip of [
  { name: 'dice-roll', source: 'casino', directory: casino, original: 'Audio/dice-throw-3.ogg', duration: 0.36,
    filter: 'atrim=start=0.025:duration=0.36,asetpts=PTS-STARTPTS,highpass=f=140,lowpass=f=6500,volume=0.7,afade=t=in:d=0.004,afade=t=out:st=0.28:d=0.08' },
  { name: 'ship-thrust', source: 'scifi', directory: scifi, original: 'Audio/thrusterFire_000.ogg', duration: 1.05,
    filter: 'atrim=duration=1.05,asetpts=PTS-STARTPTS,highpass=f=90,lowpass=f=1800,afade=t=in:d=0.09,afade=t=out:st=0.25:d=0.8' }
]) {
  const source = join(resolve(clip.directory), clip.original), target = join(output, `${clip.name}.mp3`);
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', source, '-af', clip.filter, '-ac', '1', '-ar', '44100', '-codec:a', 'libmp3lame', '-b:a', '96k', '-map_metadata', '-1', target]);
  files.push({ file: `assets/sounds/${clip.name}.mp3`, source: clip.source, original: clip.original, duration: clip.duration,
    filter: clip.filter, originalSHA256: sha(source), sha256: sha(target) });
}
writeFileSync(join(output, 'provenance.json'), JSON.stringify({
  sources: {
    eve: {
      owner: 'CCP Games', recorder: 'Mad_Guns22',
      source: 'https://www.reddit.com/r/Eve/comments/2r3pwl/eve_online_audio_warning_and_training_completed/',
      archive: 'https://www.mediafire.com/file/axi2yh02onyrig7/EVE_Online_Audio_Warnings_and_Chimes_v2.7z/file',
      terms: 'https://support.eveonline.com/hc/en-us/articles/8563917741084-EVE-Online-Content-Creation-Terms-of-Use',
      processing: 'CCP in-game audio recorded by the source author. Trimmed and faded; no synthesized imitation or voice cloning. Not public domain.'
    },
    casino: {
      owner: 'Kenney', pack: 'Casino Audio 1.1', source: 'https://kenney.nl/assets/casino-audio',
      archive: 'https://kenney.nl/media/pages/assets/casino-audio/2472606a04-1721639069/kenney_casino-audio.zip',
      terms: 'https://creativecommons.org/publicdomain/zero/1.0/', license: 'CC0-1.0',
      processing: 'Dice foley trimmed and EQ-filtered with soft edges. Not EVE audio.'
    },
    scifi: {
      owner: 'Kenney', pack: 'Sci-fi Sounds 1.0', source: 'https://kenney.nl/assets/sci-fi-sounds',
      archive: 'https://kenney.nl/media/pages/assets/sci-fi-sounds/6b296f9ecf-1677589334/kenney_sci-fi-sounds.zip',
      terms: 'https://creativecommons.org/publicdomain/zero/1.0/', license: 'CC0-1.0',
      processing: 'Thruster sample trimmed, EQ-filtered and faded to a short one-shot. Not EVE audio.'
    }
  },
  encoding: 'Mono 44.1kHz 96kbps MP3. Five unchanged EVE cues plus two supplemental CC0 action sounds.',
  files
}, null, 2) + '\n');
console.log(`Prepared ${files.length} clips in ${output}`);
