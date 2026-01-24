import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, (process as any).cwd(), '');
    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
      },
      plugins: [react()],
      define: {
        'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY || ''),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY || ''),
        'process.env.CLOUDINARY_CLOUD_NAME': JSON.stringify(env.CLOUDINARY_CLOUD_NAME || ''),
        'process.env.CLOUDINARY_UPLOAD_PRESET': JSON.stringify(env.CLOUDINARY_UPLOAD_PRESET || '')
      },
      resolve: {
        alias: {
          '@': path.resolve((process as any).cwd(), '.'),
        }
      }
    };
});