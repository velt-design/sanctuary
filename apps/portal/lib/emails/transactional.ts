import { renderTemplate } from '@/lib/emails/renderTemplate';
import { sendTransactionalEmail } from '@/lib/emails/sendTransactionalEmail';

export async function sendDesignConsultationBookedEmail(input: {
  to: string;
  name: string;
  consultation_date: string;
  consultation_time: string;
  consultation_duration: string;
  consultation_timezone?: string;
  site_address?: string;
  calendar_link?: string;
  rep_name?: string;
  reference_id?: string;
}) {
  const { html, text } = await renderTemplate('design-consultation-booked', input);

  return sendTransactionalEmail({
    to: input.to,
    subject: `Design consultation booked - ${input.consultation_date}`,
    html,
    text,
  });
}

export async function sendProjectScheduledEmail(input: {
  to: string;
  name: string;
  site_address: string;
  scheduled_start_date: string;
  estimated_install_window: string;
  estimated_completion_date?: string;
  prep_note?: string;
  reference_id?: string;
}) {
  const { html, text } = await renderTemplate('project-scheduled', input);

  return sendTransactionalEmail({
    to: input.to,
    subject: `Your project is scheduled - ${input.scheduled_start_date}`,
    html,
    text,
  });
}

export async function sendProjectCompletedEmail(input: {
  to: string;
  name: string;
  site_address?: string;
  completion_date: string;
  care_item_1: string;
  care_item_2: string;
  care_item_3: string;
  warranty_link?: string;
  final_invoice_link?: string;
  review_link?: string;
  reference_id?: string;
}) {
  const { html, text } = await renderTemplate('project-completed', input);

  return sendTransactionalEmail({
    to: input.to,
    subject: 'Your pergola is complete',
    html,
    text,
  });
}
