import { FieldSkeleton, PageHeaderSkeleton, Skeleton } from "@/components/ui/skeleton";

export default function SettingsMeLoading() {
  return (
    <>
      <PageHeaderSkeleton titleWidth="10rem" />

      <div className="flex max-w-lg flex-col gap-10">
        <div className="panel flex flex-col gap-6 p-6">
          <FieldSkeleton />
          <FieldSkeleton />
          <Skeleton className="h-4 w-48" />
          <Skeleton className="h-4 w-56" />
        </div>
        <div className="panel flex flex-col gap-6 p-6">
          <FieldSkeleton />
          <FieldSkeleton />
        </div>
      </div>
    </>
  );
}
