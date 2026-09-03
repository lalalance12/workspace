import { PageHeaderSkeleton, Skeleton } from "@/components/ui/skeleton";

export default function SettingsTeamLoading() {
  return (
    <>
      <PageHeaderSkeleton titleWidth="12rem" />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
        <div className="panel flex flex-col gap-4 p-6">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-9 w-52" />
          <Skeleton className="h-4 w-full" />
        </div>
        <div className="panel flex flex-col gap-4 p-6">
          <Skeleton className="h-3 w-28" />
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-5 w-full" />
          ))}
        </div>
      </div>
    </>
  );
}
