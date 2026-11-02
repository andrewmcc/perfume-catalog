import type { MetadataRoute } from 'next';

// Keep in step with --color-paper / --color-oxblood in globals.css and the viewport themeColor in layout.tsx.
const PAPER = '#F5EEE0';
const OXBLOOD = '#6E2A2A';

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: '/today',
    name: 'Flacon',
    short_name: 'Flacon',
    description: 'Your perfume collection, catalogued.',
    start_url: '/today',
    scope: '/',
    lang: 'en-GB',
    display: 'standalone',
    background_color: PAPER,
    theme_color: OXBLOOD,
    icons: [
      { src: '/icon.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/apple-icon.png', sizes: '180x180', type: 'image/png', purpose: 'any' },
    ],
  };
}
