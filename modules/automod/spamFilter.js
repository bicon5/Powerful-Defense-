const config = require('../../config');

// userId -> [timestamps сообщений]. In-memory — сбрасывается при рестарте,
// это нормально для антиспама (не нужна персистентность коротких окон).
const messageLog = new Map();
// userId -> последний текст, для детекта повторов подряд
const lastMessages = new Map();

function cleanup(userId, windowMs) {
  const now = Date.now();
  const timestamps = (messageLog.get(userId) || []).filter((t) => now - t < windowMs);
  messageLog.set(userId, timestamps);
  return timestamps;
}

/**
 * Возвращает { isSpam, reason } — не выполняет действий сама, только детектирует.
 * Решение о наказании принимает punishmentEngine.
 */
function checkSpam(message) {
  const { maxMessages, windowMs } = config.automod.spam;
  const userId = message.author.id;

  const timestamps = cleanup(userId, windowMs);
  timestamps.push(Date.now());
  messageLog.set(userId, timestamps);

  if (timestamps.length > maxMessages) {
    return { isSpam: true, reason: `Более ${maxMessages} сообщений за ${windowMs / 1000} сек.` };
  }

  // Детект повторяющегося текста подряд (частый паттерн спам-ботов)
  const prev = lastMessages.get(userId);
  lastMessages.set(userId, message.content);
  if (prev && prev.length > 5 && prev === message.content) {
    return { isSpam: true, reason: 'Повторяющееся сообщение подряд.' };
  }

  // Спам капсом (длинные сообщения, почти целиком заглавными буквами)
  if (message.content.length > 15) {
    const letters = message.content.replace(/[^a-zA-Zа-яА-ЯёЁ]/g, '');
    const upper = letters.replace(/[^A-ZА-ЯЁ]/g, '');
    if (letters.length > 10 && upper.length / letters.length > 0.8) {
      return { isSpam: true, reason: 'Чрезмерный CapsLock.' };
    }
  }

  // Спам массовыми упоминаниями
  if (message.mentions.users.size + message.mentions.roles.size > 5) {
    return { isSpam: true, reason: 'Массовые упоминания (mass mention).' };
  }

  return { isSpam: false };
}

module.exports = { checkSpam };
