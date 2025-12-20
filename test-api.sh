#!/bin/bash

# Скрипт для тестирования API
# Использование: ./test-api.sh [port]
# По умолчанию порт 3000

PORT=${1:-3000}
BASE_URL="http://localhost:${PORT}"

echo "🧪 Тестирование API на ${BASE_URL}"
echo ""

# Проверка доступности сервера
echo "1️⃣ Проверка доступности сервера..."
if curl -s -o /dev/null -w "%{http_code}" "${BASE_URL}" | grep -q "200\|404"; then
    echo "✅ Сервер доступен"
else
    echo "❌ Сервер недоступен. Убедитесь, что запущен 'pnpm dev' или 'npm run dev'"
    exit 1
fi
echo ""

# Тест парсинга статьи
echo "2️⃣ Тест парсинга статьи (/api/parse)..."
TEST_URL="https://example.com"
PARSE_RESPONSE=$(curl -s -X POST "${BASE_URL}/api/parse" \
    -H "Content-Type: application/json" \
    -d "{\"url\": \"${TEST_URL}\"}" \
    -w "\nHTTP_CODE:%{http_code}")

HTTP_CODE=$(echo "$PARSE_RESPONSE" | grep -o "HTTP_CODE:[0-9]*" | cut -d: -f2)
BODY=$(echo "$PARSE_RESPONSE" | sed '/HTTP_CODE:/d')

if [ "$HTTP_CODE" = "200" ]; then
    echo "✅ Парсинг работает"
    echo "Ответ: $(echo "$BODY" | head -c 200)..."
else
    echo "❌ Ошибка парсинга (HTTP $HTTP_CODE)"
    echo "Ответ: $BODY"
fi
echo ""

# Тест перевода (требует API ключ)
echo "3️⃣ Тест перевода (/api/translate)..."
echo "⚠️  Этот тест требует наличия OPENROUTER_API_KEY в .env.local"
TRANSLATE_RESPONSE=$(curl -s -X POST "${BASE_URL}/api/translate" \
    -H "Content-Type: application/json" \
    -d "{\"content\": \"Hello, world! This is a test article.\"}" \
    -w "\nHTTP_CODE:%{http_code}" \
    --max-time 30)

HTTP_CODE=$(echo "$TRANSLATE_RESPONSE" | grep -o "HTTP_CODE:[0-9]*" | cut -d: -f2)
BODY=$(echo "$TRANSLATE_RESPONSE" | sed '/HTTP_CODE:/d')

if [ "$HTTP_CODE" = "200" ]; then
    echo "✅ Перевод работает"
    echo "Ответ: $(echo "$BODY" | head -c 200)..."
elif [ "$HTTP_CODE" = "500" ] && echo "$BODY" | grep -q "API key"; then
    echo "⚠️  API ключ не настроен (ожидаемо, если .env.local не настроен)"
else
    echo "❌ Ошибка перевода (HTTP $HTTP_CODE)"
    echo "Ответ: $BODY"
fi
echo ""

echo "✨ Тестирование завершено!"

