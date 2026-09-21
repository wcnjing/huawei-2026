import { Highlight } from "../../../types/drills";

export const SMS_INBOX_ITEMS = [
  { id: "parcelgo", sender: "ParcelGo Alert", preview: "Your parcel is on hold. Pay $1.99 redelivery fee…", time: "NOW", isScam: true },
  { id: "grandma", sender: "Grandma", preview: "Dinner at 7?", time: "2h" },
  { id: "school", sender: "School Admin", preview: "Reminder: class starts at 9AM.", time: "9h" },
  { id: "cyber", sender: "Cyber Tips", preview: "Never share OTPs with anyone.", time: "1d" },
];

export const SMS_LINES: { text: string; highlights?: Highlight[] }[] = [
  { text: "Your parcel is on hold due to incomplete address details." },
  { text: "Pay $1.99 redelivery fee before 11:59PM or your parcel will be returned.", highlights: [{ phrase: "Pay $1.99", flagId: "sms_payment" }, { phrase: "before 11:59PM", flagId: "sms_urgency" }] },
  { text: "Update now: http://parcelgo-redeliver.example", highlights: [{ phrase: "http://parcelgo-redeliver.example", flagId: "sms_link" }] },
];
