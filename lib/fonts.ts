

import localFont from 'next/font/local'

export const ltWave = localFont({
  src: [
    { path: '../public/fonts/LTWave-Thin.otf', weight: '100', style: 'normal' },
    { path: '../public/fonts/LTWave-ThinItalic.otf', weight: '100', style: 'italic' },
    { path: '../public/fonts/LTWave-Light.otf', weight: '300', style: 'normal' },
    { path: '../public/fonts/LTWave-LightItalic.otf', weight: '300', style: 'italic' },
    { path: '../public/fonts/LTWave-Regular.otf', weight: '400', style: 'normal' },
    { path: '../public/fonts/LTWave-Italic.otf', weight: '400', style: 'italic' },
    { path: '../public/fonts/LTWave-Medium.otf', weight: '500', style: 'normal' },
    { path: '../public/fonts/LTWave-MediumItalic.otf', weight: '500', style: 'italic' },
  ],
  variable: '--font-lt-wave',
  display: 'swap',
  
  adjustFontFallback: false,
  fallback: ['ui-sans-serif', 'system-ui', 'sans-serif'],
})
