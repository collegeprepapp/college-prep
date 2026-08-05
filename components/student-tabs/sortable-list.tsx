'use client'

import { useEffect, useState } from 'react'
import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical } from 'lucide-react'

/**
 * Reorderable list shared by the Activities and Honors tabs.
 *
 * Dragging is bound to an explicit grip handle rather than the whole row,
 * because the rows are also click-to-expand — listeners on the row would
 * swallow the click and make editing unreachable by mouse.
 *
 * A KeyboardSensor is included so the list can be reordered without a pointer:
 * focus a handle, space to lift, arrows to move, space to drop.
 *
 * Reordering is optimistic. The new order is shown immediately and the server
 * action runs after; if it fails the previous order is put back and the caller
 * surfaces the error, so the list never quietly disagrees with the database.
 */
export function SortableList<T extends { id: string }>({
  items,
  onReorder,
  cutoffAfter,
  cutoffLabel,
  renderItem,
}: {
  items: T[]
  /** Resolves false to roll the optimistic order back. */
  onReorder: (orderedIds: string[]) => Promise<boolean>
  /** Draw a divider after this many items (the Common App cap). */
  cutoffAfter?: number
  cutoffLabel?: string
  renderItem: (item: T, index: number, handle: React.ReactNode) => React.ReactNode
}) {
  const [order, setOrder] = useState(items)

  // Re-sync when the server sends a different sequence. Keyed on the id
  // sequence rather than the array identity, which changes every render.
  const signature = items.map((item) => item.id).join(',')

  useEffect(() => {
    setOrder(items)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature])

  const sensors = useSensors(
    useSensor(PointerSensor, {
      // A few pixels of travel before a drag starts, so a click on the handle
      // is still a click.
      activationConstraint: { distance: 4 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event

    if (!over || active.id === over.id) {
      return
    }

    const from = order.findIndex((item) => item.id === active.id)
    const to = order.findIndex((item) => item.id === over.id)

    if (from === -1 || to === -1) {
      return
    }

    const previous = order
    const next = arrayMove(order, from, to)

    setOrder(next)

    const ok = await onReorder(next.map((item) => item.id))

    if (!ok) {
      setOrder(previous)
    }
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <SortableContext
        items={order.map((item) => item.id)}
        strategy={verticalListSortingStrategy}
      >
        <ul className="flex flex-col gap-2">
          {order.map((item, index) => (
            <SortableRow key={item.id} id={item.id}>
              {(handle) => (
                <>
                  {renderItem(item, index, handle)}

                  {cutoffAfter !== undefined &&
                    index === cutoffAfter - 1 &&
                    order.length > cutoffAfter && (
                      <li
                        aria-hidden="true"
                        className="my-1 flex items-center gap-3 text-xs opacity-60"
                      >
                        <span className="h-px flex-1 bg-black/20 dark:bg-white/25" />
                        {cutoffLabel ?? `Top ${cutoffAfter}`}
                        <span className="h-px flex-1 bg-black/20 dark:bg-white/25" />
                      </li>
                    )}
                </>
              )}
            </SortableRow>
          ))}
        </ul>
      </SortableContext>
    </DndContext>
  )
}

function SortableRow({
  id,
  children,
}: {
  id: string
  children: (handle: React.ReactNode) => React.ReactNode
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id })

  const handle = (
    <button
      type="button"
      ref={setNodeRef}
      aria-label="Reorder — hold space, then use arrow keys"
      className="cursor-grab touch-none rounded p-1 opacity-50 hover:opacity-100 active:cursor-grabbing"
      {...attributes}
      {...listeners}
    >
      <GripVertical aria-hidden="true" className="size-4" />
    </button>
  )

  return (
    <div
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.6 : undefined,
      }}
    >
      {children(handle)}
    </div>
  )
}
