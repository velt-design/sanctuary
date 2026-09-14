import 'server-only';

/** Enable only after compatible readers and all invoice migrations are deployed. */
export const invoiceDraftCreationEnabled = () => process.env.INVOICE_DRAFTS_ENABLED === 'true';
