import 'server-only';
import {parseWebsiteSubmittedDesign,serializeWebsiteSubmittedDesign} from '@sp/configurator/website';
import {configuratorMarketingOrigin} from '@/lib/projects/configuratorRevisionNavigation';
import {isStudioObject,parseStudioAuthored,STUDIO_OUTPUT_KEY} from './contracts';
import {studioIdentifier} from './identifiers';
import {checkStudioWebsiteImportDesign,checkStudioWebsiteGableImportDesign} from './websiteImport';
import type {StudioWebsiteBrief} from './websiteBrief';

const labels:Record<string,string>={input:'Dimensions and site',roof:'Roof and options',widthMm:'Width (mm)',projectionMm:'Projection (mm)',level:'Site level',connection:'Requested house connection',attachmentIntent:'Attachment choice',family:'Roof style',orientation:'Ridge direction',infills:'Gable infills',finish:'Roof finish',material:'Roof material',layout:'Roof layout',acrylicBays:'Acrylic bays',profile:'Profile',trayWidth:'Tray width (mm)',ceiling:'Ceiling',species:'Timber species',coverWidthMm:'Cover width (mm)',blinds:'Blinds',sidePanels:'Side panels',roofBattens:'Roof battens',lighting:'Lighting',opening:'Opening',fabric:'Fabric',colour:'Colour',cover:'Cover',lowered:'Lowered in preview',infill:'Infill',kind:'Type',edge:'Edge',gap:'Gap',customGap:'Custom gap',frame:'Frame',battens:'Battens',direction:'Direction',strips:'LED strips',rafterCount:'Rafter lights',cedarCount:'Ceiling lights',rafterAmount:'Rafter lighting level',rafterLayout:'Rafter layout',cedarLayout:'Ceiling layout',cedarPerSection:'Lights per ceiling section',cedarIndividual:'Individual ceiling sections',cedarOverrides:'Ceiling section choices',cedarPattern:'Ceiling light pattern',count:'Count',pattern:'Pattern'};
const readable=(value:string)=>value.replaceAll('_',' ').replace(/([a-z])([A-Z])/g,'$1 $2');
function flatten(value:unknown,path:string[],rows:StudioWebsiteBrief['selections']) {
  if(Array.isArray(value)) {if(!value.length)rows.push({label:path.join(' · '),value:'None'});else value.forEach((item,index)=>flatten(item,[...path,String(index+1)],rows));return;}
  if(value!==null&&typeof value==='object') {for(const [key,item] of Object.entries(value))flatten(item,[...path,labels[key]??readable(key)],rows);return;}
  rows.push({label:path.join(' · '),value:value===null?'Not specified':typeof value==='boolean'?(value?'Yes':'No'):readable(String(value))});
}

/** Project only structurally validated customer selections; never trust stored
 * summaries, reopen URLs, contact details or commercial snapshots as UI content. */
export function projectStudioWebsiteBrief(raw:unknown):StudioWebsiteBrief|null {
  try {
    if(!isStudioObject(raw)||!isStudioObject(raw.outputs))return null;
    let source=raw;
    if(Object.hasOwn(raw.outputs,STUDIO_OUTPUT_KEY)) {
      const authored=parseStudioAuthored(raw.outputs[STUDIO_OUTPUT_KEY]);
      if(!authored.ok||authored.value.provenance.sourceKind!=='imported'||!isStudioObject(authored.value.provenance.sourcePayload))return null;
      source=authored.value.provenance.sourcePayload;
      if(source.project_id!==raw.project_id||typeof source.id!=='string'||studioIdentifier(source.id,'est').appId!==studioIdentifier(authored.value.provenance.sourceEstimateId??'','est').appId)return null;
    }
    const outputs=isStudioObject(source.outputs)?source.outputs:null;
    const snapshot=outputs&&isStudioObject(outputs.snapshot)?outputs.snapshot:null;
    const brief=snapshot&&isStudioObject(snapshot.customerBrief)?snapshot.customerBrief:null;
    if(!brief||brief.version!==1||typeof brief.audience!=='string'||typeof brief.designStatus!=='string'||!['residential','commercial','professional'].includes(brief.audience)||!['configured','bespoke','help'].includes(brief.designStatus))return null;
    const parsed=parseWebsiteSubmittedDesign(brief.design);
    if(!parsed.ok)return null;
    const design=parsed.value;
    const sourceEstimateId=studioIdentifier(String(source.id),'est').appId;
    const url=new URL('/configurator-preview?open=1',configuratorMarketingOrigin());
    url.hash=`design=${serializeWebsiteSubmittedDesign(design)}`;
    const selections:StudioWebsiteBrief['selections']=[{label:'Website audience',value:readable(String(brief.audience))},{label:'Requested help',value:readable(String(brief.designStatus))}];
    flatten(design.input,['Dimensions and site'],selections);flatten(design.roof,['Roof and options'],selections);
    if (design.roof.attachmentIntent === undefined) {
      selections.push({label:'Roof and options · Attachment choice',value:'Attached (website default; needs site confirmation)'});
    }
    for (const selection of selections) {
      if (selection.label === 'Dimensions and site · Requested house connection') {
        selection.label = design.roof.attachmentIntent === 'freestanding'
          ? 'Saved house connection choice (unused for freestanding)'
          : 'Requested house connection (preference; not site-confirmed)';
      }
      if (design.roof.attachmentIntent === 'unsure' && selection.label === 'Roof and options · Attachment choice') selection.value = 'Undecided (needs site confirmation)';
      if (design.roof.family === 'mono' && selection.label === 'Roof and options · Ridge direction') selection.label = 'Saved ridge direction (unused for pitched roof)';
      if (design.roof.family === 'gable' && selection.label === 'Roof and options · Ridge direction') selection.value = design.roof.orientation === 'parallel' ? 'Across the width' : 'Along the projection';
    }
    const supported=design.roof.family === 'gable' ? checkStudioWebsiteGableImportDesign(design) : checkStudioWebsiteImportDesign(design);
    const reason = supported.ok ? null : design.roof.attachmentIntent === undefined
      ? 'The website design uses the attached default. Confirm the site and house connection before preparing an attached Studio design. Attached website import is not available yet.'
      : design.roof.attachmentIntent === 'unsure'
        ? 'The attachment choice is undecided. Confirm the site and intended connection before preparing a Studio design. This website import is not available yet.'
        : supported.message;
    return {schemaVersion:'studio_website_brief.v1',sourceEstimateId,
      dimensionsMm:{widthMm:design.input.widthMm,projectionMm:design.input.projectionMm},
      summary:`${design.roof.family==='mono'?'Pitched':design.roof.family==='gable'?'Gable':'Box perimeter'} pergola · ${design.input.widthMm/1000} × ${design.input.projectionMm/1000} m`,
      selections,reopenUrl:url.href,importable:supported.ok,...(supported.ok ? {importFamily:design.roof.family as 'mono'|'gable'} : {}),reason};
  } catch {return null;}
}
