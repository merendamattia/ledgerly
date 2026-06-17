"use client";

import { useRef, useState } from "react";
import { UploadCloud } from "lucide-react";
import { cn } from "@/lib/utils";

// Styled drag-and-drop affordance. On a CSV/TSV pick or drop it hands the file
// up; the parse → review → commit flow lives in the caller's import dialog.
// Shared by the investment and expense Add drawers.
export function CsvDropzone({
  onFile,
  label = "Import several movements via CSV",
  helpText,
  accept = ".csv,.tsv,text/csv,text/tab-separated-values",
}: {
  onFile: (file: File) => void;
  label?: string;
  helpText?: string;
  accept?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  return (
    <div className="mt-6">
      <div className="mb-4 flex items-center gap-3.5">
        <div className="h-px flex-1 bg-border" />
        <span className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
          or
        </span>
        <div className="h-px flex-1 bg-border" />
      </div>
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          if (!dragOver) setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          const file = e.dataTransfer.files?.[0];
          if (file) onFile(file);
        }}
        className={cn(
          "flex w-full flex-col items-center gap-1.5 rounded-2xl border-2 border-dashed px-4 py-6 text-center transition-colors",
          dragOver ? "border-primary bg-primary/5" : "border-border hover:border-primary",
        )}
      >
        <span className="flex size-11 items-center justify-center rounded-xl bg-muted text-[#5b7d10]">
          <UploadCloud className="size-5" />
        </span>
        <span className="text-sm font-semibold">{label}</span>
        <span className="text-xs text-muted-foreground">
          Drop a file here or <span className="text-[#5b7d10] underline">browse</span>
        </span>
        {helpText ? (
          <span className="mt-1.5 text-[11px] text-muted-foreground">{helpText}</span>
        ) : null}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onFile(file);
          e.target.value = "";
        }}
      />
    </div>
  );
}
