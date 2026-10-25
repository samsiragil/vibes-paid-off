/** Placeholder while the submit/edit form waits for the session and catalog. */
export function FormSkeleton() {
  return (
    <div aria-hidden="true" className="flex flex-col gap-4 pt-10 lg:max-w-[760px]">
      <div className="h-6 w-2/3 rounded-sm bg-placeholder" />
      <div className="h-11 w-full rounded-md border-[1.5px] border-border bg-surface sm:ml-12 sm:w-[calc(100%-3rem)]" />
      <div className="mt-6 h-6 w-1/2 rounded-sm bg-placeholder" />
      <div className="relative h-32 rounded-md border-[1.5px] border-border bg-surface ruled sm:ml-12">
        <span className="absolute inset-y-0 left-3 w-[1.5px] bg-margin sm:left-6" />
      </div>
    </div>
  );
}
