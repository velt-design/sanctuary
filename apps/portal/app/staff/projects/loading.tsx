import ListPageSkeleton from '@/components/page-state/ListPageSkeleton';

export default function Loading() {
  return (
    <ListPageSkeleton
      title="Projects"
      actionCount={3}
      filterFieldCount={3}
      columnCount={7}
      rowCount={6}
      listTitle="All Projects"
    />
  );
}
