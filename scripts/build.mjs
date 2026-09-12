import { cp, mkdir, readFile } from 'node:fs/promises';
import './vendor.mjs';
const root=new URL('../',import.meta.url),output=new URL('../dist/',import.meta.url);
await mkdir(output,{recursive:true});
for(const entry of ['index.html','src','locales'])await cp(new URL(entry,root),new URL(entry,output),{recursive:true});
const pkg=JSON.parse(await readFile(new URL('package.json',root),'utf8'));
console.log(`Built Lane Split Rush with Three.js ${pkg.dependencies.three} in dist/ (all assets local).`);
