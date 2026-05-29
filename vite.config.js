import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        login: resolve(__dirname, 'login.html'),
        panel: resolve(__dirname, 'panel.html'),
        booking: resolve(__dirname, 'booking.html'),
        onboarding: resolve(__dirname, 'onboarding.html'),
      },
    },
  },
});
