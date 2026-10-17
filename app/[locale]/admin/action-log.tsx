"use client";

import { createContext, use, useCallback, useState, type ReactNode } from "react";
import { SystemMessage } from "@/components/ui/bubble";

type Entry = { id: number; message: string };

const ActionLogContext = createContext<(message: string) => void>(() => {});

/**
 * What the admin just decided on this tab. A decided item leaves its list as soon as the page
 * refreshes (it is no longer pending or open), so the outcome is confirmed here instead. Client
 * state, so it survives those refreshes until the admin navigates away.
 */
export function ActionLogProvider({ children }: { children: ReactNode }) {
  const [entries, setEntries] = useState<Entry[]>([]);
  const push = useCallback((message: string) => {
    setEntries((current) => [{ id: Date.now(), message }, ...current].slice(0, 5));
  }, []);

  return (
    <ActionLogContext value={push}>
      <div role="status" aria-live="polite" className="flex flex-col gap-2 empty:hidden">
        {entries.map((entry) => (
          <SystemMessage key={entry.id} tone="soft" className="max-w-[640px]">
            {entry.message}
          </SystemMessage>
        ))}
      </div>
      {children}
    </ActionLogContext>
  );
}

/** Adds a line to the tab's log ("“Absen Lab” disetujui · maker jadi terpercaya"). */
export function useActionLog() {
  return use(ActionLogContext);
}
