const express = require('express');
const path = require('path');
const { Telegraf } = require('telegraf');

const app = express();
const PORT = process.env.PORT || 3000;

const BOT_TOKEN = '8581159804:AAHzqC9moFkFuSWhWwBz7p2MdANOntZMv3A';
const bot = new Telegraf(BOT_TOKEN);

app.use(express.json({ limit: '10kb' }));
app.use(express.static(path.join(__dirname, 'public')));

// База данных в памяти
let players = new Map();

function getPlayer(userId) {
    if (!players.has(userId)) {
        players.set(userId, {
            userId,
            username: 'Player',
            score: 0,
            bones: 0,
            energy: 100,
            maxEnergy: 100,
            lastEnergyUpdate: Date.now(),
            tapLevel: 0,
            energyLevel: 0,
            autoLevel: 0,
            evolution: 0,
            streak: 0,
            lastClaimDate: '',
            achievements: {},
            createdAt: Date.now()
        });
    }
    return players.get(userId);
}

function regenerateEnergy(player) {
    const now = Date.now();
    const elapsed = (now - player.lastEnergyUpdate) / 1000;
    const regenRate = 1 + player.energyLevel * 0.5;
    const gained = Math.floor(elapsed * regenRate);
    if (gained > 0) {
        player.energy = Math.min(player.maxEnergy, player.energy + gained);
        player.lastEnergyUpdate = now;
    }
}

// Rate limiting
const rateLimit = new Map();
function checkRate(userId, limit = 60) {
    const now = Date.now();
    const windowMs = 60000;
    if (!rateLimit.has(userId)) {
        rateLimit.set(userId, []);
    }
    const requests = rateLimit.get(userId);
    const recent = requests.filter(t => now - t < windowMs);
    if (recent.length >= limit) return false;
    recent.push(now);
    rateLimit.set(userId, recent);
    return true;
}

// API: сохранение прогресса
app.post('/api/save', (req, res) => {
    const { userId, username, score, energy, tapLevel, energyLevel, autoLevel, bones, evolution } = req.body;
    
    if (!userId) return res.status(400).json({ error: 'No userId' });
    if (!checkRate(userId)) return res.status(429).json({ error: 'Rate limit' });
    
    const player = getPlayer(userId);
    
    if (typeof score === 'number' && score >= player.score) {
        player.score = Math.floor(score);
    }
    
    if (typeof energy === 'number') {
        player.energy = Math.min(player.maxEnergy, Math.max(0, Math.floor(energy)));
    }
    
    player.tapLevel = Math.max(player.tapLevel, Math.floor(tapLevel || 0));
    player.energyLevel = Math.max(player.energyLevel, Math.floor(energyLevel || 0));
    player.autoLevel = Math.max(player.autoLevel, Math.floor(autoLevel || 0));
    player.bones = Math.max(player.bones, Math.floor(bones || 0));
    player.evolution = Math.max(player.evolution, Math.floor(evolution || 0));
    
    if (username) player.username = String(username).slice(0, 50);
    
    res.json({ success: true, serverScore: player.score });
});

// API: получение игрока
app.get('/api/player/:userId', (req, res) => {
    const player = getPlayer(req.params.userId);
    regenerateEnergy(player);
    res.json(player);
});

// API: лидерборд
app.get('/api/leaderboard', (req, res) => {
    const top = Array.from(players.values())
        .sort((a, b) => b.score - a.score)
        .slice(0, 100)
        .map(p => ({ username: p.username, score: p.score, evolution: p.evolution }));
    res.json(top);
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
