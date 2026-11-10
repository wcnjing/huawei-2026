import type { CSSProperties } from 'react';
import { DEFAULT_ROOM_STYLE, roomColors, type RoomStyle, type RoomTime } from '../../types/roomStyle';
import { useRoomTime, useRoomTimeContext } from './lighting';

/**
 * A room's wallpaper, floor and neon strip. `time` picks day or night; without it the backdrop
 * uses the room it sits in (RoomTimeProvider), or else works it out from the style's Lighting
 * and the viewer's theme. Day styles are in room-style.css under [data-room-time="day"].
 */
export function RoomBackdrop({ style = DEFAULT_ROOM_STYLE, background, accent, time }: {
  style?: RoomStyle; background: string; accent: string; time?: RoomTime;
}) {
  const inRoom = useRoomTimeContext();
  const own = useRoomTime(style);
  const when = time ?? inRoom ?? own;
  const colors = roomColors(style, background, accent, when);
  return <div aria-hidden="true" className="room-backdrop" data-room-time={when} data-room-wall={style.wall}
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
