import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import fs from 'fs';
import path from 'path';
import {defineConfig, Plugin} from 'vite';

// LINT.IfChange(aistudio_media_plugin)
function aistudioMediaPlugin(): Plugin {
  return {
    name: 'vite-plugin-aistudio-media',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (req.url && req.url.startsWith('/assets/aistudio/')) {
          const rawPath = req.url.split('?')[0].split('#')[0];
          try {
            const decodedPath = decodeURIComponent(rawPath);
            const relativePath = decodedPath.replace(/^\//, '');
            const aistudioDir = path.resolve(
              __dirname,
              'public',
              'assets',
              'aistudio',
            );
            const filePath = path.resolve(__dirname, 'public', relativePath);
            if (
              filePath.startsWith(aistudioDir + path.sep) &&
              fs.existsSync(filePath) &&
              fs.statSync(filePath).isFile()
            ) {
              const ext = path.extname(filePath).toLowerCase();
              const mimeMap: Record<string, string> = {
                '.jpg': 'image/jpeg',
                '.jpeg': 'image/jpeg',
                '.png': 'image/png',
                '.gif': 'image/gif',
                '.webp': 'image/webp',
                '.svg': 'image/svg+xml',
                '.bmp': 'image/bmp',
                '.ico': 'image/x-icon',
                '.mp4': 'video/mp4',
                '.webm': 'video/webm',
                '.ogv': 'video/ogg',
                '.mp3': 'audio/mpeg',
                '.wav': 'audio/wav',
                '.ogg': 'audio/ogg',
                '.pdf': 'application/pdf',
              };
              res.setHeader(
                'Content-Type',
                mimeMap[ext] || 'application/octet-stream',
              );
              res.setHeader('Cache-Control', 'no-cache');
              fs.createReadStream(filePath).pipe(res);
              return;
            }
          } catch {
            // Fall through if URI decoding or file access fails
          }
        }
        next();
      });
    },
  };
}
// LINT.ThenChange(//depot/google3/java/com/google/alkali/boq/makersuite/applet_dev_service/templates/initializers/react_theme/vite.config.ts:aistudio_media_plugin)

function planConfigApiPlugin(): Plugin {
  return {
    name: 'vite-plugin-plan-config-api',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (req.url && (req.url === '/api/config' || req.url.startsWith('/api/config?'))) {
          const configPath = path.resolve(__dirname, 'public', 'plan_config.json');

          if (req.method === 'GET') {
            try {
              if (fs.existsSync(configPath)) {
                const content = fs.readFileSync(configPath, 'utf-8');
                res.setHeader('Content-Type', 'application/json');
                res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
                res.end(content);
                return;
              }
            } catch {
              res.statusCode = 500;
              res.end(JSON.stringify({ error: 'Failed to read config' }));
              return;
            }
          }

          if (req.method === 'POST') {
            let body = '';
            req.on('data', chunk => {
              body += chunk;
            });
            req.on('end', () => {
              try {
                const incoming = JSON.parse(body || '{}');
                let currentConfig: any = {};
                if (fs.existsSync(configPath)) {
                  try {
                    currentConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
                  } catch {}
                }

                const prevVersion = parseFloat(currentConfig.version || '1.0');
                const nextVersion = isNaN(prevVersion) ? '1.1' : (prevVersion + 0.1).toFixed(1);

                const updatedConfig = {
                  ...currentConfig,
                  ...incoming,
                  version: incoming.version || nextVersion,
                  lastUpdated: new Date().toISOString().split('T')[0],
                };

                // Ensure public directory exists
                const publicDir = path.dirname(configPath);
                if (!fs.existsSync(publicDir)) {
                  fs.mkdirSync(publicDir, { recursive: true });
                }
                fs.writeFileSync(configPath, JSON.stringify(updatedConfig, null, 2), 'utf-8');

                // Also update dist/plan_config.json if dist exists
                const distConfigPath = path.resolve(__dirname, 'dist', 'plan_config.json');
                if (fs.existsSync(path.dirname(distConfigPath))) {
                  try {
                    fs.writeFileSync(distConfigPath, JSON.stringify(updatedConfig, null, 2), 'utf-8');
                  } catch {}
                }

                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ success: true, config: updatedConfig }));
                return;
              } catch (err: any) {
                res.statusCode = 400;
                res.end(JSON.stringify({ success: false, error: err?.message || 'Invalid JSON format' }));
                return;
              }
            });
            return;
          }
        }
        next();
      });
    },
  };
}

function spa404Plugin(): Plugin {
  return {
    name: 'vite-plugin-spa-404',
    closeBundle() {
      const distIndex = path.resolve(__dirname, 'dist', 'index.html');
      const dist404 = path.resolve(__dirname, 'dist', '404.html');
      if (fs.existsSync(distIndex)) {
        try {
          fs.copyFileSync(distIndex, dist404);
        } catch {}
      }
    },
  };
}

export default defineConfig(() => {
  return {
    base: process.env.BASE_URL || './',
    plugins: [react(), tailwindcss(), aistudioMediaPlugin(), planConfigApiPlugin(), spa404Plugin()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      host: '0.0.0.0',
      port: 3000,
      allowedHosts: true as true,
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
