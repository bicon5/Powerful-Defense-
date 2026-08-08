const fs = require('fs');
const path = require('path');
const { REST, Routes } = require('discord.js');
const config = require('./config');

function collectCommands(dir) {
  const commands = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      commands.push(...collectCommands(fullPath));
    } else if (entry.name.endsWith('.js')) {
      const command = require(fullPath);
      if (command?.data) commands.push(command.data.toJSON());
    }
  }
  return commands;
}

const commands = collectCommands(path.join(__dirname, 'commands'));
const rest = new REST().setToken(config.token);

(async () => {
  try {
    console.log(`[DEPLOY] Регистрирую ${commands.length} команд...`);

    if (config.devGuildId) {
      // Регистрация на конкретном сервере — обновляется мгновенно, удобно для разработки
      await rest.put(
        Routes.applicationGuildCommands(config.clientId, config.devGuildId),
        { body: commands }
      );
      console.log(`[DEPLOY] Команды зарегистрированы на dev-сервере ${config.devGuildId}`);
    } else {
      // Глобальная регистрация — применяется на всех серверах, но обновление до ~1 часа
      await rest.put(
        Routes.applicationCommands(config.clientId),
        { body: commands }
      );
      console.log('[DEPLOY] Команды зарегистрированы глобально (обновление может занять до часа)');
    }
  } catch (err) {
    console.error('[DEPLOY] Ошибка регистрации команд:', err);
    process.exit(1);
  }
})();
