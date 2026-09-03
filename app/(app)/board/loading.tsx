import { NoteGridSkeleton, PageHeaderSkeleton } from "@/components/ui/skeleton";

export default function BoardLoading() {
  return (
    <>
      <PageHeaderSkeleton titleWidth="6rem" />
      <NoteGridSkeleton count={6} />
    </>
  );
}
