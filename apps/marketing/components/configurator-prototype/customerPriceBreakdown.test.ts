import {expect,it} from 'vitest';
import {customerPriceBreakdown} from './customerPriceBreakdown';
it('groups acrylic framing and sheets without losing or changing any charge',()=>{
 const lines=[{label:'Pergola, roof & ceiling',amountIncGst:14944},{label:'Right 1 · panel perimeter',amountIncGst:736},{label:'Front 2 · panel perimeter',amountIncGst:1108},{label:'Front 2 · timber battens',amountIncGst:2161},{label:'Front 1 · panel perimeter',amountIncGst:668},{label:'Front 1 · timber battens',amountIncGst:1676},{label:'Acrylic panels & infills',amountIncGst:9621}];
 const original=structuredClone(lines),result=customerPriceBreakdown(lines,false);
 expect(result).toHaveLength(4);
 expect(result[1]).toEqual({label:'Acrylic panels & framing',amountIncGst:12133});
 expect(result.reduce((sum,line)=>sum+line.amountIncGst,0)).toBe(30914);
 expect(lines).toEqual(original);
 expect(customerPriceBreakdown(lines,true)[1].label).toBe('Acrylic panels, framing & infills');
});
it('names a standalone frame accurately without implying it includes acrylic sheets',()=>{
 expect(customerPriceBreakdown([{label:'Right 1 · panel perimeter',amountIncGst:736}],false)).toEqual([{label:'Right 1 · acrylic panel framing',amountIncGst:736}]);
});
