import fs from 'node:fs';

// Interface-only rebuilds reuse a still-valid published snapshot. The normal
// scheduled workflow continues to read Feishu and renew all media links.
const response = await fetch('https://seasnakes.github.io/gloria-prompt-archive/data/catalog.json', {cache:'no-store'});
if (!response.ok) throw new Error('Published catalog unavailable');
const catalog = await response.json();
if (catalog.schemaVersion !== 1 || !Array.isArray(catalog.items) || catalog.count !== catalog.items.length || !catalog.count) throw new Error('Incomplete published catalog');
if (Date.parse(catalog.mediaExpiresAt) < Date.now() + 2 * 60 * 60 * 1000) throw new Error('Published media links need a full refresh');
const patches = JSON.parse(process.env.CATALOG_MEDIA_PATCH || '[]');
if (!Array.isArray(patches) || patches.length > 20) throw new Error('Invalid media patch');
for (const patch of patches) {
  const item = catalog.items.find(item => item.id === patch.id);
  const hasEvidenceCover=item?.imageCaptions?.every(caption=>caption==='提示词出处截图');
  if (!item || item.video || (item.cover&&!hasEvidenceCover) || !Array.isArray(patch.images) || !patch.images.length || patch.images.length > 20) throw new Error('Only missing image covers or misplaced evidence covers can be repaired');
  if (patch.generatedCover !== true || !Array.isArray(patch.imageCaptions) || patch.imageCaptions.length !== patch.images.length || patch.imageCaptions.some(caption => caption !== '本站补图 · 按收录提示词生成，非原作者原图')) throw new Error('Generated cover provenance is required');
  if(!Array.isArray(patch.sourceImages)||patch.sourceImages.length>20)throw new Error('Invalid source evidence');
  for (const image of [...patch.images,...patch.sourceImages]) { const url = new URL(image); if (url.protocol !== 'https:' || !url.hostname.endsWith('.feishu.cn') || url.username || url.password) throw new Error('Only Feishu attachment links are accepted'); }
  item.cover = patch.images[0]; item.images = patch.images; item.imageCaptions = patch.imageCaptions;
  item.generatedCover=true;item.sourceImages=patch.sourceImages;
  if(typeof patch.parameters!=='string'||patch.parameters.length>10000)throw new Error('Invalid generated media metadata');
  item.parameters=patch.parameters;
  const match=/本站补图实测：(\d+)×(\d+)/.exec(patch.parameters);if(!match)throw new Error('Generated cover dimensions missing');
  item.width=Number(match[1]);item.height=Number(match[2]);item.aspectKnown=true;
}
fs.mkdirSync('public/data',{recursive:true});
fs.writeFileSync('public/data/catalog.json',JSON.stringify(catalog)+'\n');
fs.writeFileSync('public/data/work-ids.json',JSON.stringify({updatedAt:catalog.updatedAt,ids:catalog.items.map(item=>item.id)})+'\n');
console.log(`Rebuilt ${catalog.count} works; repaired ${patches.length} missing covers.`);
