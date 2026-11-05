export function PixelPanel({
  children,
  className = "",
  accent = "var(--border)",
}: {
  children: React.ReactNode;
  className?: string;
  accent?: string;
}) {
  return (
    <div
      style={{
        backgroundColor: "var(--card)",
        border: `4px solid ${accent}`,
        boxShadow: `4px 4px 0px ${accent}`,
      }}
      className={`p-4 ${className}`}
    >
      {children}
    </div>
  );
}
