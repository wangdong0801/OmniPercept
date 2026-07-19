import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import fs from 'fs';
import {defineConfig} from 'vite';
import dotenv from 'dotenv';

dotenv.config();

export default defineConfig(() => {
  const shouldDisableHmr = process.env.DISABLE_HMR === 'true';

  return {
    plugins: [react(), tailwindcss()],
    define: {
      'process.env.GEMINI_API_KEY': JSON.stringify(process.env.GEMINI_API_KEY || ""),
      'process.env.EZVIZ_APP_KEY': JSON.stringify(process.env.EZVIZ_APP_KEY || ""),
      'process.env.EZVIZ_APP_SECRET': JSON.stringify(process.env.EZVIZ_APP_SECRET || ""),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      host: '0.0.0.0',
      port: 3000,
      allowedHosts: true,
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: !shouldDisableHmr,
      // Ignore runtime data writes so saving history does not trigger a full page refresh in dev mode.
      watch: shouldDisableHmr
        ? null
        : {
            ignored: ['**/data/**', '**/.runtime-data/**', '**/history.json', '**/.dbg/**'],
          },
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          const url = req.url || '';
          const cleanPath = url.split('?')[0];
          if (cleanPath.endsWith('.wasm')) {
            const workspaceRoot = process.cwd();
            const decodedPath = decodeURIComponent(cleanPath);
            const cleanRelative = decodedPath.startsWith('/') ? decodedPath.substring(1) : decodedPath;
            
            const searchPaths = [
              path.join(workspaceRoot, cleanRelative),
              path.join(workspaceRoot, 'public', cleanRelative),
              path.join(workspaceRoot, 'node_modules', 'ezuikit-js', cleanRelative),
              path.join(workspaceRoot, 'node_modules', 'ezuikit-js', 'ezuikit_static', cleanRelative),
              path.join(workspaceRoot, 'node_modules', '@ezuikit/player-ezopen', 'dist', cleanRelative),
            ];

            const playCtrlIndex = cleanRelative.indexOf('PlayCtrlWasm');
            if (playCtrlIndex !== -1) {
              const subPath = cleanRelative.substring(playCtrlIndex);
              searchPaths.push(path.join(workspaceRoot, 'node_modules', 'ezuikit-js', 'ezuikit_static', subPath));
              searchPaths.push(path.join(workspaceRoot, 'node_modules', '@ezuikit/player-ezopen', 'dist', subPath));
            }

            // Also check if playCtrl3 is in the path but PlayCtrlWasm is missing
            const playCtrl3Index = cleanRelative.indexOf('playCtrl3');
            if (playCtrl3Index !== -1 && playCtrlIndex === -1) {
              const subPath = 'PlayCtrlWasm/' + cleanRelative.substring(playCtrl3Index);
              searchPaths.push(path.join(workspaceRoot, 'node_modules', 'ezuikit-js', 'ezuikit_static', subPath));
              searchPaths.push(path.join(workspaceRoot, 'node_modules', '@ezuikit/player-ezopen', 'dist', subPath));
            }

            let foundPath = '';
            for (const p of searchPaths) {
              if (fs.existsSync(p) && fs.statSync(p).isFile()) {
                foundPath = p;
                break;
              }
            }

            if (foundPath) {
              try {
                const data = fs.readFileSync(foundPath);
                console.log('[WASM Middleware] Successfully serving WASM from:', foundPath);
                res.writeHead(200, {
                  'Content-Type': 'application/wasm',
                  'Content-Length': data.length,
                  'Cache-Control': 'no-cache',
                });
                res.end(data);
                return;
              } catch (err) {
                console.error('[WASM Middleware] Failed to serve WASM file directly:', foundPath, err);
              }
            } else {
              console.warn('[WASM Middleware] WASM file not found for URL:', url, 'Searched paths:', searchPaths);
            }
          }
          next();
        });
      },
    },
  };
});
