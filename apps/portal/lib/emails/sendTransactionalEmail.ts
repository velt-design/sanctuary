import { Resend } from 'resend';

let resendClient: Resend | null = null;

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (typeof value === 'string' && value.trim()) return value.trim();
  throw new Error(`Missing env var: ${name}`);
}

function parseEmailList(value: string | undefined, fallback: string): string[] {
  const source = (value ?? fallback).trim();
  if (!source) return [];
  return source
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function mergeEmailLists(...lists: Array<string[] | undefined>): string[] {
  const out: string[] = [];
  const seen = new Set<string>();

  for (const list of lists) {
    for (const raw of list ?? []) {
      const email = raw.trim();
      if (!email) continue;
      const key = email.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(email);
    }
  }

  return out;
}

function getResendClient(): Resend {
  const key = requiredEnv('RESEND_API_KEY');
  if (!resendClient) resendClient = new Resend(key);
  return resendClient;
}

const EMAIL_FROM = process.env.EMAIL_FROM ?? 'Sanctuary Pergolas <info@sanctuarypergolas.co.nz>';
const EMAIL_REPLY_TO = process.env.EMAIL_REPLY_TO ?? 'info@sanctuarypergolas.co.nz';
const DEFAULT_BCC = parseEmailList(process.env.EMAIL_BCC, 'info@sanctuarypergolas.co.nz');

export async function sendTransactionalEmail(args: {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  cc?: string[];
  bcc?: string[];
  attachments?: Array<{ filename: string; content: Buffer; contentType?: string }>;
}) {
  const client = getResendClient();

  const to = Array.isArray(args.to) ? args.to.map((v) => v.trim()).filter(Boolean) : [args.to.trim()].filter(Boolean);
  if (!to.length) throw new Error('Transactional email requires at least one recipient.');

  const cc = mergeEmailLists(args.cc);
  const bcc = mergeEmailLists(DEFAULT_BCC, args.bcc);

  const response = await client.emails.send({
    from: EMAIL_FROM,
    to,
    cc: cc.length ? cc : undefined,
    bcc: bcc.length ? bcc : undefined,
    replyTo: EMAIL_REPLY_TO,
    subject: args.subject,
    html: args.html,
    ...(args.text ? { text: args.text } : {}),
    ...(args.attachments?.length ? { attachments: args.attachments } : {}),
  });

  if ('error' in response && response.error) {
    throw new Error(response.error.message ?? 'Failed to send email');
  }

  return response;
}
