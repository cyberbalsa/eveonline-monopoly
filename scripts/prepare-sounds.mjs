// Input: extracted EVE Online Audio Warnings and Chimes v2, shared by Mad_Guns22.
// Only the six named MP3s are read. No code from the archive is executed.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
const input = process.argv[2];
if (!input) throw new Error('Usage: node scripts/prepare-sounds.mjs EXTRACTED_DIRECTORY');
const output = resolve('assets/sounds');
mkdirSync(output, { recursive: true });
const clips = [
  ['interface', 'Cargo Warning', 0.88],
  ['connecting', 'Login Connecting [wo Aura]', 2.77],
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
  return { file: `assets/sounds/${name}.mp3`, original: `EVE Online - ${original}.mp3`, duration, originalSHA256: sha(source), sha256: sha(target) };
});
writeFileSync(join(output, 'provenance.json'), JSON.stringify({
  owner: 'CCP Games', recorder: 'Mad_Guns22',
  source: 'https://www.reddit.com/r/Eve/comments/2r3pwl/eve_online_audio_warning_and_training_completed/',
  archive: 'https://www.mediafire.com/file/axi2yh02onyrig7/EVE_Online_Audio_Warnings_and_Chimes_v2.7z/file',
  terms: 'https://support.eveonline.com/hc/en-us/articles/8563917741084-EVE-Online-Content-Creation-Terms-of-Use',
  processing: 'CCP in-game audio recorded by the source author. Trimmed, faded, converted to mono 44.1kHz 96kbps MP3; no synthesized imitation or voice cloning. Not public domain.',
  files
}, null, 2) + '\n');
console.log(`Prepared ${files.length} EVE clips in ${output}`);
