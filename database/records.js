const db = require('./db');

/**
 * Сохраняет "доказательство" нарушения — точный снимок сообщения на момент действия.
 * Это то, что позволяет при апелляции или разборе жалобы увидеть, что реально
 * написал юзер, а не полагаться на пересказ.
 */
function saveEvidence({ guildId, userId, channelId, messageId, content, attachments, actionTaken }) {
  const stmt = db.prepare(`
    INSERT INTO evidence (guild_id, user_id, channel_id, message_id, content_snapshot, attachments_json, action_taken, created_at)
    VALUES (@guildId, @userId, @channelId, @messageId, @content, @attachments, @actionTaken, @createdAt)
  `);
  const result = stmt.run({
    guildId,
    userId,
    channelId: channelId || null,
    messageId: messageId || null,
    content: content || '',
    attachments: JSON.stringify(attachments || []),
    actionTaken,
    createdAt: Date.now(),
  });
  return result.lastInsertRowid;
}

/**
 * Записывает нарушение (infraction) со ссылкой на доказательство.
 */
function addInfraction({ guildId, userId, type, weight, reason, moderatorId, evidenceId }) {
  const stmt = db.prepare(`
    INSERT INTO infractions (guild_id, user_id, type, weight, reason, moderator_id, evidence_id, created_at)
    VALUES (@guildId, @userId, @type, @weight, @reason, @moderatorId, @evidenceId, @createdAt)
  `);
  const result = stmt.run({
    guildId,
    userId,
    type,
    weight,
    reason: reason || null,
    moderatorId: moderatorId || null,
    evidenceId: evidenceId || null,
    createdAt: Date.now(),
  });
  return result.lastInsertRowid;
}

/**
 * Считает суммарный "вес" нарушений юзера за окно времени (для decay-логики —
 * старые баллы не учитываются, см. config.automod.decayMs).
 */
function getActiveScore(guildId, userId, decayMs) {
  const since = Date.now() - decayMs;
  const row = db.prepare(`
    SELECT COALESCE(SUM(weight), 0) as total
    FROM infractions
    WHERE guild_id = ? AND user_id = ? AND created_at >= ?
  `).get(guildId, userId, since);
  return row.total;
}

function getInfractionHistory(guildId, userId, limit = 20) {
  return db.prepare(`
    SELECT * FROM infractions
    WHERE guild_id = ? AND user_id = ?
    ORDER BY created_at DESC
    LIMIT ?
  `).all(guildId, userId, limit);
}

function getEvidence(evidenceId) {
  return db.prepare('SELECT * FROM evidence WHERE id = ?').get(evidenceId);
}

function logSecurityAudit({ guildId, actorId, action, details }) {
  db.prepare(`
    INSERT INTO security_audit (guild_id, actor_id, action, details, created_at)
    VALUES (?, ?, ?, ?, ?)
  `).run(guildId || null, actorId, action, details || null, Date.now());
}

module.exports = {
  saveEvidence,
  addInfraction,
  getActiveScore,
  getInfractionHistory,
  getEvidence,
  logSecurityAudit,
};
