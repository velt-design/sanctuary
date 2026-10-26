import {sizedThumbnailFixture} from '../apps/marketing/lib/creative-executor/donor-thumbnail.fixture';
import {serializeEffect} from '../apps/marketing/lib/creative-executor/intent';
import {canonicalHash,creativeAssetHash,executionPlanSchema,ownerProposalSchema,type ExecutorState} from '../apps/marketing/lib/creative-executor/contract';
import {applyReviewedMedia} from '../apps/marketing/lib/creative-executor/owner-review';
import {ownerFixture} from '../apps/marketing/lib/creative-executor/owner-fixture';
import {creativeWithPrimary} from '../apps/marketing/lib/creative-executor/creative-copy';
const f=ownerFixture(),thumbnailDonor=sizedThumbnailFixture();
const thumbnailIntent=serializeEffect(thumbnailDonor.plan,{objects:[],creativeReference:null} as unknown as ExecutorState,'create_creative');
// Quote-rich, bounded synthetic metadata exercises JSONB and serialized intent
// overhead near the admitted capacity, rather than only a smaller donor slice.
const upperControl=structuredClone(thumbnailDonor.control);
Object.assign(upperControl.payload,{interactive_components_spec:{synthetic_a:'"'.repeat(900),synthetic_b:'"'.repeat(900)}});
const upperReview={...thumbnailDonor.plan.ownerReview!,payloadHash:canonicalHash(applyReviewedMedia(upperControl,thumbnailDonor.proposal.primary,thumbnailDonor.edit))};
const upperPlan=executionPlanSchema.parse({...thumbnailDonor.plan,control:upperControl,approvedAssetHash:creativeAssetHash(upperControl),approvalHash:canonicalHash(upperReview),ownerReview:upperReview});
const upperEnvelope=ownerProposalSchema.parse({...thumbnailDonor.envelope,plan:upperPlan,planHash:canonicalHash(upperPlan)});
const upperIntent=serializeEffect(upperPlan,{objects:[],creativeReference:null} as unknown as ExecutorState,'create_creative');
process.stdout.write(JSON.stringify({...f,thumbnailDonor:{...thumbnailDonor,intent:thumbnailIntent},upperBoundOwner:{plan:upperPlan,envelope:upperEnvelope,intent:upperIntent},historical:ownerFixture(new Date(Date.now()-7*86400000).toISOString().slice(0,10)),expected:creativeWithPrimary(f.control,'999001',f.plan.challengerPrimary,f.edit)}));
