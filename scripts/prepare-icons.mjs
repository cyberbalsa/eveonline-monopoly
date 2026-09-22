// Extract unmodified, colored CCP icons from the official Phoebe 1.0 pack.
// Run: node scripts/prepare-icons.mjs /absolute/path/to/Phoebe_1.0_Icons.zip
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {unzipSync} from 'three/addons/libs/fflate.module.js';
const input = process.argv[2];
if (!input || !input.startsWith('/')) throw new Error('Supply the absolute path to the official icon ZIP.');
const archive = unzipSync(await readFile(input));
const mapping = {mail:'7_64_14',local:'9_64_2',assets:'7_64_13',contracts:'7_64_3',navigation:'9_64_4',wallet:'7_64_2',industry:'7_64_12',security:'9_64_8',undock:'9_64_6',station:'24_64_10'};
await mkdir('assets/icons',{recursive:true});
const icons = [];
for (const [name,id] of Object.entries(mapping)) {
  const source = `Icons/items/${id}.png`, bytes = archive[source];
  if (!bytes) throw new Error(`Missing ${source}`);
  await writeFile(`assets/icons/${name}.png`,bytes);
  icons.push({name,source,sha256:createHash('sha256').update(bytes).digest('hex')});
}
await writeFile('assets/icons/provenance.json',JSON.stringify({copyright:'© CCP Games',source:'https://content.eveonline.com/data/Phoebe_1.0_Icons.zip',icons},null,2)+'\n');
