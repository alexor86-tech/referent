// Простой Node.js скрипт для тестирования API
// Использование: node test-api.js [port]

const http = require('http');

const PORT = process.argv[2] || 3000;
const BASE_URL = `http://localhost:${PORT}`;

async function testAPI() {
    console.log(`🧪 Тестирование API на ${BASE_URL}\n`);

    // 1. Проверка доступности сервера
    console.log('1️⃣ Проверка доступности сервера...');
    try {
        const response = await fetch(BASE_URL);
        console.log(`✅ Сервер доступен (HTTP ${response.status})\n`);
    } catch (error) {
        console.log(`❌ Сервер недоступен: ${error.message}`);
        console.log('Убедитесь, что запущен "pnpm dev" или "npm run dev"\n');
        process.exit(1);
    }

    // 2. Тест парсинга
    console.log('2️⃣ Тест парсинга статьи (/api/parse)...');
    try {
        const response = await fetch(`${BASE_URL}/api/parse`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url: 'https://example.com' })
        });

        const data = await response.json();
        if (response.ok) {
            console.log('✅ Парсинг работает');
            console.log(`Ответ: ${JSON.stringify(data).substring(0, 200)}...\n`);
        } else {
            console.log(`❌ Ошибка парсинга (HTTP ${response.status})`);
            console.log(`Ответ: ${JSON.stringify(data)}\n`);
        }
    } catch (error) {
        console.log(`❌ Ошибка: ${error.message}\n`);
    }

    // 3. Тест перевода
    console.log('3️⃣ Тест перевода (/api/translate)...');
    console.log('⚠️  Этот тест требует наличия OPENROUTER_API_KEY в .env.local');
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000);

        const response = await fetch(`${BASE_URL}/api/translate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ content: 'Hello, world! This is a test article.' }),
            signal: controller.signal
        });

        clearTimeout(timeoutId);
        const data = await response.json();

        if (response.ok) {
            console.log('✅ Перевод работает');
            console.log(`Ответ: ${data.translation?.substring(0, 200) || JSON.stringify(data)}...\n`);
        } else {
            if (data.error?.includes('API key')) {
                console.log('⚠️  API ключ не настроен (ожидаемо, если .env.local не настроен)\n');
            } else {
                console.log(`❌ Ошибка перевода (HTTP ${response.status})`);
                console.log(`Ответ: ${JSON.stringify(data)}\n`);
            }
        }
    } catch (error) {
        if (error.name === 'AbortError') {
            console.log('❌ Таймаут при запросе перевода\n');
        } else {
            console.log(`❌ Ошибка: ${error.message}\n`);
        }
    }

    console.log('✨ Тестирование завершено!');
}

// Проверка поддержки fetch в Node.js
if (typeof fetch === 'undefined') {
    console.log('❌ Требуется Node.js 18+ с поддержкой fetch');
    console.log('Или установите: npm install node-fetch\n');
    process.exit(1);
}

testAPI();

