import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
    base: './', // For GitHub Pages relative paths
    plugins: [
        VitePWA({
            registerType: 'autoUpdate',
            includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'mask-icon.svg'],
            manifest: {
                name: 'GlassDash - 家計簿アプリ',
                short_name: 'GlassDash',
                description: 'グラスニューモーフィズムデザインの家計簿アプリ',
                theme_color: '#0f0c29',
                background_color: '#0f0c29',
                display: 'standalone',
                icons: [
                    {
                        src: 'vite.svg',
                        sizes: '192x192',
                        type: 'image/svg+xml'
                    },
                    {
                        src: 'vite.svg',
                        sizes: '512x512',
                        type: 'image/svg+xml'
                    }
                ]
            }
        })
    ]
});
