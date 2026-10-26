import fs from 'node:fs/promises';
import {FileBlob,PresentationFile} from '@oai/artifact-tool';
const p=await PresentationFile.importPptx(await FileBlob.load('/Users/ngwenjing/huawei-2026/SafeSpace_Tech4City_2026.pptx'));
console.log((await p.inspect({kind:'slide,layout',maxChars:3000})).ndjson);
for (const n of [13,15]) {
 const s=p.slides.items[n];
 console.log('SLIDE',n+1,s.id);
 console.log(s.shapes.items.map(x=>({id:x.id,text:x.text.toString(),position:x.position}))); 
 await fs.writeFile(`/Users/ngwenjing/huawei-2026/.codex-build/implementation-slides/reference-${n+1}.png`,new Uint8Array(await (await p.export({slide:s,format:'png',scale:1})).arrayBuffer()));
}
