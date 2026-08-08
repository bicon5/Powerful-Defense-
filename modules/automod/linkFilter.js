const INVITE_REGEX = /(discord\.gg|discord(?:app)?\.com\/invite)\/([a-zA-Z0-9-]+)/i;

// Частые паттерны фишинговых доменов, мимикрирующих под Discord/Steam/Nitro.
// Это не исчерпывающий список — для продакшена стоит подключить внешний
// обновляемый blacklist (например, через API вроде Sinking Yachts или свой список).
const PHISHING_PATTERNS = [
  /discord-?nitro\b/i,
  /discrod/i,
  /dlscord/i,
  /steamcommunlty/i,
  /steam-?gift/i,
];

function checkLinks(message, allowedInviteGuildId) {
  const content = message.content;

  for (const pattern of PHISHING_PATTERNS) {
    if (pattern.test(content)) {
      return { blocked: true, type: 'phishing', reason: 'Похоже на фишинговую ссылку.' };
    }
  }

  const inviteMatch = content.match(INVITE_REGEX);
  if (inviteMatch) {
    // Если это инвайт на текущий же сервер — не блокируем (юзеры иногда шарят
    // пригласительную ссылку своего же сервера, это не нарушение)
    const isOwnInvite = allowedInviteGuildId && content.includes(allowedInviteGuildId);
    if (!isOwnInvite) {
      return { blocked: true, type: 'invite', reason: 'Приглашение на другой Discord-сервер.' };
    }
  }

  return { blocked: false };
}

module.exports = { checkLinks };
