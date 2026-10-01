const readline = require('readline');
const gradient = require('gradient-string');

// ================= CUSTOM CONSOLE LOGGER =================
const ConsoleLogger = {
    incomingMsg: (msg) => {
        const chatType = msg.chat.type === 'private' ? 'INBOX/PM' : `GROUP (${msg.chat.title || msg.chat.id})`;
        const sender = `${msg.from.first_name || ''} ${msg.from.last_name || ''}`.trim() || 'Unknown';
        const text = msg.text || '[Media / Non-text message]';

        // gradient.cyan এর জায়গায় সঠিক gradient.cristal ব্যবহার করা হয়েছে
        console.log(gradient.cristal(`\n📥 [NEW MESSAGE] [${chatType}]`));
        console.log(`👤 From: ${sender} (ID: ${msg.from.id})`);
        console.log(`💬 Text: ${text}`);
    },

    cmdSuccess: (cmdName, userId, executionTime) => {
        console.log(gradient.pastel(`✅ [CMD SUCCESS] Command: /${cmdName} | Executed by ID: ${userId} | Time: ${executionTime}ms`));
    },

    cmdFail: (cmdName, userId, error) => {
        console.log(gradient.fruit(`❌ [CMD FAIL] Command: /${cmdName} | User ID: ${userId}`));
        console.log(`⚠️ Error Details: ${error}`);
    },

    botReply: (chatId, text) => {
        const cleanText = text ? text.replace(/\n/g, ' ') : '[Media/Options]';
        const shortText = cleanText.length > 80 ? cleanText.substring(0, 80) + '...' : cleanText;
        console.log(gradient.morning(`📤 [BOT REPLIED] To Chat ID: ${chatId}`));
        console.log(`🤖 Reply: ${shortText}`);
    }
};

global.ConsoleLogger = ConsoleLogger;

// ================= TERMINAL COMMAND INPUT =================
function initConsoleCommands() {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });

    rl.on('line', (line) => {
        const input = line.trim();
        if (!input) return;

        const args = input.split(/\s+/);
        const cmd = args[0].toLowerCase();

        switch (cmd) {
            case 'reload':
            case 'restart':
                if (typeof global.reloadBot === 'function') {
                    const loadedCmds = global.reloadBot();
                    console.log(gradient.rainbow(`\n🔄 [JOY CORE] Bot reloaded successfully! Loaded ${loadedCmds} commands.\n`));
                } else {
                    console.log('❌ global.reloadBot function is not defined.');
                }
                break;

            case 'status':
            case 'info':
                console.log(gradient.pastel(`
📊 === JOY BOT STATUS ===
📌 Server Port: ${process.env.PORT || 3000}
⏱️ Uptime: ${Math.floor(process.uptime())}s
💾 Memory Usage: ${(process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2)} MB
========================
                `));
                break;

            case 'clear':
            case 'cls':
                console.clear();
                console.log(gradient.mind('🧹 Terminal cleared!'));
                break;

            case 'exit':
            case 'stop':
                console.log(gradient.fruit('\n🛑 Shutting down JOY Bot...\n'));
                process.exit(0);

            case 'help':
                console.log(`
💡 === CONSOLE COMMANDS ===
• reload / restart - Re-loads all bot commands & events
• status / info    - Shows memory usage & bot uptime
• clear / cls      - Clears the terminal screen
• exit / stop      - Stops the bot
==========================
                `);
                break;

            default:
                console.log(`⚠️ Unknown console command: "${cmd}". Type "help" for available commands.`);
                break;
        }
    });
}

initConsoleCommands();
