const express = require('express');
const path = require('path');
const { Telegraf } = require('telegraf');
const { MongoClient, ServerApiVersion } = require('mongodb');

const app = express();
const PORT = process.env.PORT || 3000;

const BOT_TOKEN = '8581159804:AAHzqC9moFkFuSWhWwBz7p2MdANOntZMv3A';
const MONGO_URI = 'mongodb+srv://dogeadmin:P%23mCqRpQN%40fcc3x@cluster0.kbtywaf.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0';
const WEBHOOK_URL = 'https://doge-tap-game.onrender.com/telegram-webhook';

const bot = new Telegraf(BOT_TOKEN);

app.use(express.json({ limit: '10kb' }));
app.use(express.static(path.join(__dirname, 'public')));

const client = new MongoClient(MONGO_URI, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true
    }
});

let db;
let playersCollection;

async function connectDB() {
    try {
        await client.connect();
        db = client.db('doge_click');
        playersCollection = db.collection('players');
        console.log('MongoDB connected!');
    } catch (err) {
        console.error('MongoDB connection error:', err.message);
    }
}

connectDB();

const GAME_ITEMS = {
    avatars: [
        { id: 'avatar_doge', name: 'Classic Doge', rarity: 'common', icon: 'https://cryptologos.cc/logos/dogecoin-doge-logo.png' },
        { id: 'avatar_gold', name: 'Golden Doge', rarity: 'epic', icon: 'https://cryptologos.cc/logos/dogecoin-doge-logo.png' },
        { id: 'avatar_space', name: 'Space Doge', rarity: 'legendary', icon: 'https://cryptologos.cc/logos/dogecoin-doge-logo.png' }
    ],
    frames: [
        { id: 'frame_common', name: 'Common Frame', rarity: 'common', icon: 'https://cryptologos.cc/logos/dogecoin-doge-logo.png' },
        { id: 'frame_rare', name: 'Rare Frame', rarity: 'rare', icon: 'https://cryptologos.cc/logos/dogecoin-doge-logo.png' },
        { id: 'frame_epic', name: 'Epic Frame', rarity: 'epic', icon: 'https://cryptologos.cc/logos/dogecoin-doge-logo.png' },
        { id: 'frame_legendary', name: 'Legendary Frame', rarity: 'legendary', icon: 'https://cryptologos.cc/logos/dogecoin-doge-logo.png' }
    ],
    backgrounds: [
        { id: 'bg_night', name: 'Night City', rarity: 'rare', icon: 'https://cryptologos.cc/logos/dogecoin-doge-logo.png' },
        { id: 'bg_space', name: 'Space', rarity: 'epic', icon: 'https://cryptologos.cc/logos/dogecoin-doge-logo.png' }
    ]
};

function createDefaultPlayer(userId) {
    return {
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
        inventory: {
            avatars: ['avatar_doge'],
            frames: ['frame_common'],
            backgrounds: []
        },
        equipped: {
            avatar: 'avatar_doge',
            frame: 'frame_common',
            background: null
        },
        sessionActive: false,
        lastHeartbeat: 0,
        lastAutoReward: Date.now(),
        createdAt: Date.now()
    };
}

async function getPlayer(userId) {
    if (!playersCollection) return createDefaultPlayer(userId);
    let player = await playersCollection.findOne({ userId });
    if (!player) {
        player = createDefaultPlayer(userId);
        await playersCollection.insertOne(player);
    }
    return player;
}

async function savePlayer(player) {
    if (!playersCollection) return;
    await playersCollection.updateOne(
        { userId: player.userId },
        { $set: player },
        { upsert: true }
    );
}

function regenerateEnergy(player) {
    const now = Date.now();
    const elapsed = Math.floor((now - player.lastEnergyUpdate) / 1000);
    if (elapsed <= 0) return;
    const regenRate = 1;
    const gained = elapsed * regenRate;
    if (player.energy + gained >= player.maxEnergy) {
        player.energy = player.maxEnergy;
        player.lastEnergyUpdate = now;
    } else {
        player.energy += gained;
        player.lastEnergyUpdate = now;
    }
}

function processAutoClicker(player) {
    const now = Date.now();
    const heartbeatTimeout = 45000;
    if (!player.sessionActive) return 0;
    if (now - player.lastHeartbeat > heartbeatTimeout) {
        player.sessionActive = false;
        return 0;
    }
    if (player.autoLevel <= 0) return 0;
    const elapsed = Math.floor((now - player.lastAutoReward) / 1000);
    if (elapsed <= 0) return 0;
    const gain = player.autoLevel * elapsed;
    player.score += gain;
    player.lastAutoReward = now;
    return gain;
}

const rateLimit = new Map();
function checkRate(userId, limit = 300) {
    const now = Date.now();
    if (!rateLimit.has(userId)) rateLimit.set(userId, []);
    const requests = rateLimit.get(userId);
    const recent = requests.filter(t => now - t < 60000);
    if (recent.length >= limit) return false;
    recent.push(now);
    rateLimit.set(userId, recent);
    return true;
}

app.get('/api/state/:userId', async (req, res) => {
    try {
        const player = await getPlayer(req.params.userId);
        regenerateEnergy(player);
        processAutoClicker(player);
        await savePlayer(player);
        res.json({
            username: player.username,
            score: player.score,
            bones: player.bones,
            energy: Math.floor(player.energy),
            maxEnergy: player.maxEnergy,
            tapLevel: player.tapLevel,
            energyLevel: player.energyLevel,
            autoLevel: player.autoLevel,
            evolution: player.evolution,
            inventory: player.inventory,
            equipped: player.equipped
        });
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
});

app.post('/api/heartbeat', async (req, res) => {
    const { userId } = req.body;
    if (!userId) return res.status(400).json({ error: 'No userId' });
    try {
        const player = await getPlayer(userId);
        player.sessionActive = true;
        player.lastHeartbeat = Date.now();
        const autoGain = processAutoClicker(player);
        await savePlayer(player);
        res.json({ success: true, score: player.score, autoGain });
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
});

app.post('/api/click', async (req, res) => {
    const { userId } = req.body;
    if (!userId) return res.status(400).json({ error: 'No userId' });
    if (!checkRate(userId, 300)) return res.status(429).json({ error: 'Rate limit' });
    try {
        const player = await getPlayer(userId);
        regenerateEnergy(player);
        if (player.energy <= 0) {
            return res.status(400).json({ error: 'No energy' });
        }
        const gain = 1 + player.tapLevel;
        player.score += gain;
        player.energy -= 1;
        player.lastEnergyUpdate = Date.now();
        await savePlayer(player);
        res.json({ success: true, score: player.score, energy: player.energy, gain });
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
});

app.post('/api/buy', async (req, res) => {
    const { userId, upgradeType } = req.body;
    if (!userId || !upgradeType) return res.status(400).json({ error: 'Missing params' });
    if (!checkRate(userId, 10)) return res.status(429).json({ error: 'Rate limit' });
    try {
        const player = await getPlayer(userId);
        if (upgradeType === 'tap') {
            const cost = Math.floor(100 * Math.pow(1.15, player.tapLevel));
            if (player.score < cost) return res.status(400).json({ error: 'Not enough' });
            player.score -= cost;
            player.tapLevel++;
        } else if (upgradeType === 'energy') {
            const cost = Math.floor(150 * Math.pow(1.15, player.energyLevel));
            if (player.score < cost) return res.status(400).json({ error: 'Not enough' });
            player.score -= cost;
            player.energyLevel++;
            player.maxEnergy = 100 + player.energyLevel * 50;
            player.energy = player.maxEnergy;
        } else if (upgradeType === 'auto') {
            const cost = Math.floor(200 * Math.pow(1.15, player.autoLevel));
            if (player.score < cost) return res.status(400).json({ error: 'Not enough' });
            player.score -= cost;
            player.autoLevel++;
        } else {
            return res.status(400).json({ error: 'Bad type' });
        }
        await savePlayer(player);
        res.json({ success: true, score: player.score, tapLevel: player.tapLevel, energyLevel: player.energyLevel, autoLevel: player.autoLevel, maxEnergy: player.maxEnergy });
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
});

app.post('/api/case/open', async (req, res) => {
    const { userId, caseType } = req.body;
    if (!userId || !caseType) return res.status(400).json({ error: 'Missing params' });
    try {
        const player = await getPlayer(userId);
        const cases = {
            common: { price: 100, prizes: [30, 50, 80, 120, 200] },
            rare: { price: 500, prizes: [150, 300, 500, 800, 1200] },
            epic: { price: 2000, prizes: [500, 1000, 1800, 3000, 5000] },
            legendary: { price: 5000, prizes: [1000, 2500, 5000, 8000, 15000] }
        };
        const caseConfig = cases[caseType];
        if (!caseConfig) return res.status(400).json({ error: 'Bad case' });
        if (player.score < caseConfig.price) return res.status(400).json({ error: 'Not enough' });
        player.score -= caseConfig.price;
        const dogePrize = caseConfig.prizes[Math.floor(Math.random() * caseConfig.prizes.length)];
        player.score += dogePrize;
        await savePlayer(player);
        res.json({ success: true, dogePrize, newScore: player.score });
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
});

app.post('/api/equip', async (req, res) => {
    const { userId, category, itemId } = req.body;
    if (!userId || !category || !itemId) return res.status(400).json({ error: 'Missing params' });
    try {
        const player = await getPlayer(userId);
        if (!player.inventory[category] || !player.inventory[category].includes(itemId)) {
            return res.status(400).json({ error: 'Item not owned' });
        }
        player.equipped[category] = itemId;
        await savePlayer(player);
        res.json({ success: true, equipped: player.equipped });
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
});

app.get('/api/leaderboard', async (req, res) => {
    try {
        if (!playersCollection) return res.json([]);
        const top = await playersCollection.find().sort({ score: -1 }).limit(100).toArray();
        res.json(top.map(p => ({ username: p.username, score: p.score, equipped: p.equipped })));
    } catch (err) {
        res.json([]);
    }
});

app.get('/api/items', (req, res) => {
    res.json(GAME_ITEMS);
});

// ==================== WEBHOOK ====================
app.post('/telegram-webhook', (req, res) => {
    bot.handleUpdate(req.body, res);
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

app.listen(PORT, async () => {
    console.log('Сервер запущен на порту ' + PORT);
    
    // Устанавливаем webhook
    try {
        await bot.telegram.setWebhook(WEBHOOK_URL);
        console.log('Webhook установлен!');
    } catch (err) {
        console.error('Ошибка webhook:', err.message);
    }
    
    console.log('Бот запущен!');
});
