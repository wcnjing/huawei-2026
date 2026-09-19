import type { Highlight } from "../../types/drills";

export function AnnotatedMessage({
  text,
  highlights = [],
  onFlagTap,
}: {
  text: string;
  highlights?: Highlight[];
  onFlagTap: (flagId: string) => void;
}) {
  if (highlights.length === 0) return <>{text}</>;
  const sorted = [...highlights].sort((a, b) => text.indexOf(a.phrase) - text.indexOf(b.phrase));
  const segments: { text: string; flagId?: string }[] = [];
  let cursor = 0;
  for (const h of sorted) {
    const idx = text.indexOf(h.phrase, cursor);
    if (idx === -1) continue;
    if (idx > cursor) segments.push({ text: text.slice(cursor, idx) });
    segments.push({ text: h.phrase, flagId: h.flagId });
    cursor = idx + h.phrase.length;
  }
  if (cursor < text.length) segments.push({ text: text.slice(cursor) });
  return (
    <>
      {segments.map((seg, i) =>
        seg.flagId ? (
          <span
            key={i}
            onClick={(e) => { e.stopPropagation(); onFlagTap(seg.flagId!); }}
            style={{
              color: "#ff2d55",
              backgroundColor: "rgba(255,45,85,0.18)",
              borderBottom: "2px solid #ff2d55",
              cursor: "pointer",
              padding: "0 2px",
              fontWeight: "bold",
            }}
          >
            {seg.text}
          </span>
        ) : (
          <span key={i}>{seg.text}</span>
        )
      )}
    </>
  );
}