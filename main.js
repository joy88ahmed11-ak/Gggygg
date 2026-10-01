const TelegramBot = require('node-telegram-bot-api');
const config = require('./config.json');
const fs = require('fs-extra');
const path = require('path');
const cron = require('node-cron');
const axios = require('axios');
const gradient = require('gradient-string');
const express = require('express');

// ================= RENDER PORT SERVER =================
const app = express();
const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => {
    res.send('🤖 JOY Telegram Bot is Running Live!');
});

app.listen(PORT, () => {
    console.log(`🌐 Server active & listening on port: ${PORT}`);
});

// ================= JOY CORE & CONSOLE =================
require('./JOY/utils.js');
const TelegramAdapter = require('./JOY/telegram-adapter.js');
const checkVersion = require('./JOY/update.js');
require('./JOY/concole.js'); // Custom Console Logger
const { getInvalidCmdMsg } = require('./JOY/joy.js');

// ================= GLOBAL TRACKERS =================
global.activeSpamIntervals = global.activeSpamIntervals || [];

// ================= FILE PATHS =================
const chatGroupsFile = path.join(__dirname, 'chatGroups.json');
const messageCountFile = path.join(__dirname, 'messageCount.json');
const userDataFile = path.join(__dirname, 'userData.json');
const configFile = path.join(__dirname, 'config.json');

// ================= FILE INIT =================
if (!fs.existsSync(messageCountFile)) fs.writeFileSync(messageCountFile, JSON.stringify({}), 'utf8');
if (!fs.existsSync(chatGroupsFile)) fs.writeFileSync(chatGroupsFile, JSON.stringify([]), 'utf8');
if (!fs.existsSync(userDataFile)) fs.writeFileSync(userDataFile, JSON.stringify({}), 'utf8');

let chatGroups = JSON.parse(fs.readFileSync(chatGroupsFile, 'utf8'));
let globalHandleButton = []; 
global.globalHandleReply = []; 

// ================= GH-GBAN SYSTEM =================
const GBAN_GITHUB_URL = 'https://raw.githubusercontent.com/JUBAED-AHMED-JOY/Joy/main/gban.json';
let cachedGbanList = [];
let lastGbanFetchTime = 0;
const GBAN_CACHE_DURATION = 60 * 1000; // 1 Minute Cache

async function fetchGithubGbanList() {
    const now = Date.now();
    if (cachedGbanList.length > 0 && (now - lastGbanFetchTime) < GBAN_CACHE_DURATION) {
        return cachedGbanList;
    }

    try {
        const response = await axios.get(GBAN_GITHUB_URL, { timeout: 5000 });
        if (Array.isArray(response.data)) {
            cachedGbanList = response.data;
            lastGbanFetchTime = now;
        }
    } catch (err) {
        console.error('❌ GBAN Github Fetch Error:', err.message);
    }
    return cachedGbanList;
}

// ================= HELPER: GET LATEST CONFIG =================
function getLatestConfig() {
    try {
        delete require.cache[require.resolve(configFile)];
        return require('./config.json');
    } catch {
        return config;
    }
}

// ================= BOT TOKEN CHECK =================
const botToken = process.env.TELEGRAM_BOT_TOKEN || config.token;
if (!botToken || botToken.includes('PUT_YOUR_TELEGRAM_BOT_TOKEN_HERE')) {
    console.log(' Please set your bot token in config.json or the TELEGRAM_BOT_TOKEN env variable.');
    process.exit(1);
}

// ================= BOT INIT =================
const bot = new TelegramBot(botToken, { polling: true });

const commands = [];
const events = [];
const cooldowns = new Map();

// ================= TELEGRAM MENU COMMANDS UPDATER =================
async function updateBotCommands() {
    try {
        const botCommands = commands
            .filter(cmd => cmd.config && cmd.config.name)
            .map(cmd => ({
                command: cmd.config.name.toLowerCase().replace(/[^a-z0-9_]/g, ''),
                description: cmd.config.description || "Joy Bot Command"
            }));

        if (botCommands.length > 0) {
            await bot.setMyCommands(botCommands);
        }
    } catch (err) {
        console.error("❌ Error setting bot commands menu:", err.message);
    }
}

// ================= HELPER: ESCAPE REGEX PREFIX =================
function escapeRegex(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// ================= LOGGER =================
function logger(message) {
    try {
        console.log(gradient.pastel(message));
    } catch {
        console.log(message);
    }
}

// ================= GLOBAL RELOAD FUNCTION =================
global.reloadBot = function () {
    if (global.activeSpamIntervals && global.activeSpamIntervals.length > 0) {
        global.activeSpamIntervals.forEach(timer => clearInterval(timer));
        global.activeSpamIntervals = [];
    }

    commands.length = 0;
    events.length = 0;
    global.globalHandleReply = [];
    globalHandleButton = [];

    const cmdsDir = path.join(__dirname, 'JOY-CMDS', 'cmds');
    if (fs.existsSync(cmdsDir)) {
        fs.readdirSync(cmdsDir).forEach(file => {
            if (!file.endsWith('.js')) return;
            try {
                const filePath = path.join(cmdsDir, file);
                delete require.cache[require.resolve(filePath)]; 
                const command = require(filePath);
                
                if (command && command.config && command.config.name) {
                    if (command.config.role === undefined) command.config.role = 0;
                    if (!command.config.cooldown) command.config.cooldown = 0;

                    commands.push({
                        ...command,
                        config: { 
                            ...command.config, 
                            name: command.config.name.toLowerCase(),
                            aliases: Array.isArray(command.config.aliases) ? command.config.aliases.map(a => a.toLowerCase()) : []
                        }
                    });
                }
            } catch (err) {
                console.error(` Error loading command ${file}: ${err.message}`);
            }
        });
    }

    const eventsDir = path.join(__dirname, 'JOY-CMDS', 'events');
    if (fs.existsSync(eventsDir)) {
        fs.readdirSync(eventsDir).forEach(file => {
            if (!file.endsWith('.js')) return;
            try {
                const filePath = path.join(eventsDir, file);
                delete require.cache[require.resolve(filePath)]; 
                const eventModule = require(filePath);
                if (typeof eventModule.handleEvent === 'function') {
                    events.push(eventModule);
                }
            } catch (err) {
                console.error(` Error loading event ${file}: ${err.message}`);
            }
        });
    }

    // Telegram Popup Commands Menu Update
    updateBotCommands();

    return commands.length;
};

// INITIAL LOAD
global.reloadBot();

// ================= EVENT LISTENER =================
bot.on('message', async (msg) => {
    for (const eventModule of events) {
        try {
            await eventModule.handleEvent({
                event: { msg, body: msg.text || '' },
                api: new TelegramAdapter(bot),
                bot
            });
        } catch (err) {
            console.error(' Event Error:', err.message);
        }
    }
});

// ================= CALLBACK QUERY HANDLER =================
bot.on('callback_query', async (query) => {
    const handle = globalHandleButton.find(h => h.messageID === query.message.message_id);
    if (!handle) return;

    const event = {
        threadId: query.message.chat.id,
        button: query.data
    };

    try {
        if (typeof handle.handleButton === 'function') {
            await handle.handleButton({ bot, event, handleButton: handle });
        }
    } catch (err) {
        console.error(' Error in button handler:', err);
        bot.sendMessage(event.threadId, ' Failed to handle button.');
    }
});

// ================= ADMIN CHECK =================
async function isGroupAdmin(bot, chatId, userId) {
    try {
        if (chatId > 0) return false; // Private Chat
        const admins = await bot.getChatAdministrators(chatId);
        return admins.some(a => a.user.id === userId);
    } catch {
        return false;
    }
}

function isBotAdmin(userId, currentConfig) {
    const ownerId = (currentConfig.owner_id || '').toString();
    const adminIds = Array.isArray(currentConfig.admin_ids) ? currentConfig.admin_ids.map(id => id.toString()) : [];
    const uid = userId.toString();
    return uid === ownerId || adminIds.includes(uid);
}

// ================= EXEC COMMAND =================
async function executeCommand(bot, command, msg, args) {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const currentConfig = getLatestConfig();
    const startTime = Date.now();

    try {
        const isOwner = userId.toString() === (currentConfig.owner_id || '').toString();
        const isAdmin = isBotAdmin(userId, currentConfig);
        const isGrpAdmin = await isGroupAdmin(bot, chatId, userId);

        if (currentConfig.admin_only_mode && !isAdmin) {
            return bot.sendMessage(chatId, '🔒 Bot is currently in Admin-Only mode.');
        }

        // ROLE PERMISSION CHECK
        if (command.config.role === 2 && !isOwner && !isAdmin) {
            return bot.sendMessage(chatId, '⚠️ Only Bot Admins/Owner can use this command.');
        }
        if (command.config.role === 1 && !isGrpAdmin && !isAdmin && !isOwner) {
            return bot.sendMessage(chatId, '⚠️ Only Group Admins can use this command.');
        }

        // COOLDOWN CHECK
        const cdKey = `${command.config.name}-${userId}`;
        const now = Date.now();
        const cd = (command.config.cooldown || 0) * 1000;

        if (cooldowns.has(cdKey)) {
            const last = cooldowns.get(cdKey);
            if (now < last + cd) {
                const wait = Math.ceil((last + cd - now) / 1000);
                return bot.sendMessage(chatId, `⏳ Please wait ${wait}s before reusing this command.`);
            }
        }
        cooldowns.set(cdKey, now);

        const api = new TelegramAdapter(bot);

        await command.onStart({
            bot,
            chatId,
            args,
            userId,
            msg,
            api,
            config: currentConfig,
            commands,
            message: { 
                reply: t => {
                    if (global.ConsoleLogger) global.ConsoleLogger.botReply(chatId, t);
                    return bot.sendMessage(chatId, t, { reply_to_message_id: msg.message_id });
                }
            },
            event: {
                threadID: chatId,
                messageID: msg.message_id,
                senderID: userId,
                body: msg.text || ''
            },
            globalHandleButton
        });

        // CONSOLE SUCCESS LOG
        if (global.ConsoleLogger) {
            global.ConsoleLogger.cmdSuccess(command.config.name, userId, Date.now() - startTime);
        }

    } catch (err) {
        // CONSOLE FAIL LOG
        if (global.ConsoleLogger) {
            global.ConsoleLogger.cmdFail(command.config.name, userId, err.message);
        }
        console.error('Command Execution Error:', err);
        bot.sendMessage(chatId, `❌ Error: ${err.message}`);
    }
}

// ================= MESSAGE & COMMAND DISPATCHER =================
bot.on('message', async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from ? msg.from.id : null;

    if (!userId) return;

    // 📥 CONSOLE INCOMING MESSAGE LOG
    if (global.ConsoleLogger) {
        global.ConsoleLogger.incomingMsg(msg);
    }

    // ⛔ GITHUB GBAN CHECK
    const gbanList = await fetchGithubGbanList();
    const bannedUser = gbanList.find(user => user.uid && user.uid.toString() === userId.toString());

    if (bannedUser) {
        const customReason = bannedUser.reason || bannedUser.text || "You are globally banned from using this bot.";
        const alertText = 
`🚫 <b>GLOBAL BAN DETECTED!</b>
━━━━━━━━━━━━━━━━━━
👤 <b>Name:</b> ${msg.from.first_name || 'User'}
🆔 <b>ID:</b> <code>${userId}</code>
━━━━━━━━━━━━━━━━━━

💬 <b>Reason:</b> ${customReason}`;

        if (global.ConsoleLogger) global.ConsoleLogger.botReply(chatId, alertText);

        return bot.sendMessage(chatId, alertText, {
            parse_mode: 'HTML',
            reply_to_message_id: msg.message_id
        });
    }

    const currentConfig = getLatestConfig();

    // Message tracking
    try {
        const data = fs.readJsonSync(messageCountFile, { throws: false }) || {};
        if (!data[chatId]) data[chatId] = {};
        if (!data[chatId][userId]) data[chatId][userId] = 0;
        data[chatId][userId]++;
        fs.writeJsonSync(messageCountFile, data);
    } catch (e) {}

    if (!chatGroups.includes(chatId)) {
        chatGroups.push(chatId);
        fs.writeJsonSync(chatGroupsFile, chatGroups);
    }

    // Auto welcome in PM
    if (!msg.from.is_bot && msg.chat.type === 'private') {
        const notifiedUsers = fs.readJsonSync(userDataFile, { throws: false }) || {};
        if (!notifiedUsers[userId]) {
            try {
                const startCommand = commands.find(c => c.config.name === "start");
                if (startCommand && startCommand.onStart) {
                    startCommand.onStart({ bot, chatId, msg, config: currentConfig });
                }
            } catch (err) {}

            notifiedUsers[userId] = true;
            fs.writeJsonSync(userDataFile, notifiedUsers);
        }
    }

    // MESSAGE REPLY TRACKING
    if (msg.reply_to_message && global.globalHandleReply.length > 0) {
        const repliedMsgId = msg.reply_to_message.message_id;
        const replyIndex = global.globalHandleReply.findIndex(item => item.messageID === repliedMsgId);

        if (replyIndex !== -1) {
            const handleData = global.globalHandleReply[replyIndex];
            try {
                if (typeof handleData.handleReply === 'function') {
                    await handleData.handleReply({
                        bot,
                        event: {
                            threadId: chatId,
                            messageID: msg.message_id,
                            senderID: userId,
                            body: msg.text || ''
                        },
                        handleReply: handleData
                    });
                    return;
                }
            } catch (err) {
                console.error(' Error handling reply:', err.message);
            }
        }
    }

    if (!msg.text) return;
    const text = msg.text.trim();
    const prefix = currentConfig.prefix || '/';

    // ONLY PREFIX HANDLER
    if (text === prefix) {
        const slashCmd = commands.find(c => c.config.name === "___only_slash___" || c.config.name === "joy" || c.config.name === "prefix");
        if (slashCmd) {
            return await slashCmd.onStart({
                bot,
                chatId,
                args: [],
                userId,
                msg,
                config: currentConfig,
                commands,
                globalHandleButton
            });
        }
    }

    // COMMAND PARSING
    let isCommandExecuted = false;

    if (text.startsWith(prefix)) {
        const inputWithoutPrefix = text.slice(prefix.length).trim();
        const splitArgs = inputWithoutPrefix.split(/\s+/);
        const inputCmdName = splitArgs[0] ? splitArgs[0].toLowerCase() : '';
        const args = splitArgs.slice(1);

        if (inputCmdName) {
            // Find command matching name or aliases
            const matchedCmd = commands.find(cmd => 
                cmd.config.name === inputCmdName || 
                (Array.isArray(cmd.config.aliases) && cmd.config.aliases.includes(inputCmdName))
            );

            if (matchedCmd) {
                isCommandExecuted = true;
                await executeCommand(bot, matchedCmd, msg, args);
            } else {
                // Command Not Found Alert
                const notFoundMsg = getInvalidCmdMsg(prefix, inputCmdName);
                if (global.ConsoleLogger) global.ConsoleLogger.botReply(chatId, notFoundMsg);

                return bot.sendMessage(chatId, notFoundMsg, { 
                    reply_to_message_id: msg.message_id,
                    parse_mode: 'HTML'
                });
            }
        }
    } else {
        // No-prefix command checker
        const splitArgs = text.split(/\s+/);
        const inputCmdName = splitArgs[0] ? splitArgs[0].toLowerCase() : '';
        const args = splitArgs.slice(1);

        const noPrefixCmd = commands.find(cmd => 
            cmd.config.usePrefix === false && 
            (cmd.config.name === inputCmdName || (Array.isArray(cmd.config.aliases) && cmd.config.aliases.includes(inputCmdName)))
        );

        if (noPrefixCmd) {
            await executeCommand(bot, noPrefixCmd, msg, args);
        }
    }
});

// ================= START =================
(async () => {
    await checkVersion();
    const currentConfig = getLatestConfig();

    // Telegram Commands Menu Auto-Register
    await updateBotCommands();

    logger(` 🤖 ${currentConfig.bot_name || 'JOY BOT'} Started Successfully!`);
    logger(` 📌 Commands loaded: ${commands.length}`);
    logger(` 📌 Events loaded: ${events.length}`);
    logger(` 👑 Owner: ${currentConfig.owner_name}`);
    logger(` ⚙️ Prefix: ${currentConfig.prefix}`);
})();

// ================= ERROR CATCHERS =================
process.on('unhandledRejection', (reason, promise) => {
    console.error('⚠️ Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (err) => {
    console.error('❌ Uncaught Exception:', err);
});
