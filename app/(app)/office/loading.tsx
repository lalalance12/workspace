import { PageHeaderSkeleton, Skeleton } from "@/components/ui/skeleton";

export default function OfficeLoading() {
  return (
    <>
      <PageHeaderSkeleton titleWidth="6rem" />
      <Skeleton className="mx-auto mt-6 h-64 max-w-md" style={{ borderRadius: "var(--radius-card)" }} />
    </>
  );
}
