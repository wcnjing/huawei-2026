import { useT } from '../../i18n';
import { useState, type ReactNode } from 'react';
import { RoomFurnitureLayer, type RoomFurniture } from './RoomEditor';
import type { RoomLayout } from '../../types/roomLayout';
import {
  FLOORS, ROOM_LIGHTS, ROOM_PRESETS, WALL_COLORS, WALL_PATTERNS,
  normalizeRoomStyle, roomColors, type RoomStyle,
} from '../../types/roomStyle';
import { RoomBackdrop } from './RoomBackdrop';

export function RoomStyleEditor({ value, background, accent, defaultName, items, layout, avatar, onSave }: {
  value: RoomStyle; background: string; accent: string; defaultName: string;
  items: RoomFurniture[]; layout?: RoomLayout; avatar: ReactNode;
  onSave: (style: RoomStyle) => boolean;
}) {
  const t = useT();
  const [draft, setDraft] = useState<RoomStyle>(() => ({ ...value }));
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const normalized = normalizeRoomStyle(draft);
  const dirty = JSON.stringify(normalized) !== JSON.stringify(value);
  const colors = roomColors(draft, background, accent);
  function change(patch: Partial<RoomStyle>) {
    setDraft(previous => ({ ...previous, ...patch }));
    setMessage(''); setError('');
  }
  return <section className="room-style-editor" aria-label={t('Room appearance')}>
    <div className="room-style-intro">
      <h2>{t('Make it yours')}</h2>
      <p>{t('Mix walls, floors and neon lights. All styles are free.')}</p>
    </div>
    <div className="room-style-preview" aria-label={t('Room appearance preview')} style={{ borderColor: colors.light }}>
      <RoomBackdrop style={draft} background={background} accent={accent} />
      <div className="room-style-preview-name" style={{ color: colors.light }}>{normalized.name || defaultName}</div>
      <div className="room-style-preview-furniture"><RoomFurnitureLayer items={items} layout={layout} /></div>
      <div className="room-style-preview-avatar">{avatar}</div>
      <span className="room-style-preview-tag">{t('PREVIEW')}</span>
    </div>
    <label className="room-name-label" htmlFor="room-name">{t('Room name')}</label>
    <input id="room-name" maxLength={32} value={draft.name} placeholder={defaultName}
      onChange={event => change({ name: event.target.value })} aria-describedby="room-name-help" />
    <p id="room-name-help" className="room-style-help">{t('Leave blank to use your player name.')}</p>

    <fieldset><legend>{t('Start with a theme')}</legend><div className="room-style-options">
      {ROOM_PRESETS.map(preset => {
        const selected = (['wall', 'pattern', 'floor', 'light', 'glow'] as const).every(key => draft[key] === preset.style[key]);
        return <button type="button" key={preset.id} aria-pressed={selected}
          onClick={() => change({ ...preset.style, name: draft.name })}>
          <span className="room-preset-swatch"><RoomBackdrop style={{ ...preset.style, name: '' }} background={background} accent={accent} /></span>
          <span>{t(preset.name)}</span><span className="room-option-check" aria-hidden="true">{selected ? '✓' : ''}</span>
        </button>;
      })}
    </div></fieldset>

    <fieldset><legend>{t('Wall color')}</legend><div className="room-style-options">
      {WALL_COLORS.map(option => <button key={option.id} type="button" aria-pressed={draft.wall === option.id} onClick={() => change({ wall: option.id })}>
        <span className="room-color-swatch" style={{ background: option.color || background }} />
        <span>{t(option.name)}</span><span className="room-option-check" aria-hidden="true">{draft.wall === option.id ? '✓' : ''}</span>
      </button>)}
    </div></fieldset>

    <fieldset><legend>{t('Wallpaper')}</legend><div className="room-style-options">
      {WALL_PATTERNS.map(option => <button key={option.id} type="button" aria-pressed={draft.pattern === option.id} onClick={() => change({ pattern: option.id })}>
        <span>{t(option.name)}</span><span className="room-option-check" aria-hidden="true">{draft.pattern === option.id ? '✓' : ''}</span>
      </button>)}
    </div></fieldset>

    <fieldset><legend>{t('Flooring')}</legend><div className="room-style-options">
      {FLOORS.map(option => <button key={option.id} type="button" aria-pressed={draft.floor === option.id} onClick={() => change({ floor: option.id })}>
        <span className="room-preset-swatch"><RoomBackdrop style={{ ...draft, pattern: 'plain', floor: option.id, glow: false }} background={background} accent={accent} /></span>
        <span>{t(option.name)}</span><span className="room-option-check" aria-hidden="true">{draft.floor === option.id ? '✓' : ''}</span>
      </button>)}
    </div></fieldset>

    <fieldset><legend>{t('Neon light')}</legend><div className="room-style-options">
      {ROOM_LIGHTS.map(option => <button key={option.id} type="button" aria-pressed={draft.light === option.id}
        onClick={() => change({ light: option.id, glow: true })}>
        <span className="room-color-swatch" style={{ background: option.color || accent }} />
        <span>{t(option.name)}</span><span className="room-option-check" aria-hidden="true">{draft.light === option.id ? '✓' : ''}</span>
      </button>)}
    </div>
      <label className="room-glow-toggle"><input type="checkbox" checked={draft.glow} onChange={event => change({ glow: event.target.checked })} />{t('Neon glow')}</label>
    </fieldset>

    <div className="room-style-actions">
      <button type="button" disabled={!dirty} className="room-save" onClick={() => {
        if (!onSave(normalized)) { setError(t('Could not save your room. Allow site storage and try again.')); return; }
        setDraft(normalized); setError(''); setMessage(t('Room style saved.'));
      }}>{t('Save style')}</button>
      <button type="button" disabled={!dirty} onClick={() => { setDraft({ ...value }); setError(''); setMessage(t('Changes discarded.')); }}>{t('Cancel changes')}</button>
    </div>
    <div className="room-save-message" role="status">{message || (dirty ? t('Unsaved changes') : '')}</div>
    {error && <p role="alert" className="room-style-error">{error}</p>}
  </section>;
}
