/**
 * Theme selection: light, dark, or follow the operating system.
 *
 * Deliberately not a dependency. The whole mechanism is a class on <html>, a
 * string in localStorage and one media query — `next-themes` is a fine library
 * but it would be the only thing in this project we could not read end to end,
 * for about forty lines of behaviour.
 *
 * ── Why a blocking script ──────────────────────────────────────────────────
 *
 * The theme cannot be applied by React. The server does not know which theme
 * this browser chose — localStorage is not sent with the request — so the HTML
 * arrives with no class, and by the time an effect could add one the browser
 * has already painted. On a dark-mode machine that is a full-brightness white
 * flash on every navigation, which is exactly the thing people turn dark mode
 * on to avoid.
 *
 * So the class is set by a synchronous script in <head>, before the body is
 * parsed and before first paint. React never renders theme-dependent markup;
 * it only reads what the script decided.
 */

export type Theme = 'light' | 'dark' | 'system'

export const THEMES: Theme[] = ['light', 'dark', 'system']

export const THEME_STORAGE_KEY = 'peoplepay360-theme'

/**
 * Runs before first paint. Kept small, defensive and dependency-free — it
 * executes before anything else on the page, so a throw here would be a blank
 * screen. Every access is wrapped: localStorage throws outright in some
 * privacy modes rather than returning null.
 */
export const THEME_INIT_SCRIPT = `(function(){try{
var k=${JSON.stringify(THEME_STORAGE_KEY)};
var s=localStorage.getItem(k);
var t=(s==='light'||s==='dark'||s==='system')?s:'system';
var d=t==='dark'||(t==='system'&&window.matchMedia('(prefers-color-scheme: dark)').matches);
var r=document.documentElement;
r.classList.toggle('dark',d);
r.style.colorScheme=d?'dark':'light';
}catch(e){}})();`
