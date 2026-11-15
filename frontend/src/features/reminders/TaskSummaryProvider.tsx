"use client";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { taskWorkspaceApi, type TaskSummary } from "./task-workspace-api";
const Context = createContext<{
  summary: TaskSummary | null;
  error: string | null;
  refresh: () => void;
}>({ summary: null, error: null, refresh: () => {} });
export function TaskSummaryProvider({ children }: { children: ReactNode }) {
  const [summary, setSummary] = useState<TaskSummary | null>(null),
    [error, setError] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  const refresh = useCallback(() => setRevision((v) => v + 1), []);
  const request = useRef<AbortController | null>(null);
  useEffect(() => {
    const load = () => {
      if (document.visibilityState !== "visible") return;
      request.current?.abort();
      const controller = new AbortController();
      request.current = controller;
      taskWorkspaceApi
        .summary(controller.signal)
        .then((value) => {
          if (!controller.signal.aborted) {
            setSummary(value);
            setError(null);
          }
        })
        .catch((e) => {
          if (!controller.signal.aborted)
            setError(
              e instanceof Error ? e.message : "Task counts unavailable.",
            );
        });
    };
    load();
    const interval = window.setInterval(load, 60000);
    window.addEventListener("focus", load);
    document.addEventListener("visibilitychange", load);
    window.addEventListener("crm:reminders-changed", load);
    return () => {
      clearInterval(interval);
      request.current?.abort();
      window.removeEventListener("focus", load);
      document.removeEventListener("visibilitychange", load);
      window.removeEventListener("crm:reminders-changed", load);
    };
  }, [revision]);
  return (
    <Context.Provider value={{ summary, error, refresh }}>
      {children}
    </Context.Provider>
  );
}
export function useTaskSummary() {
  return useContext(Context);
}
