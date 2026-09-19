export function PixelPanel({
  children,
  className = "",
  accent = "#2a3a5c",
}: {
  children: React.ReactNode;
  className?: string;
  accent?: string;
}) {
  return (
    <div
      style={{
        backgroundColor: "#111827",
        border: `4px solid ${accent}`,
        boxShadow: `4px 4px 0px ${accent}`,
      }}
      className={`p-4 ${className}`}
    >
      {children}
    </div>
  );
}