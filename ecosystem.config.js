// PM2 process map for AssessExpert.
//
// Usage on the VPS:
//   pm2 start ecosystem.config.js
//   pm2 save
//   pm2 startup           # run the one-time bootstrap line it prints
//
// Restart after a code update:
//   pm2 reload ecosystem.config.js --update-env
//
// Logs:
//   pm2 logs assessexpert-backend
//   pm2 logs assessexpert-frontend
//   pm2 monit

module.exports = {
  apps: [
    {
      name: 'assessexpert-backend',
      cwd: './backend',
      script: 'dist/src/main.js',
      // Single instance for now — the WebSocket gateway is in-process and
      // not configured for cluster sticky sessions. Scale by adding a
      // Redis adapter to Socket.IO before flipping to cluster.
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production',
        PORT: 4000,
      },
      out_file: '/var/log/assessexpert/backend-out.log',
      error_file: '/var/log/assessexpert/backend-err.log',
      merge_logs: true,
      time: true,
    },
    {
      name: 'assessexpert-frontend',
      cwd: './frontend/portal',
      // Next.js production server. Start uses .next/ produced by `npm run build`.
      script: 'node_modules/next/dist/bin/next',
      args: 'start -p 3000',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '768M',
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
      },
      out_file: '/var/log/assessexpert/frontend-out.log',
      error_file: '/var/log/assessexpert/frontend-err.log',
      merge_logs: true,
      time: true,
    },
  ],
}
