import {sizedThumbnailFixture} from '../apps/marketing/lib/creative-executor/donor-thumbnail.fixture';
import {serializeEffect} from '../apps/marketing/lib/creative-executor/intent';
import type {ExecutorState} from '../apps/marketing/lib/creative-executor/contract';
import {ownerFixture} from '../apps/marketing/lib/creative-executor/owner-fixture';
import {creativeWithPrimary} from '../apps/marketing/lib/creative-executor/creative-copy';
const f=ownerFixture(),thumbnailDonor=sizedThumbnailFixture();
const thumbnailIntent=serializeEffect(thumbnailDonor.plan,{objects:[],creativeReference:null} as unknown as ExecutorState,'create_creative');
process.stdout.write(JSON.stringify({...f,thumbnailDonor:{...thumbnailDonor,intent:thumbnailIntent},historical:ownerFixture(new Date(Date.now()-7*86400000).toISOString().slice(0,10)),expected:creativeWithPrimary(f.control,'999001',f.plan.challengerPrimary,f.edit)}));
