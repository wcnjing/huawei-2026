import type { Highlight } from "../../types/drills";
import { useT } from "../../i18n";

export function AnnotatedMessage({
  text,
  highlights = [],
  onFlagTap,
}: {
  text: string;
  highlights?: Highlight[];
  onFlagTap: (flagId: string) => void;
}) {
  const t = useT();
  const shown = t(text);
  if (highlights.length === 0) return <>{shown}</>;
  const translated = highlights.map((h) => ({ phrase: t(h.phrase), flagId: h.flagId }));
  const sorted = translated.sort((a, b) => shown.indexOf(a.phrase) - shown.indexOf(b.phrase));
  const segments: { text: string; flagId?: string }[] = [];
  let cursor = 0;
  for (const h of sorted) {
    const idx = shown.indexOf(h.phrase, cursor);
    if (idx === -1) continue;
    if (idx > cursor) segments.push({ text: shown.slice(cursor, idx) });
    segments.push({ text: h.phrase, flagId: h.flagId });
    cursor = idx + h.phrase.length;
  }
  if (cursor < shown.length) segments.push({ text: shown.slice(cursor) });
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
