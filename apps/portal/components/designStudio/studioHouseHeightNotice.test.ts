import {expect,it} from 'vitest';
import {EMPTY_OBJECT_FIRST_WORKBENCH_DRAFT} from '@/lib/drawings/state/objectFirstWorkbenchModel';
import {applyStudioHouseEdit} from '@/lib/designStudio/houseEditing';
import {studioHouseScene} from '@/lib/designStudio/studioHouseScene';
import {studioHouseHeightNotice} from './studioHouseHeightNotice';
it('shows the actual default roof height after a wall-only change without changing either authored field',()=>{
 const added=applyStudioHouseEdit(structuredClone(EMPTY_OBJECT_FIRST_WORKBENCH_DRAFT),{kind:'add',id:'house'});if(!added.ok)throw Error(added.message);
 const house=studioHouseScene({},added.spatial)!.houses[0];house.wallHeightMm='3200';const before=JSON.stringify(house);
 expect(studioHouseHeightNotice(house)).toMatchObject({lowestRoofEdgeMm:2400});
 expect(studioHouseHeightNotice(house)!.text).toContain('wall is above');expect(JSON.stringify(house)).toBe(before);expect(house.eaveHeightMm).toBe('');
 house.eaveHeightMm='3600';expect(studioHouseHeightNotice(house)).toMatchObject({lowestRoofEdgeMm:3600});expect(studioHouseHeightNotice(house)!.text).not.toContain('wall is above');
});
