const express = require('express');
const config = require('../config');

function startHealthcheckServer(client) {
  const app = express();

  app.get('/', (req, res) => {
    const isReady = client.isReady();
    res.status(isReady ? 200 : 503).json({
      status: isReady ? 'ok' : 'starting',
      guilds: isReady ? client.guilds.cache.size : 0,
      uptime: process.uptime(),
    });
  });

  app.listen(config.port, () => {
    console.log(`[HEALTHCHECK] Сервер слушает порт ${config.port}`);
  });
}

module.exports = { startHealthcheckServer };
