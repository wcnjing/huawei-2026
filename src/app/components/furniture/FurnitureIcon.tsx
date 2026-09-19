export function FurnitureIcon({ itemId, size = 36 }: { itemId: string; size?: number }) {
  const s = size;
  switch (itemId) {
    case "grandma-chair": return (
      <svg width={s} height={s} viewBox="0 0 10 10" style={{ imageRendering: "pixelated", display: "block" }}>
        <rect x={2} y={0} width={6} height={6} fill="#7a3a9a"/>
        <rect x={3} y={1} width={4} height={4} fill="#9b4dca"/>
        <rect x={0} y={4} width={2} height={5} fill="#5a2a7a"/>
        <rect x={8} y={4} width={2} height={5} fill="#5a2a7a"/>
        <rect x={1} y={6} width={8} height={3} fill="#9b4dca"/>
        <rect x={2} y={7} width={6} height={1} fill="#c77dff" opacity={0.5}/>
        <rect x={1} y={9} width={2} height={1} fill="#3a1a5a"/>
        <rect x={7} y={9} width={2} height={1} fill="#3a1a5a"/>
      </svg>
    );
    case "grandma-shelf": return (
      <svg width={s} height={s} viewBox="0 0 10 10" style={{ imageRendering: "pixelated", display: "block" }}>
        <rect x={0} y={0} width={10} height={10} fill="#5a3010"/>
        <rect x={1} y={0} width={8} height={10} fill="#0a0e1a"/>
        <rect x={0} y={4} width={10} height={1} fill="#5a3010"/>
        <rect x={1} y={0} width={2} height={4} fill="#ff2d55"/>
        <rect x={4} y={1} width={1} height={3} fill="#00ff88"/>
        <rect x={6} y={0} width={1} height={4} fill="#ffe66d"/>
        <rect x={8} y={1} width={1} height={3} fill="#c77dff"/>
        <rect x={1} y={5} width={3} height={4} fill="#4ecdc4"/>
        <rect x={5} y={5} width={1} height={4} fill="#ff6b35"/>
        <rect x={7} y={6} width={2} height={3} fill="#ffe66d"/>
        <rect x={9} y={5} width={1} height={4} fill="#5a3010"/>
      </svg>
    );
    case "grandma-lamp": return (
      <svg width={s} height={s} viewBox="0 0 10 12" style={{ imageRendering: "pixelated", display: "block" }}>
        <rect x={2} y={0} width={6} height={1} fill="#ffe66d"/>
        <rect x={1} y={1} width={8} height={1} fill="#ffe66d"/>
        <rect x={0} y={2} width={10} height={2} fill="#ffe66d"/>
        <rect x={1} y={1} width={8} height={3} fill="#ffe66d" opacity={0.35}/>
        <rect x={4} y={4} width={2} height={6} fill="#8b5e3c"/>
        <rect x={2} y={9} width={6} height={2} fill="#8b5e3c"/>
        <rect x={1} y={10} width={8} height={1} fill="#6b4020"/>
        <rect x={4} y={3} width={2} height={1} fill="#ffffff" opacity={0.7}/>
      </svg>
    );
    case "grandma-frame": return (
      <svg width={s} height={s} viewBox="0 0 10 9" style={{ imageRendering: "pixelated", display: "block" }}>
        <rect x={0} y={0} width={10} height={9} fill="#8b5e3c"/>
        <rect x={1} y={1} width={8} height={7} fill="#6b4020"/>
        <rect x={2} y={2} width={6} height={5} fill="#1a3a5a"/>
        <rect x={2} y={2} width={6} height={2} fill="#1a2a6a"/>
        <rect x={2} y={4} width={6} height={3} fill="#1a4a2a"/>
        <rect x={3} y={2} width={2} height={2} fill="#ffe66d" opacity={0.9}/>
        <rect x={3} y={2} width={1} height={1} fill="#ffffff" opacity={0.6}/>
        <rect x={7} y={3} width={1} height={4} fill="#0a2a0a"/>
        <rect x={6} y={2} width={3} height={3} fill="#0a2a0a"/>
      </svg>
    );
    case "mum-plant": return (
      <svg width={s} height={s} viewBox="0 0 10 12" style={{ imageRendering: "pixelated", display: "block" }}>
        <rect x={4} y={0} width={2} height={1} fill="#00cc66"/>
        <rect x={3} y={1} width={4} height={1} fill="#00ff88"/>
        <rect x={1} y={2} width={8} height={2} fill="#00cc66"/>
        <rect x={2} y={1} width={6} height={3} fill="#00ff88"/>
        <rect x={1} y={2} width={3} height={2} fill="#00cc66" opacity={0.6}/>
        <rect x={2} y={2} width={2} height={1} fill="#4ecdc4" opacity={0.25}/>
        <rect x={4} y={4} width={2} height={2} fill="#006633"/>
        <rect x={2} y={6} width={6} height={1} fill="#cd7f32"/>
        <rect x={3} y={7} width={4} height={4} fill="#cd7f32"/>
        <rect x={2} y={7} width={6} height={3} fill="#b05a20"/>
        <rect x={3} y={7} width={2} height={2} fill="#cd7f32" opacity={0.5}/>
        <rect x={3} y={10} width={4} height={1} fill="#8b3a10"/>
      </svg>
    );
    case "mum-desk": return (
      <svg width={s} height={s} viewBox="0 0 12 10" style={{ imageRendering: "pixelated", display: "block" }}>
        <rect x={3} y={0} width={7} height={4} fill="#1a2340"/>
        <rect x={4} y={1} width={5} height={2} fill="#0a0e1a"/>
        <rect x={5} y={1} width={3} height={1} fill="#4ecdc4" opacity={0.4}/>
        <rect x={5} y={2} width={1} height={1} fill="#00ff88" opacity={0.7}/>
        <rect x={6} y={4} width={2} height={1} fill="#2a3a5c"/>
        <rect x={0} y={5} width={12} height={2} fill="#8b5e3c"/>
        <rect x={0} y={5} width={12} height={1} fill="#aa7040"/>
        <rect x={1} y={7} width={2} height={3} fill="#6b4020"/>
        <rect x={9} y={7} width={2} height={3} fill="#6b4020"/>
        <rect x={5} y={6} width={2} height={1} fill="#6b4020"/>
      </svg>
    );
    case "mum-laptop": return (
      <svg width={s} height={s} viewBox="0 0 12 10" style={{ imageRendering: "pixelated", display: "block" }}>
        <rect x={1} y={0} width={10} height={6} fill="#1a2340"/>
        <rect x={2} y={1} width={8} height={4} fill="#0a0e1a"/>
        <rect x={3} y={1} width={6} height={3} fill="#4ecdc4" opacity={0.12}/>
        <rect x={4} y={2} width={4} height={1} fill="#00ff88" opacity={0.25}/>
        <rect x={5} y={3} width={2} height={1} fill="#4ecdc4" opacity={0.5}/>
        <rect x={6} y={0} width={1} height={1} fill="#ff2d55" opacity={0.8}/>
        <rect x={1} y={6} width={10} height={1} fill="#2a3a5c"/>
        <rect x={0} y={7} width={12} height={3} fill="#1a2a3c"/>
        <rect x={1} y={7} width={10} height={2} fill="#2a3a5c"/>
        <rect x={2} y={8} width={1} height={1} fill="#3a4a6c"/><rect x={4} y={8} width={1} height={1} fill="#3a4a6c"/>
        <rect x={6} y={8} width={1} height={1} fill="#3a4a6c"/><rect x={8} y={8} width={1} height={1} fill="#3a4a6c"/>
        <rect x={3} y={9} width={6} height={1} fill="#3a4a6c"/>
      </svg>
    );
    case "mum-phone": return (
      <svg width={s} height={s} viewBox="0 0 8 12" style={{ imageRendering: "pixelated", display: "block" }}>
        <rect x={1} y={0} width={6} height={12} fill="#2a3a5c"/>
        <rect x={0} y={1} width={8} height={10} fill="#2a3a5c"/>
        <rect x={2} y={1} width={4} height={7} fill="#0a0e1a"/>
        <rect x={2} y={1} width={4} height={6} fill="#1a2a4a"/>
        <rect x={3} y={2} width={2} height={1} fill="#4ecdc4" opacity={0.7}/>
        <rect x={2} y={4} width={4} height={1} fill="#6b8ba4" opacity={0.5}/>
        <rect x={2} y={5} width={3} height={1} fill="#6b8ba4" opacity={0.4}/>
        <rect x={3} y={0} width={2} height={1} fill="#1a2340"/>
        <rect x={3} y={0} width={1} height={1} fill="#111827"/>
        <rect x={3} y={9} width={2} height={1} fill="#2a3a5c"/>
      </svg>
    );
    case "dad-tv": return (
      <svg width={s} height={s} viewBox="0 0 12 12" style={{ imageRendering: "pixelated", display: "block" }}>
        <rect x={0} y={0} width={12} height={8} fill="#2a3a5c"/>
        <rect x={1} y={1} width={10} height={6} fill="#0a0e1a"/>
        <rect x={2} y={2} width={4} height={2} fill="#4ecdc4" opacity={0.35}/>
        <rect x={7} y={2} width={3} height={1} fill="#ff2d55" opacity={0.6}/>
        <rect x={7} y={3} width={3} height={1} fill="#ffe66d" opacity={0.5}/>
        <rect x={2} y={5} width={8} height={1} fill="#2a4a6a" opacity={0.5}/>
        <rect x={10} y={1} width={1} height={1} fill="#00ff88"/>
        <rect x={5} y={8} width={2} height={1} fill="#1a2340"/>
        <rect x={3} y={9} width={6} height={3} fill="#2a3a5c"/>
        <rect x={3} y={9} width={6} height={1} fill="#3a4a6c"/>
      </svg>
    );
    case "dad-couch": return (
      <svg width={s} height={s} viewBox="0 0 12 9" style={{ imageRendering: "pixelated", display: "block" }}>
        <rect x={1} y={0} width={10} height={5} fill="#2a3a4a"/>
        <rect x={2} y={1} width={4} height={3} fill="#3a4a5a"/>
        <rect x={7} y={1} width={3} height={3} fill="#3a4a5a"/>
        <rect x={2} y={1} width={4} height={1} fill="#4a5a6a" opacity={0.6}/>
        <rect x={7} y={1} width={3} height={1} fill="#4a5a6a" opacity={0.6}/>
        <rect x={6} y={1} width={1} height={4} fill="#1a2a3a"/>
        <rect x={0} y={5} width={12} height={3} fill="#3a4a5a"/>
        <rect x={1} y={5} width={10} height={1} fill="#4a5a6a"/>
        <rect x={0} y={0} width={1} height={8} fill="#1a2a3a"/>
        <rect x={11} y={0} width={1} height={8} fill="#1a2a3a"/>
        <rect x={1} y={8} width={2} height={1} fill="#0a1a2a"/>
        <rect x={9} y={8} width={2} height={1} fill="#0a1a2a"/>
      </svg>
    );
    case "dad-cabinet": return (
      <svg width={s} height={s} viewBox="0 0 10 12" style={{ imageRendering: "pixelated", display: "block" }}>
        <rect x={0} y={0} width={10} height={12} fill="#5a3010"/>
        <rect x={1} y={0} width={8} height={12} fill="#4a2010"/>
        <rect x={1} y={1} width={8} height={3} fill="#3a1808"/>
        <rect x={1} y={1} width={8} height={1} fill="#5a3010" opacity={0.5}/>
        <rect x={4} y={2} width={2} height={1} fill="#ffe66d"/>
        <rect x={1} y={5} width={8} height={3} fill="#3a1808"/>
        <rect x={1} y={5} width={8} height={1} fill="#5a3010" opacity={0.5}/>
        <rect x={4} y={6} width={2} height={1} fill="#ffe66d"/>
        <rect x={1} y={9} width={8} height={3} fill="#3a1808"/>
        <rect x={1} y={9} width={8} height={1} fill="#5a3010" opacity={0.5}/>
        <rect x={4} y={10} width={2} height={1} fill="#ffe66d"/>
        <rect x={0} y={4} width={10} height={1} fill="#2a1000"/>
        <rect x={0} y={8} width={10} height={1} fill="#2a1000"/>
      </svg>
    );
    case "dad-door": return (
      <svg width={s} height={s} viewBox="0 0 10 14" style={{ imageRendering: "pixelated", display: "block" }}>
        <rect x={0} y={0} width={10} height={14} fill="#5a3010"/>
        <rect x={1} y={1} width={8} height={12} fill="#8b5e3c"/>
        <rect x={2} y={1} width={6} height={12} fill="#aa7040"/>
        <rect x={2} y={2} width={2} height={3} fill="#8b5e3c"/>
        <rect x={6} y={2} width={2} height={3} fill="#8b5e3c"/>
        <rect x={2} y={7} width={2} height={5} fill="#8b5e3c"/>
        <rect x={6} y={7} width={2} height={5} fill="#8b5e3c"/>
        <rect x={7} y={6} width={2} height={2} fill="#ffe66d"/>
        <rect x={7} y={7} width={1} height={1} fill="#aa9900"/>
        <rect x={1} y={3} width={1} height={1} fill="#3a1808"/>
        <rect x={1} y={10} width={1} height={1} fill="#3a1808"/>
      </svg>
    );
    case "dad-shower": return (
      <svg width={s} height={s} viewBox="0 0 10 14" style={{ imageRendering: "pixelated", display: "block" }}>
        <rect x={4} y={0} width={2} height={5} fill="#6b8ba4"/>
        <rect x={1} y={4} width={8} height={2} fill="#6b8ba4"/>
        <rect x={1} y={2} width={2} height={4} fill="#6b8ba4"/>
        <rect x={0} y={6} width={10} height={3} fill="#4a6a7c"/>
        <rect x={1} y={6} width={8} height={1} fill="#5a7a8c"/>
        <rect x={1} y={7} width={1} height={1} fill="#2a4a5c"/>
        <rect x={3} y={7} width={1} height={1} fill="#2a4a5c"/>
        <rect x={5} y={7} width={1} height={1} fill="#2a4a5c"/>
        <rect x={7} y={7} width={1} height={1} fill="#2a4a5c"/>
        <rect x={2} y={8} width={1} height={1} fill="#2a4a5c"/>
        <rect x={4} y={8} width={1} height={1} fill="#2a4a5c"/>
        <rect x={6} y={8} width={1} height={1} fill="#2a4a5c"/>
        <rect x={1} y={10} width={1} height={2} fill="#4ecdc4" opacity={0.7}/>
        <rect x={3} y={11} width={1} height={2} fill="#4ecdc4" opacity={0.7}/>
        <rect x={5} y={10} width={1} height={2} fill="#4ecdc4" opacity={0.7}/>
        <rect x={7} y={11} width={1} height={2} fill="#4ecdc4" opacity={0.7}/>
        <rect x={9} y={10} width={1} height={2} fill="#4ecdc4" opacity={0.5}/>
      </svg>
    );
    case "kid-bed": return (
      <svg width={s} height={s} viewBox="0 0 12 10" style={{ imageRendering: "pixelated", display: "block" }}>
        <rect x={0} y={0} width={3} height={9} fill="#ffe66d"/>
        <rect x={1} y={1} width={1} height={7} fill="#aa9900"/>
        <rect x={3} y={2} width={9} height={6} fill="#2a4aa4"/>
        <rect x={3} y={2} width={9} height={5} fill="#3a5ab4"/>
        <rect x={4} y={2} width={4} height={3} fill="#e8f4f8"/>
        <rect x={5} y={3} width={2} height={1} fill="#c0d8e0"/>
        <rect x={3} y={5} width={9} height={1} fill="#1a3a7a"/>
        <rect x={4} y={6} width={8} height={2} fill="#2a4aa4"/>
        <rect x={0} y={8} width={12} height={2} fill="#aa9900"/>
        <rect x={10} y={3} width={2} height={7} fill="#ffe66d"/>
      </svg>
    );
    case "kid-toybox": return (
      <svg width={s} height={s} viewBox="0 0 10 9" style={{ imageRendering: "pixelated", display: "block" }}>
        <rect x={0} y={0} width={10} height={3} fill="#cc9900"/>
        <rect x={0} y={0} width={10} height={1} fill="#ffe66d"/>
        <rect x={4} y={1} width={2} height={2} fill="#ff6b35"/>
        <rect x={0} y={3} width={10} height={6} fill="#aa7700"/>
        <rect x={1} y={3} width={8} height={5} fill="#bb8800"/>
        <rect x={1} y={4} width={2} height={2} fill="#ff2d55" opacity={0.9}/>
        <rect x={4} y={4} width={2} height={2} fill="#00ff88" opacity={0.9}/>
        <rect x={7} y={4} width={2} height={2} fill="#4ecdc4" opacity={0.9}/>
        <rect x={2} y={6} width={2} height={2} fill="#c77dff" opacity={0.9}/>
        <rect x={6} y={6} width={2} height={2} fill="#ffe66d" opacity={0.9}/>
        <rect x={0} y={8} width={10} height={1} fill="#8b5e00"/>
      </svg>
    );
    case "kid-teddy": return (
      <svg width={s} height={s} viewBox="0 0 10 12" style={{ imageRendering: "pixelated", display: "block" }}>
        <rect x={1} y={0} width={3} height={3} fill="#cc9900"/>
        <rect x={6} y={0} width={3} height={3} fill="#cc9900"/>
        <rect x={2} y={0} width={1} height={2} fill="#ff8855" opacity={0.6}/>
        <rect x={7} y={0} width={1} height={2} fill="#ff8855" opacity={0.6}/>
        <rect x={1} y={1} width={8} height={5} fill="#cc9900"/>
        <rect x={2} y={2} width={6} height={4} fill="#ddaa00"/>
        <rect x={3} y={2} width={1} height={2} fill="#0a0e1a"/>
        <rect x={6} y={2} width={1} height={2} fill="#0a0e1a"/>
        <rect x={3} y={2} width={1} height={1} fill="#ffffff" opacity={0.5}/>
        <rect x={6} y={2} width={1} height={1} fill="#ffffff" opacity={0.5}/>
        <rect x={4} y={4} width={2} height={1} fill="#0a0e1a"/>
        <rect x={3} y={5} width={4} height={1} fill="#0a0e1a"/>
        <rect x={2} y={6} width={6} height={5} fill="#cc9900"/>
        <rect x={3} y={6} width={4} height={5} fill="#ddaa00"/>
        <rect x={3} y={7} width={4} height={3} fill="#ffe66d" opacity={0.7}/>
        <rect x={0} y={6} width={2} height={4} fill="#cc9900"/>
        <rect x={8} y={6} width={2} height={4} fill="#cc9900"/>
        <rect x={2} y={10} width={3} height={2} fill="#aa7700"/>
        <rect x={5} y={10} width={3} height={2} fill="#aa7700"/>
      </svg>
    );
    case "kid-alarm": return (
      <svg width={s} height={s} viewBox="0 0 10 11" style={{ imageRendering: "pixelated", display: "block" }}>
        <rect x={1} y={0} width={3} height={3} fill="#ffe66d"/>
        <rect x={2} y={1} width={1} height={2} fill="#aa9900"/>
        <rect x={6} y={0} width={3} height={3} fill="#ffe66d"/>
        <rect x={7} y={1} width={1} height={2} fill="#aa9900"/>
        <rect x={2} y={1} width={6} height={1} fill="#ffe66d"/>
        <rect x={1} y={2} width={8} height={6} fill="#ffe66d"/>
        <rect x={0} y={3} width={10} height={4} fill="#ffe66d"/>
        <rect x={1} y={7} width={8} height={2} fill="#ffe66d"/>
        <rect x={2} y={8} width={6} height={2} fill="#ffe66d"/>
        <rect x={2} y={2} width={6} height={7} fill="#0a0e1a"/>
        <rect x={3} y={3} width={4} height={5} fill="#111827"/>
        <rect x={4} y={3} width={1} height={4} fill="#e8f4f8"/>
        <rect x={4} y={5} width={3} height={1} fill="#ff2d55"/>
        <rect x={4} y={3} width={1} height={1} fill="#2a3a5c"/>
        <rect x={4} y={7} width={1} height={1} fill="#2a3a5c"/>
        <rect x={2} y={5} width={1} height={1} fill="#2a3a5c"/>
        <rect x={6} y={5} width={1} height={1} fill="#2a3a5c"/>
        <rect x={2} y={9} width={2} height={2} fill="#aa9900"/>
        <rect x={6} y={9} width={2} height={2} fill="#aa9900"/>
      </svg>
    );
    default:
      return (
        <svg width={s} height={s} viewBox="0 0 10 10" style={{ imageRendering: "pixelated", display: "block" }}>
          <rect x={1} y={1} width={8} height={8} fill="#2a3a5c"/>
          <rect x={3} y={3} width={4} height={4} fill="#1a2340"/>
          <rect x={4} y={4} width={2} height={2} fill="#4ecdc4" opacity={0.5}/>
        </svg>
      );
  }
}