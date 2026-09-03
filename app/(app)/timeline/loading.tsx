import { NoteGridSkeleton, PageHeaderSkeleton } from "@/components/ui/skeleton";

export default function TimelineLoading() {
  return (
    <>
      <PageHeaderSkeleton titleWidth="8rem" />
      <NoteGridSkeleton count={4} />
    </>
  );
}
