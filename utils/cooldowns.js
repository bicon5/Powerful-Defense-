// commandName -> Map(userId -> timestamp последнего использования)
const cooldowns = new Map();

/**
 * Проверяет и обновляет cooldown для юзера на конкретную команду.
 * Возвращает 0 если можно выполнять, иначе — сколько секунд осталось ждать.
 */
function checkCooldown(commandName, userId, cooldownSeconds) {
  if (!cooldowns.has(commandName)) {
    cooldowns.set(commandName, new Map());
  }
  const timestamps = cooldowns.get(commandName);
  const now = Date.now();
  const cooldownMs = cooldownSeconds * 1000;

  const lastUsed = timestamps.get(userId);
  if (lastUsed && now - lastUsed < cooldownMs) {
    return Math.ceil((cooldownMs - (now - lastUsed)) / 1000);
  }

  timestamps.set(userId, now);
  return 0;
}

module.exports = { checkCooldown };
