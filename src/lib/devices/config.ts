// 0.8 front door part 3 (E24): the device rules' numbers, in one place.

/** How many devices may be signed in at once, per kind of account. Signing in on one more signs out the oldest
 * (R-DEVICE-CAP). Staff is the prompt's 3; a platform admin moves between more browsers (View as, peeks); the
 * preview account is shared by automated agents and the warm-up script. */
export const DEVICE_CAP = { staff: 3, platform_admin: 5, preview: 10 } as const;
export type AccountKind = keyof typeof DEVICE_CAP;

/** A device that has passed a code is trusted this long (R-DEVICE-CODES). */
export const TRUST_DAYS = 60;
/** A code lasts this long, and allows this many wrong tries. */
export const CODE_MINUTES = 10;
export const CODE_MAX_ATTEMPTS = 5;
/** A new code no sooner than this after the last one, and no more than this many an hour, per device. */
export const CODE_RESEND_SECONDS = 60;
export const CODE_MAX_PER_HOUR = 5;
/** A brand-new account's first device is trusted without a code (it was made there, by invitation) when the
 * account is younger than this and has no device yet. */
export const NEW_ACCOUNT_MINUTES = 30;

/** The quiet alert: one account used from more than PLACES places within HOURS hours. */
export const PLACES_ALERT = { places: 4, hours: 24 } as const;

/** The gate remembers a session's device row this long (a sign-out elsewhere takes effect within it). */
export const GATE_CACHE_SECONDS = 30;
/** "Last active" is written at most this often per device. */
export const TOUCH_MINUTES = 5;

/** The browser's device cookie: an opaque random token, httpOnly; the table holds its SHA-256. */
export const DEVICE_COOKIE = "vicdata_device";
export const DEVICE_COOKIE_DAYS = 400;
/** A one-line notice for the next page (e.g. the cap signed another device out). Readable by the page. */
export const NOTICE_COOKIE = "vicdata_notice";

/** Device codes are off unless DEVICE_CODES=on (Q5: no email provider yet). */
export const deviceCodesOn = () => process.env.DEVICE_CODES === "on";
/** The gate's device check is on unless DEVICE_SESSIONS=off (an emergency switch, never the default). */
export const deviceSessionsOn = () => process.env.DEVICE_SESSIONS !== "off";
