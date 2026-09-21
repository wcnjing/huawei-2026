import type { CSSProperties } from 'react';
import { DEFAULT_ROOM_STYLE, roomColors, type RoomStyle } from './room-style';
import './room-style.css';

export function RoomBackdrop({ style = DEFAULT_ROOM_STYLE, background, accent }: {
  style?: RoomStyle; background: string; accent: string;
}) {
  const colors = roomColors(style, background, accent);
  return <div aria-hidden="true" className="room-backdrop" data-room-wall={style.wall}
    data-room-pattern={style.pattern} data-room-floor={style.floor} data-room-light={style.light}
    style={{ '--room-wall': colors.wall, '--room-light': colors.light, '--room-floor': colors.floor } as CSSProperties}>
    <div className={`room-wall-pattern room-wall-${style.pattern}`} />
    {style.pattern === 'stars' && <div className="room-stars">
      {Array.from({ length: 15 }, (_, i) => <span key={i} style={{ left: `${5 + (i * 37) % 90}%`, top: `${10 + (i * 23) % 75}%` }} />)}
    </div>}
    {style.floor !== 'original' && <div className={`room-floor room-floor-${style.floor}`} />}
    {style.glow && <div className="room-neon-light" />}
  </div>;
}

