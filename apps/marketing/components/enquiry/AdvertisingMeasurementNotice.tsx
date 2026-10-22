import Link from 'next/link';

/** All enquiry layouts display the notice bundled with advertisingDisclosure.ts. */
export default function AdvertisingMeasurementNotice({ className, configured = false }: { className?: string; configured?: boolean }) {
  return <p className={className}>
    {configured ? 'Your design is included. ' : 'We use your details and files to assess and respond. They are not published. '}
    With marketing tracking enabled, we also measure enquiries and sales with Google Ads and Meta.{' '}
    <Link href="/privacy#advertising-measurement" target="_blank" rel="noopener noreferrer">Privacy policy and choices (opens in a new tab)</Link>
  </p>;
}
