import { copyFile, mkdir } from 'node:fs/promises';
await mkdir(new URL('../src/vendor/',import.meta.url),{recursive:true});
for(const name of ['three.module.js','three.core.js']) await copyFile(new URL(`../node_modules/three/build/${name}`,import.meta.url),new URL(`../src/vendor/${name}`,import.meta.url));
await copyFile(new URL('../node_modules/three/LICENSE',import.meta.url),new URL('../src/vendor/THREE-LICENSE.txt',import.meta.url));
console.log('Three.js copied to local assets.');
