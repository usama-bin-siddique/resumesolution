import {defineConfig} from 'astro/config';
import react from '@astrojs/react';
const localGuestAPI={name:'globalcv-local-guest-api',configureServer(server){server.middlewares.use((req,res,next)=>{if(req.url==='/api/me'){res.setHeader('Content-Type','application/json');res.end(JSON.stringify({user:null}));return;}if(req.url?.startsWith('/api/')){res.statusCode=503;res.setHeader('Content-Type','application/json');res.end(JSON.stringify({error:'Account drafts become available on the hosted website. Guest editing and downloads work in this preview.'}));return;}next();});}};
export default defineConfig({integrations:[react()],outDir:'./dist/client',vite:{plugins:[localGuestAPI],optimizeDeps:{include:['@react-pdf/renderer','mammoth']},build:{chunkSizeWarningLimit:1200}}});
