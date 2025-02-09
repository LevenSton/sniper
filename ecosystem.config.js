module.exports = {
  apps: [
    {
      name: 'ibox-bot-1',
      script: 'dist/sniperIBox.js',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production',
        PRIVATE_KEY: process.env.PRIVATE_KEY_1,
        HTTPS_ENDPOINT: process.env.HTTPS_ENDPOINT,
        WSS_ENDPOINT: process.env.WSS_ENDPOINT
      },
      out_file: 'logs/ibox-bot-1.out.log',
      error_file: 'logs/ibox-bot-1.err.log',
      log_file: 'logs/ibox-bot-1.log',
      time: true,
      // 设置重启延迟，避免频繁重启
      exp_backoff_restart_delay: 100,
      // 设置最大重启次数
      max_restarts: 10,
      // 重启间隔时间
      restart_delay: 4000,
    },
    {
      name: 'ibox-bot-2',
      script: 'dist/sniperIBox.js',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production',
        PRIVATE_KEY: process.env.PRIVATE_KEY_2,
        HTTPS_ENDPOINT: process.env.HTTPS_ENDPOINT_2,
        WSS_ENDPOINT: process.env.WSS_ENDPOINT_2
      },
      out_file: 'logs/ibox-bot-2.out.log',
      error_file: 'logs/ibox-bot-2.err.log',
      log_file: 'logs/ibox-bot-2.log',
      time: true,
      // 设置重启延迟，避免频繁重启
      exp_backoff_restart_delay: 100,
      // 设置最大重启次数
      max_restarts: 10,
      // 重启间隔时间
      restart_delay: 4000,
    },
    {
      name: 'ibox-bot-3',
      script: 'dist/sniperIBox.js',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production',
        PRIVATE_KEY: process.env.PRIVATE_KEY_3,
        HTTPS_ENDPOINT: process.env.HTTPS_ENDPOINT_3,
        WSS_ENDPOINT: process.env.WSS_ENDPOINT_3
      },
      out_file: 'logs/ibox-bot-3.out.log',
      error_file: 'logs/ibox-bot-3.err.log',
      log_file: 'logs/ibox-bot-3.log',
      time: true,
      // 设置重启延迟，避免频繁重启
      exp_backoff_restart_delay: 100,
      // 设置最大重启次数
      max_restarts: 10,
      // 重启间隔时间
      restart_delay: 4000,
    },
  ]
}
