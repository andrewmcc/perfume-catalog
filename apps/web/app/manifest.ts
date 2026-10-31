import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Perfume spike',
    short_name: 'Perfume spike',
    start_url: '/spike/capture',
    display: 'standalone',
    background_color: '#000000',
    theme_color: '#000000',
    icons: [{ src: '/icon.svg', sizes: 'any', type: 'image/svg+xml' }],
  };
}
