const express = require('express');
const path = require('path');
const { Telegraf } = require('telegraf');

const app = express();
const PORT = process.env.PORT || 3000;

const BOT_TOKEN = '8581159804:AAHzqC9moFkFuSWhWwBz7p2MdANOntZMv3A';
const bot = new Telegraf(BOT_TOKEN);

app.use(express.static(path.join(__dirname, 'public')));

bot.start((ctx) => {
    ctx.reply('Добро пожаловать в Doge Tap! Жми кнопку:', {
        reply_markup: {
            inline_keyboard: [
                [{ text: 'ИГРАТЬ', web_app: { url: 'https://doge-tap-game.onrender.com' } }]
            ]
        }
    });
});

app.listen(PORT, () => {
    console.log('Сервер запущен на порту ' + PORT);
    bot.launch();
    console.log('Бот запущен!');
});