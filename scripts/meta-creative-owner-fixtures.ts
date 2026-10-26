import {ownerFixture} from '../apps/marketing/lib/creative-executor/owner-fixture';
import {creativeWithPrimary} from '../apps/marketing/lib/creative-executor/creative-copy';
const f=ownerFixture();
process.stdout.write(JSON.stringify({...f,historical:ownerFixture(new Date(Date.now()-7*86400000).toISOString().slice(0,10)),expected:creativeWithPrimary(f.control,'999001',f.plan.challengerPrimary,f.edit)}));
