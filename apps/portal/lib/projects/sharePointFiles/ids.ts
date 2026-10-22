import { z } from 'zod';
export const graphId = z.string().min(1).max(240).regex(/^[a-zA-Z0-9_!.-]+$/);
