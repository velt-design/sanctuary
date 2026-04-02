import ListPageSkeleton from '@/components/page-state/ListPageSkeleton';

export default function Loading() {
  return (
    <ListPageSkeleton
      title="Contacts"
      actionCount={2}
      filterFieldCount={1}
      columnCount={5}
      rowCount={6}
      filterTitle="Search"
      listTitle="All Contacts"
    />
  );
}
