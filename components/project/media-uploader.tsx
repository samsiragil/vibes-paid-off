"use client";

import Image from "next/image";
import { useTranslations } from "next-intl";
import {
  useEffect,
  useEffectEvent,
  useId,
  useImperativeHandle,
  useRef,
  useState,
  type ReactNode,
  type Ref,
} from "react";
import { cn } from "@/lib/cn";
import { deleteProjectMedia, reorderProjectMedia } from "@/lib/media/actions";
import {
  ACCEPTED_IMAGE_TYPES,
  isAcceptedImageType,
  MAX_MEDIA_PER_PROJECT,
  MAX_SOURCE_BYTES,
  type MediaErrorCode,
  type ProjectMedia,
} from "@/lib/media/limits";
import { compressImage, MediaUploadError, uploadProjectImage } from "@/lib/media/upload";
import { mediaUrl } from "@/lib/media/url";

type Status = "compressing" | "waiting" | "uploading" | "processing" | "done" | "error";

type Item = {
  localId: string;
  previewUrl: string;
  status: Status;
  /** Upload progress, 0..1. */
  progress: number;
  /** Compressed file, kept until it is stored. */
  blob?: Blob;
  media?: ProjectMedia;
  error?: MediaErrorCode;
  removing?: boolean;
};

export type MediaUploaderHandle = {
  /**
   * Uploads every image still waiting in the browser to a project that was just created
   * (submit flow). Resolves to true when all of them were stored.
   */
  uploadPending(projectId: string): Promise<boolean>;
  /** Adds images as if the maker had picked them (the autofill screenshot). */
  addFiles(files: File[]): void;
};

/** What the form needs for the live card preview: images in order, and whether work is pending. */
export type MediaUploaderChange = {
  previews: { url: string; status: Status }[];
  busy: boolean;
};

const busyStatuses: Status[] = ["compressing", "uploading", "processing"];

function errorCode(error: unknown): MediaErrorCode {
  return error instanceof MediaUploadError ? error.code : "failed";
}

/**
 * Up to 3 project images: pick or drop files, reorder, remove, with upload progress.
 *
 * With `projectId` (edit page) every change is saved right away. Without it (submit page) the
 * compressed images wait in the browser until the form calls `ref.uploadPending(projectId)`
 * after the project exists.
 */
export function MediaUploader({
  projectId,
  initialMedia = [],
  onChange,
  ref,
}: {
  projectId?: string;
  initialMedia?: ProjectMedia[];
  onChange?: (change: MediaUploaderChange) => void;
  ref?: Ref<MediaUploaderHandle>;
}) {
  const t = useTranslations("media");
  const inputId = useId();
  const [notice, setNotice] = useState<MediaErrorCode | null>(null);
  const [dragging, setDragging] = useState(false);

  const [items, setItemsState] = useState<Item[]>(() =>
    initialMedia.map((media) => ({
      localId: media.id,
      previewUrl: mediaUrl(media.key),
      status: "done",
      progress: 1,
      media,
    })),
  );
  // Async work reads the latest list from here; every update goes through setItems.
  const itemsRef = useRef(items);
  const setItems = (update: (previous: Item[]) => Item[]) => {
    itemsRef.current = update(itemsRef.current);
    setItemsState(itemsRef.current);
  };
  const patch = (localId: string, change: Partial<Item>) =>
    setItems((previous) =>
      previous.map((item) => (item.localId === localId ? { ...item, ...change } : item)),
    );

  /** Project the images belong to: the prop, or the one passed to uploadPending. */
  const targetRef = useRef(projectId);
  useEffect(() => {
    if (projectId) targetRef.current = projectId;
  }, [projectId]);

  /** Image ids in the order the database has them. */
  const serverOrderRef = useRef(initialMedia.map((media) => media.id));
  /** Uploads, deletes and reorders run one at a time, so positions never race. */
  const queueRef = useRef<Promise<unknown>>(Promise.resolve());
  const compressingRef = useRef(new Map<string, Promise<void>>());
  const objectUrlsRef = useRef(new Set<string>());

  function enqueue<T>(task: () => Promise<T>): Promise<T> {
    const run = queueRef.current.then(task, task);
    queueRef.current = run.catch(() => undefined);
    return run;
  }

  async function syncOrder(target: string) {
    const order = itemsRef.current.flatMap((item) =>
      item.status === "done" && item.media ? [item.media.id] : [],
    );
    const saved = serverOrderRef.current;
    if (order.length === 0 || order.every((id, index) => id === saved[index])) return;
    const result = await reorderProjectMedia(target, order);
    if (result.ok) serverOrderRef.current = order;
    else setNotice(result.error === "forbidden" ? "forbidden" : "failed");
  }

  async function uploadOne(localId: string, target: string): Promise<boolean> {
    const item = itemsRef.current.find((candidate) => candidate.localId === localId);
    if (!item) return true;
    if (item.status === "done") return true;
    if (!item.blob) return false;

    patch(localId, { status: "uploading", progress: 0, error: undefined });
    try {
      const media = await uploadProjectImage(target, item.blob, (status, progress) =>
        patch(localId, { status, progress }),
      );
      serverOrderRef.current = [...serverOrderRef.current, media.id];
      patch(localId, { status: "done", progress: 1, media, blob: undefined });
      await syncOrder(target);
      return true;
    } catch (error) {
      patch(localId, { status: "error", error: errorCode(error) });
      return false;
    }
  }

  function addFiles(fileList: FileList | File[] | null) {
    if (!fileList || fileList.length === 0) return;
    setNotice(null);
    const files = Array.from(fileList);
    const free = MAX_MEDIA_PER_PROJECT - itemsRef.current.length;
    if (files.length > free) setNotice("limit");

    for (const file of files.slice(0, Math.max(0, free))) {
      if (!isAcceptedImageType(file.type)) {
        setNotice("unsupported_type");
        continue;
      }
      if (file.size > MAX_SOURCE_BYTES) {
        setNotice("too_large");
        continue;
      }

      const localId = crypto.randomUUID();
      const previewUrl = URL.createObjectURL(file);
      objectUrlsRef.current.add(previewUrl);
      setItems((previous) => [
        ...previous,
        { localId, previewUrl, status: "compressing", progress: 0 },
      ]);

      const done = compressImage(file).then(
        (blob) => {
          if (!itemsRef.current.some((item) => item.localId === localId)) return;
          patch(localId, { status: "waiting", blob });
          const target = targetRef.current;
          if (target) void enqueue(() => uploadOne(localId, target));
        },
        (error) => patch(localId, { status: "error", error: errorCode(error) }),
      );
      compressingRef.current.set(localId, done);
      void done.finally(() => compressingRef.current.delete(localId));
    }
  }

  function forget(localId: string) {
    const item = itemsRef.current.find((candidate) => candidate.localId === localId);
    if (item && objectUrlsRef.current.delete(item.previewUrl)) URL.revokeObjectURL(item.previewUrl);
    setItems((previous) => previous.filter((candidate) => candidate.localId !== localId));
  }

  async function remove(item: Item) {
    setNotice(null);
    const target = targetRef.current;
    if (!item.media || !target) {
      forget(item.localId);
      return;
    }

    const media = item.media;
    patch(item.localId, { removing: true });
    const result = await enqueue(() => deleteProjectMedia(media.id));
    if (!result.ok) {
      patch(item.localId, { removing: false });
      setNotice(result.error === "forbidden" ? "forbidden" : "failed");
      return;
    }
    serverOrderRef.current = serverOrderRef.current.filter((id) => id !== media.id);
    forget(item.localId);
  }

  function move(index: number, offset: -1 | 1) {
    setItems((previous) => {
      const next = [...previous];
      const [moved] = next.splice(index, 1);
      next.splice(index + offset, 0, moved);
      return next;
    });
    const target = targetRef.current;
    if (target) void enqueue(() => syncOrder(target));
  }

  function retry(item: Item) {
    const target = targetRef.current;
    if (!item.blob) return;
    patch(item.localId, { status: "waiting", error: undefined });
    if (target) void enqueue(() => uploadOne(item.localId, target));
  }

  useImperativeHandle(ref, () => ({
    async uploadPending(target: string) {
      targetRef.current = target;
      await Promise.all(compressingRef.current.values());
      const pending = itemsRef.current.filter(
        (item) => item.status === "waiting" || (item.status === "error" && item.blob),
      );
      const results = await Promise.all(
        pending.map((item) => enqueue(() => uploadOne(item.localId, target))),
      );
      return results.every(Boolean) && itemsRef.current.every((item) => item.status === "done");
    },
    addFiles,
  }));

  const emitChange = useEffectEvent((next: Item[]) =>
    onChange?.({
      previews: next.map((item) => ({ url: item.previewUrl, status: item.status })),
      busy: next.some((item) => busyStatuses.includes(item.status) || item.removing),
    }),
  );
  useEffect(() => emitChange(items), [items]);

  // Free the in-memory previews when the uploader goes away.
  useEffect(() => {
    const objectUrls = objectUrlsRef.current;
    return () => {
      for (const url of objectUrls) URL.revokeObjectURL(url);
      objectUrls.clear();
    };
  }, []);

  function statusText(item: Item) {
    if (item.removing) return t("status.removing");
    switch (item.status) {
      case "compressing":
        return t("status.compressing");
      case "waiting":
        return projectId ? t("status.queued") : t("status.waiting");
      case "uploading":
        return t("status.uploading", { percent: Math.round(item.progress * 100) });
      case "processing":
        return t("status.processing");
      default:
        return null;
    }
  }

  const slots = Array.from({ length: MAX_MEDIA_PER_PROJECT }, (_, index) => index);
  const hintId = `${inputId}-hint`;

  return (
    <div className="flex flex-col gap-3">
      <ol
        className={cn(
          "grid grid-cols-3 gap-2 rounded transition-colors sm:gap-3",
          dragging && "bg-accent-soft",
        )}
        onDragOver={(event) => {
          if (!event.dataTransfer.types.includes("Files")) return;
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          addFiles(event.dataTransfer.files);
        }}
      >
        {slots.map((index) => {
          const item = items[index];
          if (!item) {
            return (
              <li key={`empty-${index}`}>
                {index === items.length ? (
                  <label
                    htmlFor={inputId}
                    className="flex aspect-[4/3] cursor-pointer flex-col items-center justify-center gap-1.5 rounded border-[1.5px] border-dashed border-(--dashed) bg-surface px-2 text-center text-sm font-semibold text-ink-2 transition-colors hover:border-ink hover:text-ink has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-accent"
                  >
                    <PlusIcon />
                    {t("add")}
                  </label>
                ) : (
                  <div
                    aria-hidden="true"
                    className="aspect-[4/3] rounded border border-dashed border-border-strong bg-placeholder"
                  />
                )}
              </li>
            );
          }

          const position = index + 1;
          const status = statusText(item);
          const locked =
            item.removing || item.status === "uploading" || item.status === "processing";

          return (
            <li key={item.localId} className="flex flex-col gap-1.5">
              <div className="relative aspect-[4/3] overflow-hidden rounded border border-border bg-placeholder">
                <Image
                  src={item.previewUrl}
                  alt={t("imageAlt", { position })}
                  fill
                  unoptimized
                  sizes="(min-width: 640px) 240px, 33vw"
                  className="object-cover"
                />
                {index === 0 ? (
                  <span className="absolute top-1.5 left-1.5 rounded-sm bg-highlight px-1.5 py-0.5 text-[13px] leading-4 font-semibold text-highlight-ink">
                    {t("cover")}
                  </span>
                ) : null}

                {item.status === "error" ? (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-bg/90 p-2 text-center">
                    <p role="alert" className="text-sm text-danger">
                      {t(`errors.${item.error ?? "failed"}`)}
                    </p>
                    {item.blob ? (
                      <button
                        type="button"
                        onClick={() => retry(item)}
                        className="rounded-md border-[1.5px] border-border-strong bg-surface px-3 py-1 text-sm font-semibold text-ink hover:border-ink"
                      >
                        {t("retry")}
                      </button>
                    ) : null}
                  </div>
                ) : item.status === "waiting" && !item.removing ? (
                  <span className="absolute right-1 bottom-1 left-1 truncate rounded-sm bg-surface/90 px-1.5 py-0.5 text-center text-xs font-semibold text-ink-2 sm:text-[13px]">
                    {status}
                  </span>
                ) : status ? (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-bg/75 p-2 text-center">
                    <span className="text-xs font-medium text-ink" aria-live="polite">
                      {status}
                    </span>
                    {item.status === "uploading" || item.status === "processing" ? (
                      <span className="h-1 w-3/4 overflow-hidden rounded-full bg-border">
                        <span
                          className="block h-full rounded-full bg-accent transition-[width]"
                          style={{ width: `${Math.round(item.progress * 100)}%` }}
                        />
                      </span>
                    ) : null}
                  </div>
                ) : null}
              </div>

              <div className="flex items-center justify-between gap-1">
                <div className="flex gap-1">
                  <IconButton
                    label={t("moveLeft", { position })}
                    disabled={index === 0 || locked}
                    onClick={() => move(index, -1)}
                  >
                    <path d="M15 6l-6 6 6 6" />
                  </IconButton>
                  <IconButton
                    label={t("moveRight", { position })}
                    disabled={index === items.length - 1 || locked}
                    onClick={() => move(index, 1)}
                  >
                    <path d="M9 6l6 6-6 6" />
                  </IconButton>
                </div>
                <IconButton
                  label={t("remove", { position })}
                  disabled={locked}
                  onClick={() => void remove(item)}
                >
                  <path d="M6 6l12 12M18 6L6 18" />
                </IconButton>
              </div>
            </li>
          );
        })}
      </ol>

      <input
        id={inputId}
        type="file"
        accept={ACCEPTED_IMAGE_TYPES.join(",")}
        multiple
        disabled={items.length >= MAX_MEDIA_PER_PROJECT}
        aria-describedby={hintId}
        className="sr-only"
        onChange={(event) => {
          addFiles(event.target.files);
          event.target.value = "";
        }}
      />

      {notice ? (
        <p id={hintId} role="alert" className="text-sm text-danger">
          {t(`errors.${notice}`)}
        </p>
      ) : (
        <p id={hintId} className="text-[13px] text-muted">
          {t("hint")}
        </p>
      )}
    </div>
  );
}

function IconButton({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string;
  disabled?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className="inline-flex size-8 items-center justify-center rounded-md border border-border-strong bg-surface text-ink transition-colors hover:border-ink disabled:pointer-events-none disabled:opacity-40"
    >
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        {children}
      </svg>
    </button>
  );
}

function PlusIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}
