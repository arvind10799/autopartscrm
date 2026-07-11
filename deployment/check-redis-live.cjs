require('dotenv').config();
const Redis = require('ioredis');

const client = new Redis({
  host: process.env.REDIS_HOST,
  port: Number(process.env.REDIS_PORT || 6379),
  username: process.env.REDIS_USERNAME?.trim() || undefined,
  password: process.env.REDIS_PASSWORD?.trim() || undefined,
  db: Number(process.env.REDIS_DB || 0),
  tls: process.env.REDIS_TLS_ENABLED === 'true' ? {} : undefined,
  connectTimeout: 5000,
  maxRetriesPerRequest: 1,
  lazyConnect: true,
  enableOfflineQueue: false,
});

client
  .connect()
  .then(async () => {
    const pong = await client.ping();
    console.log(JSON.stringify({ redisHost: process.env.REDIS_HOST, pong }));
    await client.quit();
  })
  .catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
