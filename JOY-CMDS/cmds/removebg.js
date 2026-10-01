const axios = require('axios');
const FormData = require('form-data');

module.exports = {
    config: {
        name: "removebg",
        aliases: ["rmbg", "bgremove"],
        version: "1.0.0",
        role: 0,
        author: "JOY",
        description: "Remove background from any image",
        category: "media",
        usePrefix: true,
        cooldown: 5
    },

    onStart: async function ({ bot, chatId, msg, api }) {
        try {
            let photoMessage = null;

            // ১. রিপ্লাই করা মেসেজে ছবি আছে কিনা চেক
            if (msg.reply_to_message && msg.reply_to_message.photo) {
                photoMessage = msg.reply_to_message.photo;
            } 
            // ২. ডিরেক্ট ক্যাপশনসহ ছবি পাঠানো হয়েছে কিনা চেক
            else if (msg.photo) {
                photoMessage = msg.photo;
            }

            if (!photoMessage) {
                return bot.sendMessage(chatId, "⚠️ দয়া করে কোনো ছবির রিপ্লাইয়ে <code>/removebg</code> লিখুন অথবা ছবির ক্যাপশনে কমান্ডটি দিন।", {
                    parse_mode: 'HTML',
                    reply_to_message_id: msg.message_id
                });
            }

            const waitMsg = await bot.sendMessage(chatId, "⏳ ব্যাকগ্রাউন্ড রিমুভ করা হচ্ছে, অনুগ্রহ করে অপেক্ষা করুন...", {
                reply_to_message_id: msg.message_id
            });

            // ছবির সর্বোচ্চ রেজুলেশনের ভার্সন নেওয়া
            const fileId = photoMessage[photoMessage.length - 1].file_id;
            const fileUrl = await bot.getFileLink(fileId);

            // Free API Solution ব্যবহার করে ছবির ব্যাকগ্রাউন্ড রিমুভ
            const response = await axios.get(`https://api.removebg.org/v1/removebg?url=${encodeURIComponent(fileUrl)}`, {
                responseType: 'arraybuffer'
            }).catch(async () => {
                // অল্টারনেটিভ ফ্রি API (যদি ১ম টা কাজ না করে)
                return await axios.get(`https://bckg-remove.vercel.app/api/remove-bg?url=${encodeURIComponent(fileUrl)}`, {
                    responseType: 'arraybuffer'
                });
            });

            const imageBuffer = Buffer.from(response.data, 'binary');

            // প্রসেসিং মেসেজ কেটে ফিনিশিং ব্যাকগ্রাউন্ডলেস ছবি পাঠানো
            await bot.deleteMessage(chatId, waitMsg.message_id);
            await bot.sendDocument(chatId, imageBuffer, {
                reply_to_message_id: msg.message_id,
                caption: "✅ ছবির ব্যাকগ্রাউন্ড সফলভাবে রিমুভ করা হয়েছে!"
            }, {
                filename: 'removebg_joybot.png',
                contentType: 'image/png'
            });

        } catch (err) {
            console.error("RemoveBG Error:", err.message);
            return bot.sendMessage(chatId, "❌ ছবির ব্যাকগ্রাউন্ড রিমুভ করতে ব্যর্থ হয়েছে! আবার চেষ্টা করুন।", {
                reply_to_message_id: msg.message_id
            });
        }
    }
};
