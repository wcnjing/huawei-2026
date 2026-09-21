import { useEffect, useRef, useState, type ReactNode, type CSSProperties } from 'react';
import { furnitureLayer, reconcileLayout, snapPosition, type RoomLayout, type RoomPosition } from './room-layout';
import { RoomBackdrop } from './RoomBackdrop';
import type { RoomStyle } from './room-style';

export type RoomFurniture = { id: string; name: string; art: ReactNode };
// Item size and travel below must keep width+travel = height+travel = 100: coordinates
// describe the travel of the item's own top-left corner (see room-layout.ts), so at
// x/y=100 the item's right/bottom edge should land exactly on the room's edge, never
// past it. Every place below that maps a pointer position or a 10-unit snap step to a
// percentage of the board derives from these same two numbers, so resizing the item
// can't silently desync the drag, tap-to-place and grid math again.
const ITEM_WIDTH_PCT = 22;
const ITEM_HEIGHT_PCT = 38;
const ITEM_TRAVEL_X = 1 - ITEM_WIDTH_PCT / 100;
const ITEM_TRAVEL_Y = 1 - ITEM_HEIGHT_PCT / 100;
const itemStyle = (p: RoomPosition): CSSProperties => ({
  position: 'absolute', left: `${p.x * ITEM_TRAVEL_X}%`, top: `${p.y * ITEM_TRAVEL_Y}%`,
  width: `${ITEM_WIDTH_PCT}%`, height: `${ITEM_HEIGHT_PCT}%`, display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
});

export function RoomFurnitureLayer({ items, layout }: { items: RoomFurniture[]; layout?: RoomLayout }) {
  const positions = reconcileLayout(items.map(i => i.id), layout);
  return <>
    {/* width/height (not max-width/max-height) so pixel art scales UP to fill its
        larger placement box too, not just down from its own intrinsic SVG size. */}
    <style>{`.room-furniture-art > svg { width: 100%; height: 100%; flex-shrink: 1; }`}</style>
    {items.map(item => <div key={item.id} title={item.name} data-placed-item={item.id}
      className="room-furniture-art" style={{ ...itemStyle(positions[item.id]), zIndex: furnitureLayer(item.id), pointerEvents: 'none' }}>{item.art}</div>)}
  </>;
}

export function RoomEditor({ items, layout, roomName, accent, background, roomStyle, onSave, onCancel }: {
  items: RoomFurniture[]; layout?: RoomLayout; roomName: string; accent: string; background: string;
  roomStyle?: RoomStyle;
  onSave: (layout: RoomLayout) => boolean; onCancel: () => void;
}) {
  const [draft, setDraft] = useState(() => reconcileLayout(items.map(i => i.id), layout));
  const [selected, setSelected] = useState<string | null>(items[0]?.id ?? null);
  const [error, setError] = useState('');
  const board = useRef<HTMLDivElement>(null);
  const dialog = useRef<HTMLDivElement>(null);
  const cancelRef = useRef(onCancel);
  cancelRef.current = onCancel;
  const drag = useRef<{ id: string; pointer: number; startX: number; startY: number; origin: RoomPosition; moved: boolean } | null>(null);
  const selectedItem = items.find(item => item.id === selected);

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    dialog.current?.focus();
    const keydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); cancelRef.current(); }
      if (event.key !== 'Tab') return;
      const focusable = [...(dialog.current?.querySelectorAll<HTMLElement>('button:not(:disabled), [tabindex="0"]') ?? [])];
      const first = focusable[0], last = focusable.at(-1);
      if (!first) { event.preventDefault(); return; }
      if (event.shiftKey && (document.activeElement === first || document.activeElement === dialog.current)) {
        event.preventDefault(); last?.focus();
      } else if (!event.shiftKey && (document.activeElement === last || document.activeElement === dialog.current)) {
        event.preventDefault(); first.focus();
      }
    };
    document.addEventListener('keydown', keydown);
    return () => { document.removeEventListener('keydown', keydown); previous?.focus(); };
  }, []);

  const move = (id: string, x: number, y: number) => {
    setDraft(prev => ({ ...prev, [id]: snapPosition(x, y) }));
    setError('');
  };
  const nudge = (dx: number, dy: number) => {
    if (selected && draft[selected]) move(selected, draft[selected].x + dx, draft[selected].y + dy);
  };
  const button: CSSProperties = { minHeight: 44, padding: '10px 14px', border: '2px solid #344762', background: '#17243a', color: '#e8f4f8', cursor: 'pointer', font: 'inherit' };

  return <div style={{ position: 'fixed', inset: 0, zIndex: 11000, background: 'rgba(3,8,18,.88)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 12 }}>
    <div ref={dialog} role="dialog" aria-modal="true" aria-labelledby="room-editor-title" tabIndex={-1}
      style={{ width: '100%', maxWidth: 560, maxHeight: 'calc(100dvh - 24px)', display: 'flex', flexDirection: 'column', border: `3px solid ${accent}`, boxShadow: `5px 5px 0 #050b16`, background: '#0a0e1a', color: '#e8f4f8', fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-body)", outline: 'none' }}>
      <div style={{ padding: '16px 18px', borderBottom: '2px solid #263752' }}>
        <h2 id="room-editor-title" style={{ fontSize: "var(--text-display)", color: accent, margin: '0 0 4px' }}>Arrange room</h2>
        <div style={{ color: '#a8bbcf' }}>{roomName}</div>
      </div>
      <div style={{ overflowY: 'auto', padding: 16, minHeight: 0 }}>
        <p style={{ margin: '0 0 14px', lineHeight: 1.5 }}>Drag furniture, or select an item and tap where you want it.</p>
        <style>{`.room-furniture-art > svg { width:100%; height:100%; flex-shrink:1; } .room-editor-item:focus-visible { outline:3px solid #fff; outline-offset:2px; }`}</style>
        <div ref={board} data-room-editor-board aria-label="Room placement area"
          onClick={event => {
            if (!selected || !board.current) return;
            const rect = board.current.getBoundingClientRect();
            // Centre the tap on the item: subtract half its box before converting to
            // the same 0-100 travel range `move`/`snapPosition` expect.
            move(selected, (event.clientX - rect.left - rect.width * (ITEM_WIDTH_PCT / 200)) / (rect.width * ITEM_TRAVEL_X) * 100,
              (event.clientY - rect.top - rect.height * (ITEM_HEIGHT_PCT / 200)) / (rect.height * ITEM_TRAVEL_Y) * 100);
          }}
          style={{ position: 'relative', aspectRatio: '1.6', backgroundColor: background, backgroundImage: `linear-gradient(#ffffff12 1px, transparent 1px), linear-gradient(90deg,#ffffff12 1px, transparent 1px)`, backgroundSize: `${ITEM_TRAVEL_X * 10}% ${ITEM_TRAVEL_Y * 10}%`, boxShadow: `inset 0 0 0 2px ${accent}66`, touchAction: 'none' }}>
          <RoomBackdrop style={roomStyle} background={background} accent={accent} />
          <div aria-hidden="true" style={{ position: 'absolute', inset: 0, pointerEvents: 'none', backgroundImage: 'linear-gradient(#ffffff12 1px, transparent 1px), linear-gradient(90deg,#ffffff12 1px, transparent 1px)', backgroundSize: `${ITEM_TRAVEL_X * 10}% ${ITEM_TRAVEL_Y * 10}%` }} />
          {items.map(item => <button key={item.id} type="button" aria-label={`Move ${item.name}`} aria-pressed={selected === item.id}
            className="room-editor-item room-furniture-art" data-editor-item={item.id}
            onClick={event => { event.stopPropagation(); setSelected(item.id); }}
            onKeyDown={event => {
              const delta: Record<string, [number, number]> = { ArrowLeft: [-10, 0], ArrowRight: [10, 0], ArrowUp: [0, -10], ArrowDown: [0, 10] };
              if (!delta[event.key]) return;
              event.preventDefault(); setSelected(item.id);
              move(item.id, draft[item.id].x + delta[event.key][0], draft[item.id].y + delta[event.key][1]);
            }}
            onPointerDown={event => {
              if (!event.isPrimary || event.button !== 0) return;
              event.stopPropagation(); setSelected(item.id);
              drag.current = { id: item.id, pointer: event.pointerId, startX: event.clientX, startY: event.clientY, origin: { ...draft[item.id] }, moved: false };
              event.currentTarget.setPointerCapture(event.pointerId);
            }}
            onPointerMove={event => {
              const active = drag.current;
              if (!active || active.pointer !== event.pointerId || !board.current) return;
              const dx = event.clientX - active.startX, dy = event.clientY - active.startY;
              if (!active.moved && Math.hypot(dx, dy) < 5) return;
              active.moved = true;
              const rect = board.current.getBoundingClientRect();
              move(active.id, active.origin.x + dx / (rect.width * ITEM_TRAVEL_X) * 100, active.origin.y + dy / (rect.height * ITEM_TRAVEL_Y) * 100);
            }}
            onPointerUp={event => { if (drag.current?.pointer === event.pointerId) drag.current = null; }}
            onPointerCancel={event => {
              const active = drag.current;
              if (active?.pointer === event.pointerId) { move(active.id, active.origin.x, active.origin.y); drag.current = null; }
            }}
            style={{ ...itemStyle(draft[item.id]), padding: 3, border: `2px solid ${selected === item.id ? accent : 'transparent'}`, background: selected === item.id ? `${accent}18` : 'transparent', cursor: 'grab', touchAction: 'none', zIndex: selected === item.id ? 3 : furnitureLayer(item.id), userSelect: 'none' }}>{item.art}</button>)}
        </div>
        <p style={{ margin: '12px 0 8px', color: accent }} aria-live="polite">{selectedItem ? `Selected: ${selectedItem.name}` : 'Buy furniture in the store to arrange your room.'}</p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }} aria-label="Your furniture">
          {items.map(item => <button key={item.id} onClick={() => setSelected(item.id)} aria-pressed={selected === item.id}
            style={{ ...button, borderColor: selected === item.id ? accent : '#344762', color: selected === item.id ? accent : '#e8f4f8' }}>{item.name}</button>)}
        </div>
        {selected && <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginTop: 14 }}>
          <span style={{ color: '#a8bbcf' }}>Fine-tune:</span>
          {([['Left', -10, 0, '←'], ['Up', 0, -10, '↑'], ['Down', 0, 10, '↓'], ['Right', 10, 0, '→']] as const).map(([label, x, y, arrow]) =>
            <button key={label} aria-label={`Move selected furniture ${label.toLowerCase()}`} style={{ ...button, minWidth: 44 }} onClick={() => nudge(x, y)}>{arrow}</button>)}
        </div>}
        {error && <p role="alert" style={{ color: '#ffb58a' }}>{error}</p>}
      </div>
      <div style={{ display: 'flex', gap: 12, padding: 16, borderTop: '2px solid #263752' }}>
        <button style={{ ...button, flex: 1 }} onClick={onCancel}>Cancel</button>
        <button style={{ ...button, flex: 1, color: '#07131a', background: accent, borderColor: accent, fontWeight: 'bold' }} onClick={() => {
          if (!onSave(reconcileLayout(items.map(i => i.id), draft))) setError('Your browser could not save this layout. Allow site storage and try again.');
        }}>Save layout</button>
      </div>
    </div>
  </div>;
}
