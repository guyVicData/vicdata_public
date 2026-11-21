// 0.8 front door part 3 (E24): what a signed-out device's next sign-in page says. Client-safe (no imports).
export const SIGNED_OUT_WORDS = {
  here: "You signed out.",
  elsewhere: "You signed this device out from another one.",
  all: "You signed out of all your devices.",
  cap: "You were signed out here because your account signed in on another device.",
  admin: "Your School-Admin signed you out here.",
  platform: "VicData signed you out here.",
} as const;
