# Guardian Bot — Discord автомод + антирейд + логи с доказательствами

## Что делает бот

- **Автомод**: антиспам (частота, повторы, капс, mass-mention), фильтр запрещённых слов
  (с нормализацией против обхода через leetspeak/спецсимволы), фильтр ссылок
  (чужие инвайты + фишинг-паттерны), весовая система наказаний с decay (баллы "остывают" со временем).
- **Антирейд**: детект аномальной скорости вступлений, проверка возраста аккаунта,
  автоматический lockdown сервера на время с авто-снятием.
- **Логи с доказательствами**: при первом запуске бот сам создаёт на сервере категорию
  "Guardian Logs" с каналами `#mod-log`, `#security-audit`, `#evidence-log`. Каждое действие
  автомода или модератора сохраняет точный снимок нарушившего сообщения (текст + вложения)
  в базу данных и публикует его в лог-канал — это и есть "доказательство".
- **Безопасность**: секреты только через переменные окружения, двойная проверка прав
  на команды, cooldown на команды, подтверждение через кнопки для деструктивных действий
  (бан), защита от SQL-инъекций (параметризованные запросы), глобальная обработка ошибок,
  healthcheck-эндпоинт для Railway.

## Локальный запуск

```bash
npm install
cp .env.example .env
# заполни .env своими значениями (см. ниже, где их взять)
npm run deploy-commands   # регистрирует slash-команды
npm start
```

## Откуда взять значения для .env

1. **DISCORD_TOKEN** и **CLIENT_ID**: [Discord Developer Portal](https://discord.com/developers/applications) →
   создай приложение → вкладка "Bot" → Reset Token (это DISCORD_TOKEN) →
   вкладка "General Information" → Application ID (это CLIENT_ID).
2. Во вкладке "Bot" включи **Privileged Gateway Intents**: `SERVER MEMBERS INTENT` и
   `MESSAGE CONTENT INTENT` — без них антимод и антирейд не будут получать нужные данные.
3. **DEV_GUILD_ID**: правый клик по своему серверу в Discord (нужен Developer Mode
   в настройках Discord) → Copy Server ID. Используется только для разработки,
   чтобы команды обновлялись мгновенно.
4. Пригласи бота на сервер через OAuth2 URL Generator в Developer Portal:
   выбери scope `bot` и `applications.commands`, права минимум
   `Manage Roles, Kick Members, Ban Members, Moderate Members, Manage Channels, Manage Messages`.

## Деплой на Railway

1. Залей этот проект в GitHub-репозиторий (**.env НЕ коммить** — он уже в `.gitignore`).
2. На [railway.app](https://railway.app) → New Project → Deploy from GitHub repo → выбери репозиторий.
3. В настройках проекта → **Variables** → добавь все переменные из `.env.example`
   (DISCORD_TOKEN, CLIENT_ID, OWNER_ID и т.д.) — это Railway-аналог `.env`, только
   безопасный и никогда не попадающий в git.
4. Railway сам определит `npm start` из `package.json` и задеплоит.
5. **Важно про базу данных**: по умолчанию бот использует SQLite-файл в `data/bot.db`.
   Файловая система Railway при редеплое эфемерна — если тебе важно не терять
   историю нарушений между деплоями, подключи **Railway Volume** и примонтируй его
   на путь `/app/data`, либо перейди на **Railway Postgres plugin** для полноценной
   персистентности (потребует переписать `database/db.js` под `pg` вместо `better-sqlite3`).
6. После первого успешного деплоя один раз выполни регистрацию команд — либо локально
   с теми же переменными (`npm run deploy-commands`), либо добавь как одноразовый Railway
   Job/Shell-команду.

## Структура проекта

```
index.js                       — точка входа, инициализация клиента
config.js                      — все настройки и валидация env-переменных
deploy-commands.js             — регистрация slash-команд в Discord API
commands/moderation/           — /ban, /warn, /history
events/                        — обработчики событий discord.js
modules/automod/               — антиспам, фильтр слов, фильтр ссылок, движок наказаний
modules/antiraid/              — детект рейда и lockdown
modules/logging/                — авто-создание лог-каналов, отправка embed-логов
database/                      — SQLite-схема и функции записи (варны, доказательства, аудит)
utils/                         — permissions, cooldowns, error handlers, healthcheck
```

## Настройка фильтров под себя

- Список запрещённых слов — пустой по умолчанию в `modules/automod/wordFilter.js`
  (сознательно, чтобы не навязывать чужой словарь) — добавь свои слова в массив
  `BLOCKED_WORDS`, либо подключи готовый пакет вроде `obscenity` или `leo-profanity`.
- Пороги наказаний, вес каждого типа нарушения, длительность мута/lockdown —
  всё в `config.js` в секциях `automod` и `antiraid`.

## Дальнейшие шаги (не реализовано, но архитектура готова к расширению)

- Команда `/config` для изменения порогов автомода без правки кода — прямо с сервера.
- Кнопка "Apeal" в mod-log для юзеров, оспаривающих наказание.
- Внешний обновляемый blacklist фишинг-доменов вместо статического списка в коде.
