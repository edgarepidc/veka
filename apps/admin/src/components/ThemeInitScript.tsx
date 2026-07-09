import { THEME_STORAGE_KEY } from '@/lib/theme';

/** Inline script to apply theme before paint and avoid flash. */
export function ThemeInitScript() {
  const script = `(function(){try{var k=${JSON.stringify(THEME_STORAGE_KEY)};var s=localStorage.getItem(k);var p=s==='light'||s==='dark'||s==='system'?s:'light';var m=p==='system'?(window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'):p;document.documentElement.setAttribute('data-theme',m);}catch(e){document.documentElement.setAttribute('data-theme','light');}})();`;

  return <script dangerouslySetInnerHTML={{ __html: script }} />;
}
