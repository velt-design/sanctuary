import type {ConfiguratorPriceLine} from '../../lib/configuratorPublicPrice';
/** Presentation only: retain every supplied charge and never recalculate pricing. */
export function customerPriceBreakdown(lines:ConfiguratorPriceLine[],hasInfills=true):ConfiguratorPriceLine[]{
 const acrylic=lines.filter(line=>line.label==='Acrylic panels & infills'||line.label.endsWith(' · panel perimeter'));
 const canGroup=acrylic.some(line=>line.label==='Acrylic panels & infills');
 const result:ConfiguratorPriceLine[]=[];
 let added=false;
 for(const line of lines){
  if(canGroup&&acrylic.includes(line)){
   if(!added){result.push({label:hasInfills?'Acrylic panels, framing & infills':'Acrylic panels & framing',amountIncGst:acrylic.reduce((sum,item)=>sum+item.amountIncGst,0)});added=true;}
  }else result.push({...line,label:line.label.replace(/ · panel perimeter$/, ' · acrylic panel framing')});
 }
 return result;
}
