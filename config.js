require('dotenv').config();

// Список переменных, без которых бот не имеет смысла запускать.
// Явная проверка при старте лучше, чем скрытый краш через 10 минут работы.
const REQUIRED_ENV = ['DISCORD_TOKEN', 'CLIENT_ID'];

function validateEnv() {
  const missing = REQUIRED_ENV.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    console.error('[CONFIG] Отсутствуют обязательные переменные окружения:', missing.join(', '));
    console.error('[CONFIG] Проверь .env локально или Variables в Railway.');
    process.exit(1);
  }
}

validateEnv();

module.exports = {
  token: process.env.DISCORD_TOKEN,
  clientId: process.env.CLIENT_ID,
  devGuildId: process.env.DEV_GUILD_ID || null,
  ownerId: process.env.OWNER_ID || null,
  port: process.env.PORT || 3000,

  // ID каналов логов. Если не заданы в env — бот создаст каналы сам при старте
  // на каждом сервере, где их ещё нет (см. modules/logging/ensureLogChannels.js).
  modLogChannelId: process.env.MOD_LOG_CHANNEL_ID || null,
  securityLogChannelId: process.env.SECURITY_LOG_CHANNEL_ID || null,

  // Названия каналов, которые бот создаёт автоматически, если явный ID не задан
  autoChannels: {
    modLog: 'mod-log',
    securityLog: 'security-audit',
    evidenceLog: 'evidence-log',
  },

  automod: {
    // антиспам: сколько сообщений за какое окно считается спамом
    spam: { maxMessages: 5, windowMs: 7000 },
    // весовая система нарушений (см. modules/automod/punishmentEngine.js)
    weights: { spam: 3, badWord: 2, invite: 5, mention: 4, phishing: 10 },
    decayMs: 10 * 60 * 1000, // баллы "остывают" за 10 минут
    thresholds: { warn: 5, mute: 10, kick: 18, ban: 25 },
    muteDurationMs: 10 * 60 * 1000,
  },

  antiraid: {
    joinVelocity: { maxJoins: 8, windowMs: 20000 }, // 8 джойнов за 20 сек = подозрение
    minAccountAgeMs: 3 * 24 * 60 * 60 * 1000, // аккаунты младше 3 дней — в карантин
    lockdownDurationMs: 10 * 60 * 1000,
  },
};
