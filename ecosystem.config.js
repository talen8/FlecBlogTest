module.exports = {
  apps: [
    {
      name: 'flec-server',
      script: './flec-server',
      env: {
        NODE_ENV: 'production',
      },
      max_memory_restart: '512M',
      exp_backoff_restart_delay: 100,
    },
    {
      name: 'flec-blog',
      script: './blog/.output/server/index.mjs',
      env: {
        NODE_ENV: 'production',
        NUXT_PUBLIC_API_URL: 'http://localhost:8080/api/v1',
      },
      max_memory_restart: '512M',
      exp_backoff_restart_delay: 100,
    },
  ],
};
