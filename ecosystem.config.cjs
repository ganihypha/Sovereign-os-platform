// ============================================================
// SOVEREIGN OS PLATFORM — PM2 ECOSYSTEM CONFIG (P2.5)
// For sandbox/local development with wrangler pages dev
// ============================================================
// USAGE:
//   npm run build
//   pm2 start ecosystem.config.cjs
//
// OPTIONS:
//   1. Without D1 (in-memory fallback):
//      args: 'wrangler pages dev dist --ip 0.0.0.0 --port 3000'
//
//   2. With D1 local (recommended for full testing):
//      args: 'wrangler pages dev dist --d1=sovereign-os-production --local --ip 0.0.0.0 --port 3000'
//
// SECRETS: .dev.vars is automatically loaded by wrangler pages dev
//          Copy .dev.vars.example → .dev.vars and set PLATFORM_API_KEY
// ============================================================
module.exports = {
  apps: [
    {
      name: 'sovereign-os',
      script: 'npx',
      // Use D1 local for full P2 testing (role-aware, continuity, governance)
      args: 'wrangler pages dev dist --d1=sovereign-os-production --local --ip 0.0.0.0 --port 3000',
      env: {
        NODE_ENV: 'development',
        PORT: 3000,
        // PLATFORM_API_KEY loaded from .dev.vars by wrangler automatically
      },
      watch: false,
      instances: 1,
      exec_mode: 'fork'
    }
  ]
}
