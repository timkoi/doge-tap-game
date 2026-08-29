const express = require('express');
const path = require('path');
const { Telegraf } = require('telegraf');

const app = express();
const PORT = process.env.PORT || 3000;

const BOT_TOKEN = '8581159804:AAHzqC9moFkFuSWhWwBz7p2MdANOntZMv3A';
const bot = new Telegraf(BOT_TOKEN);

app.use(express.json({ limit: '10kb' }));
app.use(express.static(path.join(__dirname, 'public')));

// ==================== ПРЕДМЕТЫ ====================
const GAME_ITEMS = {
    avatars: [
        { id: 'avatar_doge', name: 'Classic Doge', rarity: 'common', icon: 'https://cryptologos.cc/logos/dogecoin-doge-logo.png' },
        { id: 'avatar_gold', name: 'Golden Doge', rarity: 'epic', icon: 'https://cryptologos.cc/logos/dogecoin-doge-logo.png' },
        { id: 'avatar_space', name: 'Space Doge', rarity: 'legendary', icon: 'https://cryptologos.cc/logos/dogecoin-doge-logo.png' },
        { id: 'avatar_pepe', name: 'Pepe Doge', rarity: 'rare', icon: 'https://cryptologos.cc/logos/dogecoin-doge-logo.png' },
        { id: 'avatar_king', name: 'King Doge', rarity: 'legendary', icon: 'https://cryptologos.cc/logos/dogecoin-doge-logo.png' }
    ],
    frames: [
        { id: 'frame_common', name: 'Common Frame', rarity: 'common', icon: 'https://cryptologos.cc/logos/dogecoin-doge-logo.png' },
        { id: 'frame_rare', name: 'Rare Frame', rarity: 'rare', icon: 'https://cryptologos.cc/logos/dogecoin-doge-logo.png' },
        { id: 'frame_epic', name: 'Epic Frame', rarity: 'epic', icon: 'https://cryptologos.cc/logos/dogecoin-doge-logo.png' },
        { id: 'frame_legendary', name: 'Legendary Frame', rarity: 'legendary', icon: 'https://cryptologos.cc/logos/dogecoin-doge-logo.png' }
    ],
    backgrounds: [
        { id: 'bg_night', name: 'Night City', rarity: 'rare', icon: 'https://cryptologos.cc/logos/dogecoin-doge-logo.png' },
        { id: 'bg_space', name: 'Space', rarity: 'epic', icon: 'https://cryptologos.cc/logos/dogecoin-doge-logo.png' },
        { id: 'bg_gold', name: 'Golden', rarity: 'legendary', icon: 'https://cryptologos.cc/logos/dogecoin-doge-logo.png' }
    ]
};

// ==================== БАЗА ДАННЫХ ====================
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

// ==================== RATE LIMITING ====================
const rateLimit = new Map();
function checkRate(userId, limit = 60) {
    const now = Date.now();
    const windowMs = 60000;
    if (!rateLimit.has(userId)) rateLimit.set(userId, []);
    const requests = rateLimit.get(userId);
    const recent = requests.filter(t => now - t < windowMs);
    if (recent.length >= limit) return false;
    recent.push(now);
    rateLimit.set(userId, recent);
    return true;
}

// ==================== API ====================

// Сохранение прогресса
app.post('/api/save', (req, res) => {
    const { userId, username, score, bones, energy, tapLevel, energyLevel, autoLevel, evolution } = req.body;
    if (!userId) return res.status(400).json({ error: 'No userId' });
    if (!checkRate(userId)) return res.status(429).json({ error: 'Rate limit' });
    
    const player = getPlayer(userId);
    if (typeof score === 'number' && score >= player.score) player.score = Math.floor(score);
    if (typeof energy === 'number') player.energy = Math.min(player.maxEnergy, Math.max(0, Math.floor(energy)));
    player.tapLevel = Math.max(player.tapLevel, Math.floor(tapLevel || 0));
    player.energyLevel = Math.max(player.energyLevel, Math.floor(energyLevel || 0));
    player.autoLevel = Math.max(player.autoLevel, Math.floor(autoLevel || 0));
    player.bones = Math.max(player.bones, Math.floor(bones || 0));
    player.evolution = Math.max(player.evolution, Math.floor(evolution || 0));
    if (username) player.username = String(username).slice(0, 50);
    
    res.json({ success: true });
});

// Получение профиля игрока
app.get('/api/player/:userId', (req, res) => {
    const player = getPlayer(req.params.userId);
    regenerateEnergy(player);
    res.json({
        username: player.username,
        score: player.score,
        bones: player.bones,
        energy: player.energy,
        maxEnergy: player.maxEnergy,
        tapLevel: player.tapLevel,
        energyLevel: player.energyLevel,
        autoLevel: player.autoLevel,
        evolution: player.evolution,
        inventory: player.inventory,
        equipped: player.equipped
    });
});

// Открытие кейса
app.post('/api/case/open', (req, res) => {
    const { userId, caseType } = req.body;
    if (!userId || !caseType) return res.status(400).json({ error: 'Missing params' });
    if (!checkRate(userId, 10)) return res.status(429).json({ error: 'Rate limit' });
    
    const player = getPlayer(userId);
    
    const cases = {
        common: { price: 100, prizes: [30, 50, 80, 120, 200] },
        rare: { price: 500, prizes: [150, 300, 500, 800, 1200] },
        epic: { price: 2000, prizes: [500, 1000, 1800, 3000, 5000] },
        legendary: { price: 5000, prizes: [1000, 2500, 5000, 8000, 15000] }
    };
    
    const caseConfig = cases[caseType];
    if (!caseConfig) return res.status(400).json({ error: 'Bad case' });
    
    if (player.score < caseConfig.price) return res.status(400).json({ error: 'Not enough DOGE' });
    
    player.score -= caseConfig.price;
    
    // DOGE награда
    const dogePrize = caseConfig.prizes[Math.floor(Math.random() * caseConfig.prizes.length)];
    player.score += dogePrize;
    
    // Шанс на BONES
    const bonesChance = caseType === 'legendary' ? 0.5 : caseType === 'epic' ? 0.25 : caseType === 'rare' ? 0.1 : 0.05;
    let bonesPrize = 0;
    if (Math.random() < bonesChance) {
        bonesPrize = caseType === 'legendary' ? 5 : caseType === 'epic' ? 3 : 1;
        player.bones += bonesPrize;
    }
    
    // Шанс на предмет
    const itemChance = caseType === 'legendary' ? 0.8 : caseType === 'epic' ? 0.5 : caseType === 'rare' ? 0.25 : 0.1;
    let itemPrize = null;
    
    if (Math.random() < itemChance) {
        // Выбираем категорию
        const categories = ['avatars', 'frames', 'backgrounds'];
        const category = categories[Math.floor(Math.random() * categories.length)];
        const items = GAME_ITEMS[category];
        
        // Редкость зависит от кейса
        let rarityPool;
        if (caseType === 'legendary') rarityPool = ['epic', 'legendary', 'legendary', 'epic'];
        else if (caseType === 'epic') rarityPool = ['rare', 'epic', 'rare', 'epic'];
        else if (caseType === 'rare') rarityPool = ['common', 'rare', 'common', 'rare'];
        else rarityPool = ['common', 'common', 'common', 'rare'];
        
        const rarity = rarityPool[Math.floor(Math.random() * rarityPool.length)];
        const rareItems = items.filter(i => i.rarity === rarity);
        
        if (rareItems.length > 0) {
            const item = rareItems[Math.floor(Math.random() * rareItems.length)];
            if (!player.inventory[category].includes(item.id)) {
                player.inventory[category].push(item.id);
            }
            itemPrize = { ...item, category };
        }
    }
    
    res.json({
        success: true,
        dogePrize,
        bonesPrize,
        itemPrize,
        newScore: player.score,
        newBones: player.bones
    });
});

// Экипировка предмета
app.post('/api/equip', (req, res) => {
    const { userId, category, itemId } = req.body;
    if (!userId || !category || !itemId) return res.status(400).json({ error: 'Missing params' });
    
    const player = getPlayer(userId);
    
    if (itemId === null) {
        player.equipped[category] = null;
        return res.json({ success: true, equipped: player.equipped });
    }
    
    if (!player.inventory[category] || !player.inventory[category].includes(itemId)) {
        return res.status(400).json({ error: 'Item not owned' });
    }
    
    player.equipped[category] = itemId;
    res.json({ success: true, equipped: player.equipped });
});

// Лидерборд с предметами
app.get('/api/leaderboard', (req, res) => {
    const top = Array.from(players.values())
        .sort((a, b) => b.score - a.score)
        .slice(0, 100)
        .map(p => ({
            username: p.username,
            score: p.score,
            evolution: p.evolution,
            equipped: p.equipped
        }));
    res.json(top);
});

// Все предметы
app.get('/api/items', (req, res) => {
    res.json(GAME_ITEMS);
});

// ==================== TELEGRAM BOT ====================
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
