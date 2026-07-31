const WORK_QUEUE_PAGE_SIZE = 100;

export function workQueueTotalPages(
  entryCount: number,
  pageSize = WORK_QUEUE_PAGE_SIZE,
): number {
  return Math.max(1, Math.ceil(Math.max(0, entryCount) / pageSize));
}

export function clampWorkQueuePage(
  page: number,
  entryCount: number,
  pageSize = WORK_QUEUE_PAGE_SIZE,
): number {
  return Math.min(
    workQueueTotalPages(entryCount, pageSize),
    Math.max(1, Math.trunc(page) || 1),
  );
}

export function paginateWorkQueueEntries<T>(
  entries: readonly T[],
  page: number,
  pageSize = WORK_QUEUE_PAGE_SIZE,
): {
  entries: T[];
  page: number;
  totalPages: number;
  rangeStart: number;
  rangeEnd: number;
} {
  const totalPages = workQueueTotalPages(entries.length, pageSize);
  const currentPage = clampWorkQueuePage(page, entries.length, pageSize);
  const offset = (currentPage - 1) * pageSize;
  const visible = entries.slice(offset, offset + pageSize);
  return {
    entries: visible,
    page: currentPage,
    totalPages,
    rangeStart: entries.length ? offset + 1 : 0,
    rangeEnd: offset + visible.length,
  };
}
