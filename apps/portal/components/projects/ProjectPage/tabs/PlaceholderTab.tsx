import legacy from '@/app/staff/projects/projects.module.css';

export default function PlaceholderTab({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className={legacy.note}>
      <strong>{title}:</strong> {description}
    </div>
  );
}
