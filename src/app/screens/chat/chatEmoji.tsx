import { Fragment, useMemo, type KeyboardEvent, type ReactNode, type Ref } from "react";
import { useT } from "../../i18n";
import { useMembers } from "../../hooks/useMembers";
import type { Avatar } from "../../services/house";
import { CharacterAvatar, DEFAULT_AVATAR_CONFIG, PixelMascot, PixiAvatar, normalizeAvatarConfig } from "../../components/avatars";
import {
  IconBadge, IconBell, IconBulb, IconChatBubble, IconCheck, IconCoin, IconEnvelope, IconEyeInspect,
  IconFamily, IconFlame, IconHouse, IconLock, IconMedal, IconMoon, IconPhone, IconReportFlag,
  IconShield, IconSkull, IconStar, IconSun, IconTree, IconTrophy, IconWarning, IconX,
} from "../../components/icons";

/*
 * Custom emojis for the house chat. A message holds them as short codes between colons
 * (":shield:", ":pixi:", ":head-3f2a9c1b:"), so the server stores plain text as before; the
 * bubbles draw each code the app knows as its picture, and leave anything else as typed.
 * server/chat-emoji.js has the same codes (and their meanings, for Pixi).
 *
 * Colours are each icon's usual one for now; the look and the list are a first draft.
 */

export type ChatEmoji = {
  code: string;
  /** English name, translated with t() where it's shown (a member's head is already in words). */
  name: string;
  draw(size: number): ReactNode;
};

/** Pixi's head and the leaderboard mascot. */
export const PIXI_EMOJI: ChatEmoji[] = [
  { code: "pixi", name: "Pixi", draw: (s) => <PixiAvatar size={s} /> },
  { code: "mascot", name: "Mascot", draw: (s) => <PixelMascot size={s} /> },
];

/** The app's own pixel icons that make sense in a chat. */
export const ICON_EMOJI: ChatEmoji[] = [
  { code: "shield", name: "Shield", draw: (s) => <IconShield size={s} /> },
  { code: "trophy", name: "Trophy", draw: (s) => <IconTrophy size={s} /> },
  { code: "medal", name: "Medal", draw: (s) => <IconMedal rank={1} size={s} /> },
  { code: "star", name: "Star", draw: (s) => <IconStar size={s} /> },
  { code: "flame", name: "Flame", draw: (s) => <IconFlame size={s} /> },
  { code: "coin", name: "Coin", draw: (s) => <IconCoin size={s} /> },
  { code: "bulb", name: "Light bulb", draw: (s) => <IconBulb size={s} /> },
  { code: "tick", name: "Tick", draw: (s) => <IconCheck size={s} /> },
  { code: "cross", name: "Cross", draw: (s) => <IconX size={s} /> },
  { code: "warning", name: "Warning", draw: (s) => <IconWarning size={s} /> },
  { code: "skull", name: "Skull", draw: (s) => <IconSkull size={s} /> },
  { code: "flag", name: "Flag", draw: (s) => <IconReportFlag size={s} /> },
  { code: "lock", name: "Lock", draw: (s) => <IconLock size={s} color="var(--teal)" /> },
  { code: "eye", name: "Eye", draw: (s) => <IconEyeInspect size={s} /> },
  { code: "house", name: "House", draw: (s) => <IconHouse size={s} /> },
  { code: "family", name: "Family", draw: (s) => <IconFamily size={s} /> },
  { code: "bell", name: "Bell", draw: (s) => <IconBell size={s} /> },
  { code: "phone", name: "Phone", draw: (s) => <IconPhone size={s} /> },
  { code: "email", name: "Email", draw: (s) => <IconEnvelope size={s} /> },
  { code: "chat", name: "Chat", draw: (s) => <IconChatBubble size={s} /> },
  { code: "sun", name: "Sun", draw: (s) => <IconSun size={s} /> },
  { code: "moon", name: "Moon", draw: (s) => <IconMoon size={s} /> },
  { code: "tree", name: "Tree", draw: (s) => <IconTree size={s} /> },
  { code: "badge", name: "Badge", draw: (s) => <IconBadge size={s} /> },
];

/** A member's head: "head-" and the first 8 letters or digits of their id. Same as the server's. */
export function headCode(id: string) {
  return `head-${id.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 8)}`;
}

/** A code in text. Starting with a letter keeps times like "10:30:45" out of it. */
const CODE_RE = /:([a-z][a-z0-9-]{1,31}):/g;

const FIXED = new Map([...PIXI_EMOJI, ...ICON_EMOJI].map((e) => [e.code, e]));

const head = (name: string, config: Parameters<typeof CharacterAvatar>[0]["config"]): ChatEmoji["draw"] =>
  (s) => <CharacterAvatar size={s} variant="head" config={config} title={name} />;

export type EmojiSection = { id: "house" | "pixi" | "icons"; title: string; items: ChatEmoji[] };

/**
 * The emojis this house can use: everyone's head (as they look now), Pixi and the icons.
 * `senders` are people who have sent a message here, so the head of someone who has since
 * left still draws (with the look they had then) instead of falling back to a plain head.
 */
export function useChatEmoji(senders: { senderId: string | null; senderName: string; senderAvatar: Avatar | null }[] = []) {
  const t = useT();
  const members = useMembers();
  return useMemo(() => {
    // "Pixi" is a name, the same in every language.
    const named = (e: ChatEmoji): ChatEmoji => (e.code === "pixi" ? e : { ...e, name: t(e.name) });
    const heads = members.map((m) => {
      const name = t("{name}'s head", { name: m.name });
      return { code: headCode(m.id), name, draw: head(name, m.avatar) };
    });
    const known = new Map<string, ChatEmoji>(heads.map((e) => [e.code, e]));
    for (const s of senders) {
      if (!s.senderId || !s.senderAvatar) continue;
      const code = headCode(s.senderId);
      if (known.has(code)) continue;
      const name = t("{name}'s head", { name: s.senderName });
      known.set(code, { code, name, draw: head(name, normalizeAvatarConfig(s.senderAvatar)) });
    }
    const lookup = (code: string): ChatEmoji | null => {
      const fixed = FIXED.get(code);
      if (fixed) return named(fixed);
      if (known.has(code)) return known.get(code)!;
      if (code.startsWith("head-")) return { code, name: t("Head"), draw: head(t("Head"), DEFAULT_AVATAR_CONFIG) };
      return null;
    };
    const sections: EmojiSection[] = [
      { id: "house", title: t("HOUSE"), items: heads },
      { id: "pixi", title: "PIXI", items: PIXI_EMOJI.map(named) },
      { id: "icons", title: t("ICONS"), items: ICON_EMOJI.map(named) },
    ];
    return { sections, lookup };
  }, [members, senders, t]);
}

export const INLINE_EMOJI = 20;
export const BIG_EMOJI = 40;
/** A message that is only this many emojis (or fewer) shows them big, like a sticker. */
const BIG_MAX = 3;

function Glyph({ emoji, size }: { emoji: ChatEmoji; size: number }) {
  return (
    <span className="chat-emoji" role="img" aria-label={emoji.name} title={emoji.name} style={{ width: size, height: size }}>
      <span aria-hidden="true">{emoji.draw(size)}</span>
    </span>
  );
}

/**
 * A message's text with each known code drawn as its emoji. `big` is true when the message
 * is only 1 to 3 emojis, so the bubble can show them large.
 */
export function renderChatText(text: string, lookup: (code: string) => ChatEmoji | null): { nodes: ReactNode[]; big: boolean } {
  const parts: ({ text: string } | { emoji: ChatEmoji })[] = [];
  let last = 0;
  for (const match of text.matchAll(CODE_RE)) {
    const emoji = lookup(match[1]);
    if (!emoji) continue;
    const at = match.index ?? 0;
    if (at > last) parts.push({ text: text.slice(last, at) });
    parts.push({ emoji });
    last = at + match[0].length;
  }
  if (last < text.length) parts.push({ text: text.slice(last) });
  const emojis = parts.filter((p) => "emoji" in p).length;
  const big = emojis > 0 && emojis <= BIG_MAX && parts.every((p) => "emoji" in p || !p.text.trim());
  // Big emojis sit in a flex row with a gap, so the spaces between them are left out.
  const nodes = parts.flatMap((p, i) => ("emoji" in p
    ? [<Glyph key={i} emoji={p.emoji} size={big ? BIG_EMOJI : INLINE_EMOJI} />]
    : big ? [] : [<Fragment key={i}>{p.text}</Fragment>]));
  return { nodes, big };
}

/**
 * The pop-up: one grid per section. Tapping an emoji calls onPick(code) and leaves the pop-up
 * open, so several can be added; Escape closes it (onClose(true) puts focus back on the button).
 */
export function EmojiPicker({ id, sections, onPick, onClose, panelRef }: {
  id: string;
  sections: EmojiSection[];
  onPick(code: string): void;
  onClose(returnFocus: boolean): void;
  panelRef?: Ref<HTMLDivElement>;
}) {
  const t = useT();
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "Escape") return;
    event.stopPropagation();
    onClose(true);
  };
  return (
    <div ref={panelRef} id={id} className="house-chat__emoji-panel" role="dialog" aria-label={t("Emoji")} onKeyDown={onKeyDown}>
      {sections.filter((s) => s.items.length > 0).map((s) => (
        <section key={s.id} className="house-chat__emoji-section" aria-labelledby={`${id}-${s.id}`}>
          <h2 id={`${id}-${s.id}`}>{s.title}</h2>
          <div className="house-chat__emoji-grid">
            {s.items.map((item) => (
              <button
                key={item.code}
                type="button"
                className="house-chat__emoji-option"
                aria-label={item.name}
                title={item.name}
                onClick={() => onPick(item.code)}
              >
                <span aria-hidden="true">{item.draw(26)}</span>
              </button>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
