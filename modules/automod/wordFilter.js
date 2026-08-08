// ВНИМАНИЕ: реальный список нецензурных слов сюда не добавлен — подставь свой
// (или подключи готовый пакет типа `obscenity` / `leo-profanity` для рус+англ).
// Ниже — только механика фильтрации, не сам словарь.
const BLOCKED_WORDS = [
  // 'пример1', 'пример2', ...
];

// Мэппинг символов, которыми юзеры пытаются обойти фильтр (leetspeak/спецсимволы)
const NORMALIZE_MAP = {
  '0': 'o', '1': 'i', '3': 'e', '4': 'a', '5': 's', '7': 't', '@': 'a', '$': 's',
  'а': 'a', 'е': 'e', 'о': 'o', 'р': 'p', 'с': 'c', 'х': 'x', // кириллица-омоглифы
};

function normalize(text) {
  return text
    .toLowerCase()
    .split('')
    .map((ch) => NORMALIZE_MAP[ch] || ch)
    .join('')
    .replace(/[^a-zа-яё]/g, ''); // убираем всё, что не буква (пробелы, точки, звёздочки между буквами)
}

function checkBadWords(message) {
  if (BLOCKED_WORDS.length === 0) return { hasBadWord: false };

  const normalized = normalize(message.content);
  for (const word of BLOCKED_WORDS) {
    if (normalized.includes(normalize(word))) {
      return { hasBadWord: true, reason: 'Запрещённая лексика.' };
    }
  }
  return { hasBadWord: false };
}

module.exports = { checkBadWords };
