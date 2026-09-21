export function Stars() {
  const stars = Array.from({ length: 40 }, (_, i) => ({
    x: ((i * 137.5) % 100).toFixed(1),
    y: ((i * 73.1) % 100).toFixed(1),
    s: i % 3 === 0 ? 2 : 1,
  }));
  return (
    <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
      {stars.map((s, i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            left: `${s.x}%`,
            top: `${s.y}%`,
            width: s.s,
            height: s.s,
            backgroundColor: "#ffffff",
            opacity: 0.3 + (i % 4) * 0.15,
            animation: `twinkle ${1.5 + (i % 3) * 0.7}s ease-in-out infinite`,
            animationDelay: `${(i % 7) * 0.3}s`,
          }}
        />
      ))}
    </div>
  );
}
