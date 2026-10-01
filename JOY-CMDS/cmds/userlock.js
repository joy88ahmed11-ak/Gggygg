const fs = require('fs-extra');
const path = require('path');

module.exports = {
    config: {
        name: "userlock",
        aliases: ["lockname", "namelock"],
        version: "1.0.0",
        role: 1, // 1 = Group Admin Only, 2 = Bot Owner Only
        author: "Joy Ahmed",
        cooldown: 3,
        description: "Lock or alert user name and username changes",
        usePrefix: true
    },

    onStart: async function ({ bot, chatId, args, msg, config }) {
        const prefix = config.prefix || '/';

        let targetUser = null;
        let oldFirstName = "";
        let oldUsername = "";

        // ১. Reply করে লক করা
        if (msg.reply_to_message) {
            targetUser = msg.reply_to_message.from;
        } 
        // ২. Mention বা ID দিলে
        else if (msg.entities && msg.entities.length > 1) {
            const mentionEntity = msg.entities.find(e => e.type === 'mention' || e.type === 'text_mention');
            if (mentionEntity && mentionEntity.user) {
                targetUser = mentionEntity.user;
            }
        }

        if (!targetUser && args[0] && !isNaN(args[0])) {
            try {
                const member = await bot.getChatMember(chatId, parseInt(args[0]));
                targetUser = member.user;
            } catch (e) {}
        }

        if (!targetUser) {
            const usageText = 
`⚠️ <b><u>𝚄𝚂𝙴𝚁𝙻𝙾𝙲𝙺  𝚄𝚂𝙰𝙶𝙴</u></b>

👉 <b>ইউজারের প্রোফাইল অ্যালার্ট তৈরি করতে:</b>
• রিপ্লাই দিয়ে লিখুন: <code>${prefix}userlock</code>
• ইউজার আইডি দিয়ে লিখুন: <code>${prefix}userlock 7396577693</code>`;

            return bot.sendMessage(chatId, usageText, {
                parse_mode: 'HTML',
                reply_to_message_id: msg.message_id
            });
        }

        const newFirstName = targetUser.first_name || "No Name";
        const newUsername = targetUser.username ? `@${targetUser.username}` : "No Username";

        // ডেমো বা চেঞ্জ নোটিফিকেশন মেসেজ ফরম্যাট
        const currentDate = new Date().toLocaleString('en-US', { timeZone: 'Asia/Dhaka' });

        const alertText = 
`🚨 <b>USERLOCK DETECTED!</b>
━━━━━━━━━━━━━━━━━━
👤 <b>নাম:</b> ${newFirstName}
🆔 <b>আইডি:</b> <code>${targetUser.id}</code>
🔗 <b>মেনশন:</b> <a href="tg://user?id=${targetUser.id}">${newFirstName}</a>
━━━━━━━━━━━━━━━━━━

📝 <b>পরিবর্তন বিবরণ:</b>
• <b>First:</b> <i>Old Name</i> → <b>${newFirstName}</b>
• <b>Username:</b> <i>@OldUser</i> → <b>${newUsername}</b>

━━━━━━━━━━━━━━━━━━
⏰ <code>${currentDate}</code>`;

        try {
            return await bot.sendMessage(chatId, alertText, {
                parse_mode: 'HTML',
                reply_to_message_id: msg.message_id
            });
        } catch (err) {
            console.error('Userlock Command Error:', err.message);
            return bot.sendMessage(chatId, `❌ <i>মেসেজ পাঠাতে সমস্যা হয়েছে!</i>`, {
                reply_to_message_id: msg.message_id
            });
        }
    }
};
