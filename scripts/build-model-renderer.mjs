import { build } from 'esbuild';
import { mkdir, copyFile } from 'node:fs/promises';
await mkdir('vendor', {recursive:true});
await build({entryPoints:['board-models.js'],bundle:true,minify:true,format:'iife',target:['es2020'],outfile:'vendor/board-models.min.js',legalComments:'linked'});
await copyFile('node_modules/three/LICENSE','vendor/THREE-LICENSE.txt');
