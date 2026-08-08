function registerGlobalErrorHandlers() {
  process.on('unhandledRejection', (reason) => {
    console.error('[UNHANDLED REJECTION]', reason);
    // Намеренно НЕ вызываем process.exit — одна необработанная ошибка
    // в асинхронном коде не должна убивать весь процесс бота.
  });

  process.on('uncaughtException', (err) => {
    console.error('[UNCAUGHT EXCEPTION]', err);
    // uncaughtException теоретически может оставить процесс в неопределённом
    // состоянии, но для discord.js-бота резкий рестарт хуже, чем попытка
    // продолжить работу — Railway всё равно перезапустит при healthcheck fail.
  });

  process.on('SIGTERM', () => {
    console.log('[SHUTDOWN] Получен SIGTERM, завершаю работу корректно...');
    process.exit(0);
  });
}

module.exports = { registerGlobalErrorHandlers };
