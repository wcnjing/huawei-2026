import { useEffect, useState, type ReactNode } from "react";
import { loadAccessibility } from "../../services/storage";

// Walks a character around the floor of a room like a pet: pick a random spot, walk
// there, pause, repeat. `depth` 0 is the back of the floor (higher up, slightly smaller),
// 1 the front. Purely decorative, so it ignores pointer events (taps reach the room
// underneath) and stands still in the middle when the player asked for reduced motion.
type Spot = { x: number; depth: number };

const WALK_SPEED = 12; // % of the room's width per second
const START: Spot = { x: 50, depth: 1 };

export function RoomWanderer({ character, above, below, back, front, minX = 18, maxX = 82 }: {
  /** Flipped to face the way it walks, and bobs while walking. */
  character: ReactNode;
  /** Carried along unflipped, e.g. a badge above the head and a name below the feet. */
  above?: ReactNode; below?: ReactNode;
  /** CSS `bottom` of the whole group at the back and at the front of the floor. */
  back: string; front: string;
  /** Range of the group's centre, in % of the room's width. */
  minX?: number; maxX?: number;
}) {
  const reduceMotion = loadAccessibility().reduceMotion
    || (typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches);
  const [spot, setSpot] = useState<Spot>(START);
  const [walkMs, setWalkMs] = useState(0);
  const [facing, setFacing] = useState<1 | -1>(1);

  useEffect(() => {
    setSpot(START);
    setWalkMs(0);
    if (reduceMotion) return;
    let current = START;
    let timer: number;
    const walk = () => {
      const next = { x: minX + Math.random() * (maxX - minX), depth: Math.random() };
      // The floor is shallow compared with its width, so depth counts as a short distance.
      const distance = Math.hypot(next.x - current.x, (next.depth - current.depth) * 25);
      const ms = Math.round(Math.max(700, (distance / WALK_SPEED) * 1000));
      if (Math.abs(next.x - current.x) > 1) setFacing(next.x > current.x ? 1 : -1);
      setWalkMs(ms);
      setSpot(next);
      current = next;
      timer = window.setTimeout(() => {
        setWalkMs(0);
        timer = window.setTimeout(walk, 1500 + Math.random() * 3500);
      }, ms);
    };
    timer = window.setTimeout(walk, 800 + Math.random() * 2000);
    return () => window.clearTimeout(timer);
  }, [reduceMotion, minX, maxX]);

  const walking = walkMs > 0;
  const motion = walking ? `${walkMs}ms linear` : "0ms";
  return (
    <div
      className="room-wanderer"
      style={{
        left: `${spot.x}%`,
        bottom: `calc(${back} + (${front} - ${back}) * ${spot.depth})`,
        transform: `translateX(-50%) scale(${0.82 + 0.18 * spot.depth})`,
        transition: `left ${motion}, bottom ${motion}, transform ${motion}`,
      }}
    >
      {above}
      <div style={{ transform: `scaleX(${facing})` }}>
        <div className={walking ? "room-wanderer-walking" : undefined}>{character}</div>
      </div>
      {below}
    </div>
  );
}
