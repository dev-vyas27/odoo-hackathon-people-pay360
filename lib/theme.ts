

export type Theme = 'light' | 'dark' | 'system'

export const THEMES: Theme[] = ['light', 'dark', 'system']

export const THEME_STORAGE_KEY = 'peoplepay360-theme'

export const THEME_INIT_SCRIPT = `(function(){try{
var k=${JSON.stringify(THEME_STORAGE_KEY)};
var s=localStorage.getItem(k);
var t=(s==='light'||s==='dark'||s==='system')?s:'system';
var d=t==='dark'||(t==='system'&&window.matchMedia('(prefers-color-scheme: dark)').matches);
var r=document.documentElement;
r.classList.toggle('dark',d);
r.style.colorScheme=d?'dark':'light';
}catch(e){}})();`
