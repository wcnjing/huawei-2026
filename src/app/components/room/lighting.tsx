import { createContext, useContext } from 'react';
import { useTheme } from '../../theme/ThemeProvider';
import { roomTime, type RoomStyle, type RoomTime } from '../../types/roomStyle';

/*
 * Day and night rooms (ROOM_LIGHTING_MODE in types/roomStyle.ts). A room works out whether it is
 * day or night for whoever is looking, then:
 *   - its outer box gets roomScope(time): data-theme, so the room's own buttons, labels and
 *     icons use the light tokens in a day room and the dark ones at night, whatever the app
 *     theme is; and data-room-time for the room CSS
 *   - RoomBackdrop draws the day or night wallpaper and floor (room-style.css)
 *   - <RoomTimeProvider> tells the pieces inside, so window furniture shows a day sky
 */

const RoomTimeContext = createContext<RoomTime | null>(null);
/** Wrap a room's contents so the furniture inside knows if it's day or night. */
export const RoomTimeProvider = RoomTimeContext.Provider;
/** Day or night for the room this is drawn in, or null outside a room. */
export function useRoomTimeContext() { return useContext(RoomTimeContext); }

/** Day or night for this room, for the person looking (their theme). */
export function useRoomTime(style?: Pick<RoomStyle, 'lighting'>): RoomTime {
  const { theme } = useTheme();
  return roomTime(style, theme);
}

/** The roof (and the house's title row) follows the viewer's theme, whatever the rooms under
 *  it are set to: a day roof in light, a night roof in dark (always night in 'night' mode). */
export function useRoofTime(): RoomTime {
  const { theme } = useTheme();
  return roomTime(undefined, theme);
}

/** Attributes for a room's outer box: its colour tokens follow the room, not the app. */
export function roomScope(time: RoomTime) {
  // A day room uses the light palette the app is set to (data-palette sits on <html>).
  const palette = typeof document !== 'undefined' ? document.documentElement.dataset.palette : undefined;
  return time === 'day'
    ? { 'data-theme': 'light', 'data-palette': palette, 'data-room-time': 'day' } as const
    : { 'data-theme': 'dark', 'data-room-time': 'night' } as const;
}
