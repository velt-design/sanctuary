import { ga4CredentialTransfer } from '../../../../../lib/marketingIntegrations/ga4/credential-transfer';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 70;
export const POST = (request: Request) => ga4CredentialTransfer(request);
