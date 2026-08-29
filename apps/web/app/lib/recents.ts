export type RecentItemType = "Template" | "Session" | "Classroom";

export interface RecentItem {
  type: RecentItemType;
  name: string;
  href: string;
}

const RECENTS_KEY = "derit-lecturer-recents";
const RECENTS_UPDATED_EVENT = "derit-lecturer-recents-updated";

export function getRecentItems(): RecentItem[] {
  try {
    const stored = window.localStorage.getItem(RECENTS_KEY);
    const parsed = stored ? JSON.parse(stored) : null;
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function recordRecentItem(item: RecentItem) {
  const next = [
    item,
    ...getRecentItems().filter((recent) => recent.href !== item.href),
  ].slice(0, 6);

  try {
    window.localStorage.setItem(RECENTS_KEY, JSON.stringify(next));
    window.dispatchEvent(new Event(RECENTS_UPDATED_EVENT));
  } catch {
    // Recents are optional and should never block the page.
  }
}

export { RECENTS_UPDATED_EVENT };
