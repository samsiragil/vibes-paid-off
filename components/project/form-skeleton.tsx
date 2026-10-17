/** Placeholder while the submit/edit form waits for the session and catalog. */
export function FormSkeleton() {
  return (
    <div aria-hidden="true" className="flex flex-col gap-4 pt-14 lg:max-w-[760px]">
      <div className="h-6 w-2/3 rounded-full bg-bubble" />
      <div className="h-14 w-3/4 rounded-[18px] bg-bubble" />
      <div className="h-36 w-[88%] self-end rounded-[22px] bg-bubble" />
      <div className="h-14 w-1/2 rounded-[18px] bg-bubble" />
      <div className="h-72 w-[88%] self-end rounded-[22px] bg-bubble" />
    </div>
  );
}
