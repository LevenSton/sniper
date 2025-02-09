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
        PRIVATE_KEY: '',
        HTTPS_ENDPOINT: '',
        WSS_ENDPOINT: ''
      },
      merge_logs: true,
      out_file: 'logs/ibox-bot-1.log',
      error_file: 'logs/ibox-bot-1.err.log',
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
        PRIVATE_KEY: '',
        HTTPS_ENDPOINT: '',
        WSS_ENDPOINT: ''
      },
      merge_logs: true,
      out_file: 'logs/ibox-bot-2.log',
      error_file: 'logs/ibox-bot-2.err.log',
      time: true,
      // 设置重启延迟，避免频繁重启
      exp_backoff_restart_delay: 100,
      // 设置最大重启次数
      max_restarts: 10,
      // 重启间隔时间
      restart_delay: 4000,
    },
    // {
    //   name: 'ibox-bot-3',
    //   script: 'dist/sniperIBox.js',
    //   instances: 1,
    //   autorestart: true,
    //   watch: false,
    //   max_memory_restart: '1G',
    //   env: {
    //     NODE_ENV: 'production',
    //     PRIVATE_KEY: '',
    //     HTTPS_ENDPOINT: '',
    //     WSS_ENDPOINT: ''
    //   },
    //   merge_logs: true,
    //   out_file: 'logs/ibox-bot-3.log',
    //   error_file: 'logs/ibox-bot-3.err.log',
    //   time: true,
    //   // 设置重启延迟，避免频繁重启
    //   exp_backoff_restart_delay: 100,
    //   // 设置最大重启次数
    //   max_restarts: 10,
    //   // 重启间隔时间
    //   restart_delay: 4000,
    // },
  ]
}
