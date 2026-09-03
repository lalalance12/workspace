import {
  FieldSkeleton,
  NoteSkeleton,
  PageHeaderSkeleton,
  Skeleton,
} from "@/components/ui/skeleton";

/** Mirrors MeForm: chips, two fields, the button, and the live preview card. */
export default function MeLoading() {
  return (
    <>
      <PageHeaderSkeleton titleWidth="14rem" />

      <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_17rem]">
        <div className="flex flex-col gap-7">
          <div className="flex flex-col gap-3">
            <Skeleton className="h-3 w-16" />
            <div className="flex flex-wrap gap-2">
              {[5.5, 6, 7, 6.5, 5.5, 8, 4].map((w, i) => (
                <Skeleton
                  key={i}
                  className="h-9"
                  style={{ width: `${w}rem`, borderRadius: "var(--radius-pill)" }}
                />
              ))}
            </div>
          </div>

          <FieldSkeleton />
          <FieldSkeleton />
          <Skeleton className="h-11 w-32" />
        </div>

        <aside className="flex flex-col gap-3">
          <Skeleton className="h-3 w-24" />
          <NoteSkeleton />
        </aside>
      </div>
    </>
  );
}
