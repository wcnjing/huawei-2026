import { PixelLayer } from "../shared/PixelLayer";
import type { PixelMap, PixelPalette } from "../types";

const BODY: PixelMap = [
  "....................", "....................", "....................", "....................",
  ".......mmmmmm.......", "......mmmmmmmm......", ".....mmmmmmmmmm.....", ".....mmmmmmmmmm.....",
  ".....mmmmmmmmmm.....", ".....mmmmmmmmmm.....", ".....mmmmmmmmmm.....", ".....mmmmmmmmmm.....",
  "......mmmmmmmm......", ".......mmmmmm.......", "......ssmssmss......", ".....smssmmssms.....",
  "....smmsmmmmsmms....", "....smssmmmmssms....", "....smsmmmmmmsms....", "...smsmmmmmmmmsms...",
  "...smsmmmmmmmmsms...", "...smsmmmmmmmmsms...", "...smsmmmmmmmmsms...", "....ssmmmmmmmmss....",
  "......smmmmmms......", "......smm..mms......", "......sms..sms......", "......sms..sms......",
  "......sms..sms......", "......sms..sms......", "......sms..sms......", ".......ss..ss.......",
];

export function StandardBody({ palette }: { palette: PixelPalette }) {
  return <PixelLayer map={BODY} palette={palette} name="body-standard" />;
}

