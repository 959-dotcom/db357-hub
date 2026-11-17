import { DMCK_LAUNCH_PATH } from "@/lib/dmckHandoff";
import { landLaunchHref } from "@/lib/landHandoff";

/** Land stays on its handoff. DM-CK uses its own. Every other desk stays a plain link. */
export function deskLaunchHref(key: string, href: string): string {
  if (key === "dmck") return DMCK_LAUNCH_PATH;
  return landLaunchHref(key, href);
}
