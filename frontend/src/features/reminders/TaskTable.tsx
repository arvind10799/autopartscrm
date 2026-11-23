"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { MoreHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils/cn";
import type { TaskItem } from "./task-workspace-api";
import { contextLabels } from "./task-workspace-api";

type Action = "complete" | "snooze" | "edit" | "cancel" | "delete" | "history";

export function TaskTable({
  items,
  zone,
  onDetails,
  onAction,
}: {
  items: TaskItem[];
  zone: string;
  onDetails: (row: TaskItem) => void;
  onAction: (row: TaskItem, action: Action) => void;
}) {
  const [menu, setMenu] = useState<{
    row: TaskItem;
    left: number;
    top: number;
  } | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement | null>(null);
  useEffect(() => {
    if (!menu) return;
    menuRef.current?.querySelector<HTMLButtonElement>("button")?.focus();
    const dismiss = (event: PointerEvent) => {
      if (
        !menuRef.current?.contains(event.target as Node) &&
        !trigger.current?.contains(event.target as Node)
      )
        setMenu(null);
    };
    const key = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMenu(null);
        trigger.current?.focus();
      }
    };
    const scroll = (event: Event) => {
      if (!menuRef.current?.contains(event.target as Node)) setMenu(null);
    };
    document.addEventListener("pointerdown", dismiss);
    document.addEventListener("keydown", key);
    window.addEventListener("scroll", scroll, true);
    window.addEventListener("resize", scroll);
    return () => {
      document.removeEventListener("pointerdown", dismiss);
      document.removeEventListener("keydown", key);
      window.removeEventListener("scroll", scroll, true);
      window.removeEventListener("resize", scroll);
    };
  }, [menu]);
  return (
    <>
      <div className="hidden overflow-x-auto md:block">
        <table className="crm-task-table w-full min-w-[960px] text-left text-sm">
          <thead>
            <tr>
              {[
                "Task details",
                "Linked record",
                "Assigned to",
                "Due date",
                "Priority",
                "Status",
                "Actions",
              ].map((title) => (
                <th key={title} scope="col">
                  {title}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {items.map((row) => {
              const finished = ["COMPLETED", "CANCELLED"].includes(row.status);
              const owner =
                row.owner?.name ??
                (row.ownerKind === "SHIPPING_QUEUE"
                  ? "Shipping queue"
                  : "Unassigned");
              const date = new Date(row.dueAt);
              return (
                <tr key={row.id}>
                  <td className="w-[31%]">
                    <div className="flex items-start gap-3">
                      <input
                        type="checkbox"
                        className="mt-1 h-4 w-4 shrink-0 accent-orange-600"
                        aria-label={`Complete ${row.title}`}
                        checked={row.status === "COMPLETED"}
                        disabled={!row.actions.complete || finished}
                        onChange={() => onAction(row, "complete")}
                      />
                      <div className="min-w-0">
                        <button
                          className="text-left font-semibold hover:underline"
                          onClick={() => onDetails(row)}
                        >
                          {row.title}
                        </button>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {[
                            row.context === "PERSONAL"
                              ? null
                              : row.record.vehicle || row.record.customerName,
                            contextLabels[row.context],
                          ]
                            .filter(Boolean)
                            .join(" · ")}
                        </p>
                        {row.received && (
                          <span className="text-xs text-orange-700 dark:text-orange-300">
                            Received handoff
                          </span>
                        )}
                      </div>
                    </div>
                  </td>
                  <td>
                    {row.record.href ? (
                      <Link
                        className="inline-block max-w-40 truncate rounded-md border border-border bg-secondary/50 px-2 py-1 text-xs font-medium hover:underline"
                        href={row.record.href}
                        title={row.record.reference}
                      >
                        {row.record.reference}
                      </Link>
                    ) : (
                      <span className="text-xs text-muted-foreground">
                        Personal task
                      </span>
                    )}
                  </td>
                  <td>
                    <div className="flex items-center gap-2">
                      <span
                        aria-hidden
                        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-secondary text-[10px] font-bold"
                      >
                        {owner
                          .split(/\s+/)
                          .slice(0, 2)
                          .map((part) => part[0])
                          .join("")}
                      </span>
                      <span className="max-w-28 truncate text-xs" title={owner}>
                        {owner}
                      </span>
                    </div>
                    {row.workingBy && (
                      <p className="mt-1 text-xs text-muted-foreground">
                        Working · {row.workingBy.name}
                      </p>
                    )}
                  </td>
                  <td className="whitespace-nowrap">
                    <span
                      className={cn(
                        "text-xs font-medium",
                        row.overdue &&
                          !finished &&
                          "text-orange-700 dark:text-orange-300",
                      )}
                    >
                      {date.toLocaleDateString("en-US", {
                        timeZone: zone,
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </span>
                    <span className="mt-1 block text-xs text-muted-foreground">
                      {date.toLocaleTimeString("en-US", {
                        timeZone: zone,
                        hour: "numeric",
                        minute: "2-digit",
                        timeZoneName: "short",
                      })}
                    </span>
                    {row.overdue && !finished && (
                      <span className="text-[10px] font-medium text-orange-700 dark:text-orange-300">
                        Overdue
                      </span>
                    )}
                  </td>
                  <td>
                    <span
                      className={cn(
                        "inline-flex items-center gap-1.5 whitespace-nowrap text-xs",
                        row.priority === "HIGH"
                          ? "text-orange-700 dark:text-orange-300"
                          : "text-muted-foreground",
                      )}
                    >
                      <span className="h-1.5 w-1.5 rounded-full bg-current" />
                      {row.priority.charAt(0) +
                        row.priority.slice(1).toLowerCase()}
                    </span>
                  </td>
                  <td>
                    <span className="inline-flex whitespace-nowrap rounded-md border border-border bg-secondary/50 px-2 py-1 text-xs">
                      {row.workingBy
                        ? "Working"
                        : row.status.charAt(0) +
                          row.status.slice(1).toLowerCase()}
                    </span>
                    {row.needsAdmin && (
                      <p className="mt-1 text-[10px] text-orange-700 dark:text-orange-300">
                        Needs admin
                      </p>
                    )}
                  </td>
                  <td>
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onDetails(row)}
                      >
                        View details
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        aria-label={`Actions for ${row.title}`}
                        aria-haspopup="menu"
                        aria-expanded={menu?.row.id === row.id}
                        onClick={(event) => {
                          if (menu?.row.id === row.id) {
                            setMenu(null);
                            return;
                          }
                          trigger.current = event.currentTarget;
                          const rect =
                            event.currentTarget.getBoundingClientRect();
                          setMenu({
                            row,
                            left: Math.min(
                              rect.right - 176,
                              window.innerWidth - 184,
                            ),
                            top: Math.min(
                              rect.bottom + 4,
                              window.innerHeight - 260,
                            ),
                          });
                        }}
                      >
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {menu &&
        createPortal(
          <div
            ref={menuRef}
            role="menu"
            aria-label="Task actions"
            className="crm-brand-actions crm-task-workspace fixed z-50 w-44 rounded-xl border border-border bg-card p-1 shadow-xl"
            style={{ left: menu.left, top: menu.top }}
            onKeyDown={(event) => {
              if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key))
                return;
              event.preventDefault();
              const buttons = Array.from(
                event.currentTarget.querySelectorAll<HTMLButtonElement>(
                  "button",
                ),
              );
              const index = buttons.indexOf(
                document.activeElement as HTMLButtonElement,
              );
              const next =
                event.key === "Home"
                  ? 0
                  : event.key === "End"
                    ? buttons.length - 1
                    : (index +
                        (event.key === "ArrowDown" ? 1 : -1) +
                        buttons.length) %
                      buttons.length;
              buttons[next]?.focus();
            }}
          >
            {(
              [
                ["edit", "Edit task", menu.row.actions.edit],
                ["complete", "Complete", menu.row.actions.complete],
                ["snooze", "Snooze", menu.row.actions.snooze],
                [
                  "cancel",
                  "Cancel task",
                  menu.row.actions.edit &&
                    !["COMPLETED", "CANCELLED"].includes(menu.row.status),
                ],
                ["history", "View history", true],
                ["delete", "Delete task", menu.row.actions.delete],
              ] as const
            )
              .filter(([, , allowed]) => allowed)
              .map(([action, title]) => (
                <Button
                  key={action}
                  variant="ghost"
                  size="sm"
                  role="menuitem"
                  className="w-full justify-start"
                  onClick={() => {
                    const row = menu.row;
                    setMenu(null);
                    onAction(row, action);
                  }}
                >
                  {title}
                </Button>
              ))}
          </div>,
          document.body,
        )}
    </>
  );
}
