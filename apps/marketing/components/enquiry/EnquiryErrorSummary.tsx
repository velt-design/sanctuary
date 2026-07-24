'use client';

import { forwardRef } from 'react';

type EnquiryErrorSummaryItem = {
  field: string;
  message: string;
  targetId: string;
};

type EnquiryErrorSummaryProps = {
  className: string;
  heading?: string;
  id: string;
  items: EnquiryErrorSummaryItem[];
};

const EnquiryErrorSummary = forwardRef<HTMLDivElement, EnquiryErrorSummaryProps>(
  function EnquiryErrorSummary(
    {
      className,
      heading = 'Check the highlighted fields.',
      id,
      items,
    },
    ref,
  ) {
    if (!items.length) return null;

    return (
      <div
        aria-labelledby={`${id}-title`}
        className={className}
        id={id}
        ref={ref}
        role="alert"
        tabIndex={-1}
      >
        <h3 id={`${id}-title`}>{heading}</h3>
        <ul>
          {items.map((item) => (
            <li key={item.field}>
              <a
                href={`#${item.targetId}`}
                onClick={(event) => {
                  event.preventDefault();
                  document.getElementById(item.targetId)?.focus();
                }}
              >
                {item.message}
              </a>
            </li>
          ))}
        </ul>
      </div>
    );
  },
);

export default EnquiryErrorSummary;
