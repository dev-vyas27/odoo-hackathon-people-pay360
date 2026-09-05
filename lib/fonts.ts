/**
 * LT Wave — the brand face.
 *
 * NOTE for anyone touching typography: this family ships Thin(100), Light(300),
 * Regular(400) and Medium(500). There is NO bold. Do not reach for font-bold /
 * font-semibold — the browser will synthesise a smeared faux-bold that looks
 * broken next to the real weights.
 *
 * Build hierarchy with SIZE, COLOR and TRACKING instead; `font-medium` (500) is
 * the heaviest emphasis available. See components/ui/typography guidance.
 */
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
  // Stop the browser inventing weights the family does not have.
  adjustFontFallback: false,
  fallback: ['ui-sans-serif', 'system-ui', 'sans-serif'],
})
