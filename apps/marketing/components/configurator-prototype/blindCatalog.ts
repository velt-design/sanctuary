// Shade Elements' Ziptrak-compatible collection, reviewed September 2026.
// Swatches are illustrative screen colours; names are the selection of record.
export const BLIND_FABRICS = [
  { id:'classic', name:'Shadeview Classic', detail:'10% openness', openness:10, colours:'Beige|Black|Chocolate|Desert|Dusk|Slate|Snowcap|Wheat' },
  { id:'urban', name:'Shadeview Urban', detail:'5% openness', openness:5, colours:'Almond|Bracken|Carbon|Flint|Galaxy|Graphite|Havana|Iceberg|Marble|Mushroom|Pewter|Putty|Quartz|Static|Stone|Suede' },
  { id:'extreme', name:'Shadeview Extreme', detail:'3% openness', openness:3, colours:'Alpaca|Ash|Earth|Emerald|Black|Pebble Stone|Sapphire' },
  { id:'one', name:'Shadeview One', detail:'1% openness', openness:1, colours:'Boulder|Coal Dust|Gunmetal|Limestone|Midnight' },
  { id:'horizon', name:'Soltis Horizon 86', detail:'Solar mesh', openness:14, colours:'Pepper|Bronze|White|Beaten Metal|Alu/Oat|Anthracite|Alu/Alu|Alu/White|Black|Sandy Beige|Concrete|Boulder|Champagne' },
  { id:'lounge', name:'Soltis Lounge 96', detail:'Solar mesh', openness:4, colours:'Off White|Bronze|Anthracite|Sandy Beige|Midnight Blue|Boulder|Caramel|Cloud|Shea|Platinum|Aureolin|Citrus|Acapulco|Lime|Jungle|Taupe|Atlantis|White|Red|Black|Vanilla' },
  { id:'pvc', name:'PVC', detail:'Clear or tinted', openness:100, colours:'Clear|Tinted' },
] as const;
export const BLIND_COVERS = [{id:'NONE',name:'Uncovered'},{id:'FLASHING',name:'Outward flashing'},{id:'PELMET',name:'Flashing + inside pelmet'}] as const;
export type PreviewBlind = { opening:string; fabric:string; colour:string; cover:'NONE'|'FLASHING'|'PELMET'; lowered:number; infill:boolean };
export const defaultBlind = (opening:string):PreviewBlind => ({opening,fabric:'urban',colour:'Carbon',cover:'PELMET',lowered:100,infill:true});
export const blindFabric = (blind:PreviewBlind) => BLIND_FABRICS.find(f=>f.id===blind.fabric)!;
export function blindColour(name:string) {
  if (/black|carbon|anthracite|midnight|coal|galaxy/i.test(name)) return '#363b3a';
  if (/white|snow|iceberg|vanilla|cloud|marble/i.test(name)) return '#d9d8cf';
  if (/emerald|jungle|lime/i.test(name)) return '#75825c';
  if (/blue|sapphire|atlantis|acapulco/i.test(name)) return '#59777c';
  if (/red/i.test(name)) return '#984c43';
  if (/citrus|aureolin/i.test(name)) return '#c5b764';
  if (/bronze|chocolate|earth|havana|bracken/i.test(name)) return '#6a5b4b';
  if (/slate|graphite|metal|gunmetal|pewter|flint|ash|static/i.test(name)) return '#7d827e';
  return '#aaa28e';
}
export function parseBlinds(value:unknown):PreviewBlind[]|null {
  if (!Array.isArray(value) || value.length>16) return null;
  const seen=new Set<string>(), result:PreviewBlind[]=[];
  for(const item of value) {
    if(!item || typeof item!=='object') return null;
    const {opening,fabric,colour,cover,lowered,infill}=item;
    const range=BLIND_FABRICS.find(f=>f.id===fabric);
    if(typeof opening!=='string' || !/^(front|left|right)-[1-9]of[1-9]$/.test(opening) || seen.has(opening)
      || !range || !range.colours.split('|').includes(colour) || !BLIND_COVERS.some(c=>c.id===cover)
      || !Number.isInteger(lowered) || lowered<0 || lowered>100 || typeof infill!=='boolean') return null;
    seen.add(opening);result.push({opening,fabric,colour,cover,lowered,infill});
  }
  return result;
}
export function describeBlinds(blinds:PreviewBlind[] = []) {
  return blinds.map(b=>{const [side,bay]=b.opening.split('-');const label=side[0].toUpperCase()+side.slice(1)+' '+bay.split('of')[0];
    return `Ziptrak ${label}: ${blindFabric(b).name}, ${b.colour}, ${BLIND_COVERS.find(c=>c.id===b.cover)!.name}, ${b.infill?'acrylic above where required':'open above'}, under-beam mounting`;}).join('; ');
}
