import { useT } from "../../i18n";
import type { FamilyMember } from "../../types/family";
import { MemberChar } from "../../components/avatars";
import { RoomBackdrop } from "../../components/room";
import { IconCoin, IconShield } from "../../components/icons";
import { glow, ink, line } from "../../utils/color";

/**
 * Everyone in the house at once, like the tiles on a group video call: one small
 * room per member, with a name tag and their safety status. Tapping a tile opens
 * that member's profile, the same as tapping their full-size room.
 */
export function HouseGrid({ members, selfId, coinsFor, onTap }: {
  members: FamilyMember[];
  selfId: string;
  coinsFor: (member: FamilyMember) => number;
  onTap: (member: FamilyMember) => void;
}) {
  const t = useT();
  const odd = members.length % 2 === 1;
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, padding: "8px 12px 12px" }}>
      {members.map((member, i) => {
        const isSelf = member.id === selfId;
        const safeColor = member.safeThisWeek ? "var(--green)" : "var(--red)";
        // An odd last tile sits centred on its own row, as call grids do.
        const lone = odd && i === members.length - 1;
        return (
          <button
            key={member.id}
            onClick={() => onTap(member)}
            aria-label={t("View {name}'s room", { name: member.name })}
            style={{
              gridColumn: lone ? "1 / -1" : undefined, justifySelf: lone ? "center" : undefined,
              width: lone ? "calc(50% - 4px)" : "100%",
              position: "relative", aspectRatio: "1 / 1", overflow: "hidden", padding: 0, cursor: "pointer",
              backgroundColor: member.roomBg,
              border: `3px solid ${isSelf ? line(member.primaryColor) : "var(--border)"}`,
              boxShadow: isSelf ? glow(member.primaryColor, 10) : "none",
            }}
          >
            <RoomBackdrop style={member.roomStyle} background={member.roomBg} accent={member.primaryColor} />
            <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", paddingBottom: 18 }}>
              <div style={{ filter: `drop-shadow(${glow(member.primaryColor, 6)})` }}>
                <MemberChar member={member} size={72} />
              </div>
            </div>
            <div style={{ position: "absolute", top: 6, right: 6, display: "flex", alignItems: "center", gap: 3, padding: "2px 5px", backgroundColor: "color-mix(in srgb, var(--background) 85%, transparent)", border: `1px solid ${safeColor}` }}>
              <IconShield size={10} color={safeColor} />
              <span style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-caption)", color: safeColor }}>
                {member.safeThisWeek ? t("SAFE") : t("SCAMMED")}
              </span>
            </div>
            <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6, padding: "4px 6px", backgroundColor: "color-mix(in srgb, var(--background) 88%, transparent)" }}>
              <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-label)", color: ink(member.primaryColor) }}>
                {isSelf ? t("{name} (YOU)", { name: member.name }) : member.name}
              </span>
              <span style={{ flexShrink: 0, display: "inline-flex", alignItems: "center", gap: 3, fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-caption)", color: "var(--yellow)" }}>
                <IconCoin size={9} color="var(--yellow)" />{coinsFor(member).toLocaleString()}
              </span>
            </div>
          </button>
        );
      })}
    </div>
  );
}
