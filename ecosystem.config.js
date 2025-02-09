module.exports = {
  apps: [{
    name: 'ibox',
    script: 'dist/sniperIBox.js',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'production'
    },
    // 禁用 PM2 的日志文件
    out_file: 'logs/ibox.out.log',
    error_file: 'logs/ibox.err.log',
    log_file: 'logs/ibox.log',
    time: true,
    // 设置重启延迟，避免频繁重启
    exp_backoff_restart_delay: 100,
    // 设置最大重启次数
    max_restarts: 10,
    // 重启间隔时间
    restart_delay: 4000,
  }]
}
