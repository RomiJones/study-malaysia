const path = require("node:path");

module.exports = {
  apps: [
    {
      name: "studymy-api",
      cwd: path.join(__dirname, "apps/api"),
      script: "dist/main.js",
      exec_mode: "fork",
      instances: 1,
      watch: false,
      autorestart: true,
      min_uptime: "10s",
      max_restarts: 10,
      restart_delay: 3000,
      wait_ready: true,
      listen_timeout: 60000,
      kill_timeout: 10000,
      time: true,
      env: {
        INIT_CWD: __dirname
      },
      env_production: {
        NODE_ENV: "production"
      }
    }
  ]
};
