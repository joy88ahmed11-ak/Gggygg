const fs = require('fs');
const { downloadVideo } = require('joy-video-downloader');

module.exports = {
    config: {
        name: "autovideo",
        description: "Auto download video from any link sent",
        prefix: false, // Event based
        role: 0
    },

    handleEvent: async function({ event, api, bot }) {
        const msg = event.msg;
        if (!msg || !msg.text) return;

        const chatId = msg.chat.id;
        const text = msg.text.trim();
        const urlMatch = text.match(/https?:\/\/[^\s]+/);
        if (!urlMatch) return;

        const url = urlMatch[0];

        try {
            // Send temporary "please wait" message
            const waitMsg = await bot.sendMessage(chatId, "⏳ 𝗣𝗹𝗲𝗮𝘀𝗲 𝘄𝗮𝗶𝘁, 𝗱𝗼𝘄𝗻𝗹𝗼𝗮𝗱𝗶𝗻𝗴 𝘃𝗶𝗱𝗲𝗼...", {
                reply_to_message_id: msg.message_id
            });

            // Download video
            const { title, filePath } = await downloadVideo(url);
            const videoTitle = title || 'No Title';

            // Inline button markup with Copy Title feature
            const options = {
                caption: `🎬 𝗧𝗶𝘁𝗹𝗲: ${videoTitle}\n\n🌿 ★ 𝗝𝗢𝗬-𝗧𝗚-𝗕𝗢𝗧 ★\n𝗕𝗢𝗧 𝗗𝗘𝗩𝗘𝗟𝗢𝗣𝗘𝗥 𝗝𝗢𝗬 𝗔𝗛𝗠𝗘𝗗`,
                reply_to_message_id: msg.message_id,
                reply_markup: {
                    inline_keyboard: [
                        [
                            { 
                                text: "📋 Copy Title", 
                                copy_text: { text: videoTitle } 
                            }
                        ],
                        [
                            { 
                                text: "🤖 BOT OWNER: JOY AHMED", 
                                url: "https://t.me/JOY_AHMED_88" 
                            }
                        ]
                    ]
                }
            };

            // Send video with caption and buttons
            await bot.sendVideo(chatId, fs.createReadStream(filePath), options);

            // Delete temporary message
            await bot.deleteMessage(chatId, waitMsg.message_id);

            // Remove temp file
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
            }

        } catch (err) {
            console.error("Video download error:", err.message);
            // Failed message suppress direct error to user
        }
    }
};
