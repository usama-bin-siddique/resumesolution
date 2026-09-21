import {defineConfig} from 'astro/config';
import react from '@astrojs/react';
import {localAPI} from './scripts/local-api.mjs';
export default defineConfig({integrations:[react()],outDir:'./dist/client',vite:{plugins:[localAPI()],optimizeDeps:{include:['@react-pdf/renderer','mammoth']},build:{chunkSizeWarningLimit:1200}}});
