import { apiUrl } from "../lib/api";

export function journalMediaUrl(
  entryId: number,
  localPath: string
): string {
  const filename = localPath.split("/").pop() ?? localPath;
  return apiUrl(`/api/journal/media/${entryId}/${filename}`);
}
