const fs = require('fs');
const path = require('path');
const { Client, GatewayIntentBits, Collection, Partials } = require('discord.js');
const config = require('./config');
const { registerGlobalErrorHandlers } = require('./utils/errorHandlers');
const { startHealthcheckServer } = require('./utils/healthcheck');

registerGlobalErrorHandlers();

// Только те intents, которые реально нужны боту — принцип минимальных привилегий.
// Больше intents = больше данных бот получает от Discord = больше поверхность атаки
// при компрометации бота, плюс лишняя нагрузка на gateway-соединение.
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent, // нужен для автомод-фильтров текста
    GatewayIntentBits.GuildMembers,   // нужен для антирейда (guildMemberAdd)
    GatewayIntentBits.GuildModeration,
  ],
  partials: [Partials.Message, Partials.Channel],
});

client.commands = new Collection();

// Загрузка slash-команд из commands/**
function loadCommands(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      loadCommands(fullPath);
    } else if (entry.name.endsWith('.js')) {
      const command = require(fullPath);
      if (command?.data && command?.execute) {
        client.commands.set(command.data.name, command);
      }
    }
  }
}
loadCommands(path.join(__dirname, 'commands'));

// Загрузка обработчиков событий из events/*
const eventsDir = path.join(__dirname, 'events');
for (const file of fs.readdirSync(eventsDir).filter((f) => f.endsWith('.js'))) {
  const event = require(path.join(eventsDir, file));
  if (event.once) {
    client.once(event.name, (...args) => event.execute(...args, client));
  } else {
    client.on(event.name, (...args) => event.execute(...args, client));
  }
}

// Обработка вызова slash-команд — вынесена сюда, а не в отдельный events/interactionCreate.js,
// чтобы держать доступ к client.commands в одном месте без лишних импортов
client.on('interactionCreate', async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  const command = client.commands.get(interaction.commandName);
  if (!command) return;

  try {
    await command.execute(interaction);
  } catch (err) {
    console.error(`[COMMAND ERROR] /${interaction.commandName}:`, err);
    const errorReply = { content: 'Произошла ошибка при выполнении команды.', ephemeral: true };
    if (interaction.replied || interaction.deferred) {
      await interaction.followUp(errorReply).catch(() => {});
    } else {
      await interaction.reply(errorReply).catch(() => {});
    }
  }
});

startHealthcheckServer(client);
client.login(config.token);
