"use client";

import { useState } from "react";
import { Pill } from "@/components/ui/pill";
import { Segmented } from "@/components/ui/segmented";

export function SegmentedDemo() {
  const [sort, setSort] = useState<"pop" | "new">("pop");
  const [tools, setTools] = useState<string[]>(["Claude Code"]);
  const all = ["Claude Code", "Cursor", "Lovable", "Bolt", "v0", "Replit"];

  return (
    <div className="flex flex-col gap-4">
      <Segmented
        label="Urutkan"
        value={sort}
        onChange={setSort}
        options={[
          { value: "pop", label: "Paling worth it" },
          { value: "new", label: "Terbaru" },
        ]}
      />
      <div className="flex flex-wrap gap-2">
        {all.map((name) => (
          <Pill
            key={name}
            selected={tools.includes(name)}
            onClick={() =>
              setTools(tools.includes(name) ? tools.filter((x) => x !== name) : [...tools, name])
            }
          >
            {name}
          </Pill>
        ))}
      </div>
    </div>
  );
}
