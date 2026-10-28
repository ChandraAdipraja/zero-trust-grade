import { env } from "../config/env";
import { POLICY_WINDOW } from "./constants";

export interface ZoneTime {
  hour: number;
  minute: number;
}

export function timeZoneNow(timezone: string, now = new Date()): ZoneTime {
  const formatter = new Intl.DateTimeFormat("en-GB", {
    timeZone: timezone,
    hour: "numeric",
    minute: "numeric",
    hourCycle: "h23",
  });
  const [hour, minute] = formatter.format(now).split(":").map((part) => Number.parseInt(part, 10));
  return { hour, minute };
}

export function isWithinAccessWindow(now = new Date(), timezone = env.accessTimezone): boolean {
  const { hour } = timeZoneNow(timezone, now);
  return hour >= POLICY_WINDOW.startHour && hour < POLICY_WINDOW.endHour;
}
