export type PaginationItem = number | "ellipsis";

export function buildPaginationItems(
  currentPage: number,
  totalPages: number,
  siblingCount = 1
): PaginationItem[] {
  const total = Math.max(1, Math.floor(totalPages));
  const current = Math.min(total, Math.max(1, Math.floor(currentPage)));
  const siblings = Math.max(0, Math.floor(siblingCount));
  const pages = new Set<number>([1, total]);

  for (let page = current - siblings; page <= current + siblings; page += 1) {
    if (page >= 1 && page <= total) pages.add(page);
  }

  if (current <= siblings + 2) {
    for (let page = 1; page <= Math.min(total, 2 * siblings + 1); page += 1) pages.add(page);
  }

  if (current >= total - siblings - 1) {
    for (let page = Math.max(1, total - 2 * siblings); page <= total; page += 1) pages.add(page);
  }

  const sortedPages = [...pages].sort((a, b) => a - b);
  const items: PaginationItem[] = [];

  sortedPages.forEach((page, index) => {
    const previous = sortedPages[index - 1];
    if (previous && page - previous > 1) items.push("ellipsis");
    items.push(page);
  });

  return items;
}
