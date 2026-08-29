const express = require('express');
const path = require('path');
const { Telegraf } = require('telegraf');

const app = express();
const PORT = process.env.PORT || 3000;

const BOT_TOKEN = '8581159804:AAHzqC9moFkFuSWhWwBz7p2MdANOntZMv3A';
const bot = new Telegraf(BOT_TOKEN);

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// База данных в памяти (пока без MongoDB)
let players = {};

// API: сохранить очки
app.post('/api/save', (req, res) => {
    const { userId, username, score } = req.body;
    if (!userId) return res.status(400).json({ error: 'No userId' });
    
    if (!players[userId] || players[userId].score < score) {
        players[userId] = {
            username: username || 'Player',
            score: score
        };
    }
    
    res.json({ success: true, score: players[userId].score });
});

// API: получить топ-100
app.get('/api/leaderboard', (req, res) => {
    const top = Object.values(players)
        .sort((a, b) => b.score - a.score)
        .slice(0, 100);
    res.json(top);
});

// API: получить очки игрока
app.get('/api/score/:userId', (req, res) => {
    const userId = req.params.userId;
    if (players[userId]) {
        res.json({ score: players[userId].score });
    } else {
        res.json({ score: 0 });
    }
});

bot.start((ctx) => {
    ctx.reply('Добро пожаловать в DOGE Click! Жми кнопку:', {
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
