/** Placeholder while the submit/edit form waits for the session and catalog: the stepper and step 1. */
export function FormSkeleton() {
  return (
    <div aria-hidden="true" className="flex flex-col gap-6 pt-8 lg:max-w-[760px]">
      <div className="flex flex-col gap-2">
        <div className="h-6 w-32 rounded-sm bg-placeholder" />
        <div className="grid grid-cols-6 gap-1.5">
          {Array.from({ length: 6 }, (_, index) => (
            <div key={index} className="h-1.5 rounded-full bg-border" />
          ))}
        </div>
      </div>
      <div className="h-6 w-2/3 rounded-sm bg-placeholder" />
      <div className="h-11 w-full rounded-md border-[1.5px] border-border bg-surface sm:ml-12 sm:w-[calc(100%-3rem)]" />
      <div className="h-11 w-full rounded-md border-[1.5px] border-border bg-surface sm:ml-12 sm:w-[calc(100%-3rem)]" />
    </div>
  );
}
