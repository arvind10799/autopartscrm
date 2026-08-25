const THEME_STORAGE_KEY = 'crm-theme';

export function ThemeInitScript() {
  return (
    <script
      dangerouslySetInnerHTML={{
        __html: `
          (function () {
            try {
              var theme = window.localStorage.getItem('${THEME_STORAGE_KEY}') || 'light';
              var resolvedTheme = theme === 'system'
                ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
                : theme;
              document.documentElement.classList.toggle('dark', resolvedTheme === 'dark');
              document.documentElement.style.colorScheme = resolvedTheme;
            } catch (_) {}
          })();
        `,
      }}
    />
  );
}
