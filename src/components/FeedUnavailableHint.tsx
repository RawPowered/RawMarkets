import { sanitizeFeedNoteForDisplay } from "../lib/feedDisplay";

export default function FeedUnavailableHint({
  note,
  className = "",
}: {
  note?: string | null;
  className?: string;
}) {
  const text = sanitizeFeedNoteForDisplay(note ?? undefined);
  if (!text) return null;
  return (
    <p
      className={`text-[10px] text-[#86868B] leading-snug ${className}`}
      title={text}
    >
      {text}
    </p>
  );
}
