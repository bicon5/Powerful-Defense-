const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

// Railway даёт эфемерную файловую систему без attached volume — если volume не подключён,
// data/ будет обнуляться при редеплое. Для реальной персистентности данных
// рекомендуется подключить Railway Volume и примонтировать его на /data,
// либо перейти на Postgres (Railway Postgres plugin) для продакшена.
const dataDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

const db = new Database(path.join(dataDir, 'bot.db'));
db.pragma('journal_mode = WAL'); // лучше для конкурентных записей

function initSchema() {
  db.exec(`
    -- Баллы нарушений автомода на юзера (весовая система, см. config.automod.weights)
    CREATE TABLE IF NOT EXISTS infractions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      guild_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      type TEXT NOT NULL,          -- spam / badWord / invite / mention / phishing / manual
      weight INTEGER NOT NULL,
      reason TEXT,
      moderator_id TEXT,           -- NULL если авто-действие бота
      evidence_id INTEGER,         -- ссылка на сохранённое доказательство
      created_at INTEGER NOT NULL
    );

    -- Доказательства: точный снимок того, что произошло — текст сообщения,
    -- вложения, канал, время. Хранится отдельно от infractions, чтобы
    -- можно было ссылаться на одно доказательство из нескольких записей
    -- (например: автомод дал варн + модератор потом забанил за то же).
    CREATE TABLE IF NOT EXISTS evidence (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      guild_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      channel_id TEXT,
      message_id TEXT,
      content_snapshot TEXT,        -- точный текст сообщения на момент нарушения
      attachments_json TEXT,        -- JSON-массив URL вложений (картинки/файлы)
      action_taken TEXT,            -- что сделал бот: deleted / muted / kicked / banned / warned
      created_at INTEGER NOT NULL
    );

    -- Журнал действий модераторов и самого бота над конфигом/правами —
    -- отдельно от infractions, потому что это не про юзеров сервера,
    -- а про безопасность самого бота (кто что менял).
    CREATE TABLE IF NOT EXISTS security_audit (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      guild_id TEXT,
      actor_id TEXT NOT NULL,       -- кто совершил действие
      action TEXT NOT NULL,         -- например: config_changed, role_granted, command_executed
      details TEXT,
      created_at INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_infractions_user ON infractions(guild_id, user_id);
    CREATE INDEX IF NOT EXISTS idx_evidence_user ON evidence(guild_id, user_id);
    CREATE INDEX IF NOT EXISTS idx_audit_guild ON security_audit(guild_id);
  `);
}

initSchema();

module.exports = db;
