import React from "react";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCorners,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { useDroppable } from "@dnd-kit/core";
import { ChevronDown, ChevronRight, GripVertical } from "lucide-react";
import type { Asset, DashboardLayoutV1 } from "../../types";
import DashboardAssetCard from "./DashboardAssetCard";

function GroupSection({
  groupId,
  name,
  color,
  collapsed,
  editMode,
  onToggleCollapse,
  onRename,
  children,
}: {
  groupId: string;
  name: string;
  color: string;
  collapsed: boolean;
  editMode: boolean;
  onToggleCollapse: () => void;
  onRename: (name: string) => void;
  children: React.ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `group:${groupId}` });

  return (
    <section ref={setNodeRef} className="space-y-3">
      <div
        className="flex items-center gap-2 px-3 py-2 rounded-xl border transition-colors"
        style={{
          backgroundColor: `${color}14`,
          borderColor: isOver ? color : `${color}55`,
        }}
      >
        {editMode && (
          <span className="text-[#86868B] cursor-grab touch-none">
            <GripVertical size={14} />
          </span>
        )}
        <button
          type="button"
          onClick={onToggleCollapse}
          className="p-0.5 text-[#86868B] cursor-pointer"
        >
          {collapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
        </button>
        <span
          className="w-2.5 h-2.5 rounded-full shrink-0"
          style={{ backgroundColor: color }}
        />
        {editMode ? (
          <input
            type="text"
            value={name}
            onChange={(e) => onRename(e.target.value)}
            className="flex-1 text-xs font-bold bg-white/80 border border-[#E5E8EB] rounded-lg px-2 py-1 min-w-0"
          />
        ) : (
          <span className="text-xs font-bold text-[#1D1D1F]">{name}</span>
        )}
      </div>
      {!collapsed && children}
    </section>
  );
}

interface DashboardWatchlistProps {
  layout: DashboardLayoutV1;
  assets: Record<string, Asset>;
  selectedKey: string;
  capturingKeys: Set<string>;
  editMode: boolean;
  onSelectAsset: (key: string) => void;
  onLayoutChange: (layout: DashboardLayoutV1) => void;
}

export default function DashboardWatchlist({
  layout,
  assets,
  selectedKey,
  capturingKeys,
  editMode,
  onSelectAsset,
  onLayoutChange,
}: DashboardWatchlistProps) {
  const [activeId, setActiveId] = React.useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const findGroupIndex = (symbol: string) =>
    layout.groups.findIndex((g) =>
      g.symbols.some((s) => s.toUpperCase() === symbol.toUpperCase())
    );

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(String(event.active.id));
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event;
    if (!over || !editMode) return;

    const activeSymbol = String(active.id);
    const overId = String(over.id);

    let overGroupId: string | null = null;
    if (overId.startsWith("group:")) {
      overGroupId = overId.replace("group:", "");
    } else {
      const gi = findGroupIndex(overId);
      if (gi >= 0) overGroupId = layout.groups[gi].id;
    }
    if (!overGroupId) return;

    const activeGroupIndex = findGroupIndex(activeSymbol);
    const overGroupIndex = layout.groups.findIndex((g) => g.id === overGroupId);
    if (activeGroupIndex < 0 || overGroupIndex < 0) return;
    if (activeGroupIndex === overGroupIndex) return;

    const next = layout.groups.map((g) => ({
      ...g,
      symbols: [...g.symbols],
    }));
    const from = next[activeGroupIndex];
    const to = next[overGroupIndex];
    const symIndex = from.symbols.findIndex(
      (s) => s.toUpperCase() === activeSymbol.toUpperCase()
    );
    if (symIndex < 0) return;
    const [sym] = from.symbols.splice(symIndex, 1);
    to.symbols.push(sym);
    onLayoutChange({ ...layout, groups: next, sortMode: "manual" });
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);
    if (!over || !editMode) return;

    const activeSymbol = String(active.id);
    const overId = String(over.id);

    if (overId.startsWith("group:")) {
      return;
    }

    const activeGroupIndex = findGroupIndex(activeSymbol);
    const overGroupIndex = findGroupIndex(overId);
    if (activeGroupIndex < 0) return;

    const next = layout.groups.map((g) => ({
      ...g,
      symbols: [...g.symbols],
    }));

    if (overGroupIndex >= 0 && activeGroupIndex === overGroupIndex) {
      const group = next[activeGroupIndex];
      const oldIndex = group.symbols.findIndex(
        (s) => s.toUpperCase() === activeSymbol.toUpperCase()
      );
      const newIndex = group.symbols.findIndex(
        (s) => s.toUpperCase() === overId.toUpperCase()
      );
      if (oldIndex >= 0 && newIndex >= 0 && oldIndex !== newIndex) {
        group.symbols = arrayMove(group.symbols, oldIndex, newIndex);
        onLayoutChange({ ...layout, groups: next, sortMode: "manual" });
      }
    }
  };

  const gridClass =
    layout.skin === "compact"
      ? "flex flex-col gap-2"
      : layout.skin === "minimal"
        ? "grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3"
        : layout.skin === "branded"
          ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5"
          : "grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4";

  const activeAsset = activeId ? assets[activeId] : null;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      <div data-skin={layout.skin} className="space-y-6 animate-fade-in">
        {layout.groups.map((group) => (
          <div key={group.id}>
          <GroupSection
            groupId={group.id}
            name={group.name}
            color={group.color}
            collapsed={!!group.collapsed}
            editMode={editMode}
            onToggleCollapse={() => {
              onLayoutChange({
                ...layout,
                groups: layout.groups.map((g) =>
                  g.id === group.id ? { ...g, collapsed: !g.collapsed } : g
                ),
              });
            }}
            onRename={(name) => {
              onLayoutChange({
                ...layout,
                groups: layout.groups.map((g) =>
                  g.id === group.id ? { ...g, name } : g
                ),
              });
            }}
          >
            <SortableContext
              items={group.symbols}
              strategy={verticalListSortingStrategy}
            >
              <div className={gridClass}>
                {group.symbols.map((sym) => {
                  const asset = assets[sym];
                  if (!asset) return null;
                  return (
                    <div key={sym}>
                    <DashboardAssetCard
                      symbol={sym}
                      asset={asset}
                      skin={layout.skin}
                      accentColor={layout.symbolAccents[sym.toUpperCase()]}
                      isSelected={selectedKey === sym}
                      isCapturing={capturingKeys.has(sym)}
                      editMode={editMode}
                      onSelect={() => onSelectAsset(sym)}
                    />
                    </div>
                  );
                })}
              </div>
            </SortableContext>
          </GroupSection>
          </div>
        ))}
      </div>

      <DragOverlay>
        {activeId && activeAsset ? (
          <div className="opacity-90 shadow-xl max-w-xs pointer-events-none">
            <DashboardAssetCard
              symbol={activeId}
              asset={activeAsset}
              skin={layout.skin}
              accentColor={layout.symbolAccents[activeId.toUpperCase()]}
              isSelected={false}
              isCapturing={false}
              editMode={false}
              onSelect={() => {}}
            />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
