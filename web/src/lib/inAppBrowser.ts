/**
 * Detects embedded "in-app" browsers (the webview shown when you tap a link inside Reddit,
 * Instagram, Facebook, etc.) — the single most likely reason a Reddit launch loses mobile users.
 *
 * Why this matters for QuickSign specifically: the whole product is camera-gated, and in-app
 * webviews (especially on iOS) frequently block or silently break `getUserMedia`. A user who taps
 * our Reddit link lands in that webview, hits the camera wall, and leaves — even though the app
 * works perfectly in real Safari/Chrome. Detecting this lets the landing page nudge them to open
 * in their real browser BEFORE they invest any time. We never block; the user can always continue.
 *
 * Detection is deliberately conservative (known in-app UA tokens + the missing-mediaDevices
 * signal). A false negative just means we don't show the banner (status quo); a false positive
 * would nag a fully-capable browser, so we keep the token list tight and specific.
 */

export interface InAppBrowserInfo {
  /** True when the current context looks like an embedded in-app webview. */
  isInApp: boolean;
  /** Human-friendly source name for the banner copy ("Reddit", "Instagram", …), or null. */
  appName: string | null;
  /** True when `navigator.mediaDevices.getUserMedia` isn't available at all — camera-gated flows
   *  cannot work here regardless of which app it is. A strong signal on its own. */
  cameraUnavailable: boolean;
}

// UA substring -> friendly name. Order matters only for display; any match flags in-app.
const IN_APP_TOKENS: ReadonlyArray<readonly [pattern: RegExp, name: string]> = [
  [/\bReddit\b/i, 'Reddit'],
  [/Instagram/i, 'Instagram'],
  [/\bFBAN\b|\bFBAV\b|FB_IAB|FBIOS/i, 'Facebook'],
  [/Messenger/i, 'Messenger'],
  [/\bLine\//i, 'LINE'],
  [/Snapchat/i, 'Snapchat'],
  [/TikTok|musical_ly|BytedanceWebview/i, 'TikTok'],
  [/\bTwitter\b/i, 'Twitter'],
  [/Pinterest/i, 'Pinterest'],
  [/GSA\//i, 'Google App'],
];

/** Inspect the current environment for an in-app webview. Pure over the passed UA + navigator, so
 *  it's trivially testable; defaults to the live browser globals. */
export function detectInAppBrowser(
  ua: string = typeof navigator !== 'undefined' ? navigator.userAgent : '',
  nav: { mediaDevices?: unknown } = typeof navigator !== 'undefined' ? navigator : {},
): InAppBrowserInfo {
  const match = IN_APP_TOKENS.find(([pattern]) => pattern.test(ua));
  const cameraUnavailable =
    !nav.mediaDevices ||
    typeof (nav.mediaDevices as { getUserMedia?: unknown }).getUserMedia !== 'function';
  return {
    isInApp: Boolean(match) || cameraUnavailable,
    appName: match ? match[1] : null,
    cameraUnavailable,
  };
}
