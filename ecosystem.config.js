module.exports = {
    apps: [
        {
            name: 'your-guide',
            script: 'app.js',
            instances: 1,            // Adjust to 'max' for clustering, if desired.
            autorestart: true,
            watch: false,            // Enable if you want PM2 to restart on file changes.
            max_memory_restart: '1G',
            env: {
                NODE_ENV: 'development'
            },
            env_production: {
                NODE_ENV: 'production'
            }
        }
    ]
};
