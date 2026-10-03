import { PixelLayer } from "../shared/PixelLayer";
import type { PixelMap, PixelPalette } from "../types";

const BODY: PixelMap = [
  "....................", "....................", "....................", "....................",
  ".......mmmmmm.......", "......mmmmmmmm......", ".....mmmmmmmmmm.....", ".....mmermmermm.....",
  ".....mmeemmeemm.....", ".....mmmmmmmmmm.....", ".....mmfmmmmfmm.....", ".....mmmffffmmm.....",
  "......mmmmmmmm......", ".......mmmmmm.......", "......ssmssmss......", ".....smssmmssms.....",
  "....smmsmmmmsmms....", "....smssmmmmssms....", "....smsmmmmmmsms....", "...smsmmmmmmmmsms...",
  "...smsmmmmmmmmsms...", "...smsmmmmmmmmsms...", "...smsmmmmmmmmsms...", "....ssmmmmmmmmss....",
  "......smmmmmms......", "......smmssmms......", "......sms..sms......", "......sms..sms......",
  "......sms..sms......", "......sms..sms......", "......sms..sms......", "....................",
];

export function StandardBody({ palette }: { palette: PixelPalette }) {
  return <PixelLayer map={BODY} palette={palette} name="body-standard" />;
}
