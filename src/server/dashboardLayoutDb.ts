import type { DashboardLayoutV1 } from "../types";
import {
  createDefaultLayout,
  mergePinnedIntoLayout,
  newGroupId,
  parseDashboardLayout,
} from "../lib/dashboardLayout";
import { getDb } from "./db";

export {
  createDefaultLayout,
  flattenLayoutSymbols,
  pruneLayoutSymbols,
  mergePinnedIntoLayout,
  removeSymbolFromLayout,
  addSymbolToLayout,
  newGroupId,
  DEFAULT_GROUP_COLOR,
} from "../lib/dashboardLayout";

export type {
  DashboardGroupV1,
  DashboardLayoutV1,
  DashboardSkin,
  DashboardSortMode,
} from "../types";

export function getDashboardLayout(
  pinnedFallback: string[] = []
): DashboardLayoutV1 {
  const row = getDb()
    .prepare("SELECT layout_json FROM dashboard_layout WHERE id = 1")
    .get() as { layout_json: string } | undefined;
  if (!row?.layout_json) {
    return createDefaultLayout(pinnedFallback);
  }
  try {
    const parsed = parseDashboardLayout(JSON.parse(row.layout_json));
    if (!parsed) return createDefaultLayout(pinnedFallback);
    return mergePinnedIntoLayout(parsed, pinnedFallback);
  } catch {
    return createDefaultLayout(pinnedFallback);
  }
}

export function saveDashboardLayout(layout: DashboardLayoutV1): void {
  const now = Date.now();
  getDb()
    .prepare(
      `INSERT INTO dashboard_layout (id, layout_json, updated_at)
       VALUES (1, ?, ?)
       ON CONFLICT(id) DO UPDATE SET layout_json = excluded.layout_json, updated_at = excluded.updated_at`
    )
    .run(JSON.stringify(layout), now);
}
