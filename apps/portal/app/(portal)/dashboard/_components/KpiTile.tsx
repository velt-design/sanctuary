import Link from 'next/link';
import dash from '../dashboard.module.css';

export default function KpiTile({
  label,
  value,
  href,
  helperText,
}: {
  label: string;
  value: number;
  href?: string;
  helperText?: string;
}) {
  const content = (
    <>
      <div className={dash.kpiLabel}>{label}</div>
      <div className={`${dash.kpiValue} ${value === 0 ? dash.kpiValueZero : ''}`}>{value}</div>
      {helperText ? <div className={dash.kpiHelper}>{helperText}</div> : null}
    </>
  );

  return href ? (
    <Link className={dash.kpiTile} href={href}>
      {content}
    </Link>
  ) : (
    <div className={dash.kpiTile}>{content}</div>
  );
}
