import {z} from 'zod';
import {hash,id,stamp} from './contract';
export const activationProofSchema=z.object({version:z.literal(1),planHash:hash,acceptance:z.uuid(),study:id,observedAt:stamp,preStateHash:hash,studyProofHash:hash,objectiveProofHash:hash,
 arms:z.array(z.object({arm:z.enum(['control','challenger']),ad:id,status:z.enum(['PAUSED','ACTIVE']),creative:id,start:z.number().int().positive(),end:z.number().int().positive(),trackingHash:hash}).strict()).length(2).refine(rows=>new Set(rows.map(r=>r.arm)).size===2&&new Set(rows.map(r=>r.ad)).size===2)}).strict();
