import { cp, mkdir, readFile, readdir, stat } from 'node:fs/promises';
import { gzipSync } from 'node:zlib';
import './vendor.mjs';
const root=new URL('../',import.meta.url),output=new URL('../dist/',import.meta.url);
await mkdir(output,{recursive:true});
for(const entry of ['index.html','src','locales'])await cp(new URL(entry,root),new URL(entry,output),{recursive:true});
const pkg=JSON.parse(await readFile(new URL('package.json',root),'utf8'));
console.log(`Built Lane Split Rush with Three.js ${pkg.dependencies.three} in dist/ (all assets local).`);
// All shipped files are conservatively counted as initial content, even lazy modules.
// https://developers.google.com/youtube/gaming/playables/certification/requirements_stability
let total=0,compressed=0,count=0,largest=0;
async function audit(dir){
  for(const entry of await readdir(dir,{withFileTypes:true})){
    if(!/^[a-zA-Z0-9_.-]+$/.test(entry.name))throw new Error(`Unsupported Playables filename: ${entry.name}`);
    const url=new URL(entry.name+(entry.isDirectory()?'/':''),dir);
    if(entry.isDirectory()){await audit(url);continue;}
    const {size}=await stat(url);total+=size;largest=Math.max(largest,size);count++;
    compressed+=gzipSync(await readFile(url)).length;
    if(size>=30*1024**2)throw new Error(`File exceeds Playables 30 MiB limit: ${entry.name}`);
  }
}
await audit(output);
if(total>=250*1024**2||compressed>=30*1024**2||count>8000)throw new Error('Playables bundle budget exceeded');
console.log(`Bundle audit: ${count} files; raw ${(total/1024**2).toFixed(3)} MiB; gzip estimate ${(compressed/1024**2).toFixed(3)} MiB; largest ${(largest/1024**2).toFixed(3)} MiB. PASS`);
