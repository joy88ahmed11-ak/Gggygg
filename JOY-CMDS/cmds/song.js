const axios = require("axios");
const yts = require("yt-search");
const fs = require("fs-extra");
const path = require("path");
const { downloadVideo } = require("joy-video-downloader");

// Temp search cache for button callbacks
const songSearchResults = new Map();

module.exports = {
  config: {
    author: "JOY AHMED",
    name: "song",
    aliases: ["sing", "music"],
    usePrefix: true,
    role: 0,
    cooldown: 5,
    description: "Search and download songs with inline selection buttons"
  },

  onStart: async function ({ bot, chatId, msg, args }) {
    const messageId = msg ? msg.message_id : undefined;

    if (!args.length) {
      return bot.sendMessage(chatId, "⚠️ গানের নাম অথবা ইউটিউব লিঙ্ক দাও।", {
        reply_to_message_id: messageId
      });
    }

    const query = args.join(" ");

    try {
      // 🔍 Direct Youtube Link Check
      if (query.includes("youtu.be") || query.includes("youtube.com")) {
        return handleDirectDownload(bot, chatId, query, messageId);
      }

      // 🔍 Search top 5 videos
      const search = await yts(query);
      const videos = search.videos.slice(0, 5);

      if (!videos.length) {
        return bot.sendMessage(chatId, "❌ গানটি খুঁজে পাওয়া যায়নি।", {
          reply_to_message_id: messageId
        });
      }

      // 📜 Build numbered list text
      let listText = `🎵 <b>YOUTUBE MUSIC SEARCH</b>\n\n`;
      videos.forEach((vid, index) => {
        listText += `<b>${index + 1}.</b> ${vid.title}\n⏱️ <i>Duration:</i> ${vid.timestamp} | 👤 <i>Channel:</i> ${vid.author.name}\n\n`;
      });
      listText += `👇 <i>নিচের বাটন চেপে আপনার পছন্দের গানটি ডাউনলোড করুন:</i>`;

      // 🔘 Inline Keyboard Buttons (1 to 5)
      const inlineKeyboard = [
        videos.map((vid, idx) => ({
          text: `🎵 ${idx + 1}`,
          callback_data: `song_select_${chatId}_${idx}`
        }))
      ];

      // Send image with list and buttons
      const sentMsg = await bot.sendPhoto(chatId, videos[0].thumbnail, {
        caption: listText,
        parse_mode: 'HTML',
        reply_to_message_id: messageId,
        reply_markup: {
          inline_keyboard: inlineKeyboard
        }
      });

      // Save search data temporarily
      songSearchResults.set(`song_cache_${chatId}`, {
        videos: videos,
        messageId: sentMsg.message_id
      });

      // Auto clear search cache after 5 minutes
      setTimeout(() => {
        songSearchResults.delete(`song_cache_${chatId}`);
      }, 5 * 60 * 1000);

    } catch (error) {
      console.error("SONG SEARCH ERROR:", error.message);
      return bot.sendMessage(chatId, "❌ গান সার্চ করার সময় সমস্যা হয়েছে!", {
        reply_to_message_id: messageId
      });
    }
  }
};

// ================= CALLBACK BUTTON LISTENER =================
if (global.bot) {
  global.bot.on('callback_query', async (query) => {
    const data = query.data;
    if (!data.startsWith('song_select_')) return;

    const bot = global.bot;
    const chatId = query.message.chat.id;
    const selectedIndex = parseInt(data.split('_').pop(), 10);

    const cacheKey = `song_cache_${chatId}`;
    const cachedData = songSearchResults.get(cacheKey);

    if (!cachedData || !cachedData.videos[selectedIndex]) {
      return bot.answerCallbackQuery(query.id, {
        text: "⚠️ এই সার্চ সেশনটি মেয়াদোত্তীর্ণ হয়ে গেছে! আবার নতুন করে /song লিখুন।",
        show_alert: true
      });
    }

    const selectedSong = cachedData.videos[selectedIndex];

    // Answer callback popup
    await bot.answerCallbackQuery(query.id, { text: `⏳ "${selectedSong.title}" ডাউনলোড শুরু হচ্ছে...` });

    // Download and send song
    await downloadAndSendAudio(bot, chatId, selectedSong.url, selectedSong.title, query.message.message_id);

    // Clean up cache
    songSearchResults.delete(cacheKey);
  });
}

// ================= HELPER FUNCTIONS =================
async function downloadAndSendAudio(bot, chatId, ytUrl, defaultTitle, replyMsgId) {
  const loadingMsg = await bot.sendMessage(chatId, `⏳ <b>${defaultTitle}</b>\n\nডাউনলোড হচ্ছে, অনুগ্রহ করে অপেক্ষা করুন...`, {
    parse_mode: 'HTML',
    reply_to_message_id: replyMsgId
  });

  const cacheDir = path.resolve(__dirname, "cache");
  if (!fs.existsSync(cacheDir)) fs.mkdirSync(cacheDir, { recursive: true });

  const filePath = path.join(cacheDir, `song_${Date.now()}.mp3`);

  try {
    const data = await downloadVideo(ytUrl, filePath);

    await bot.deleteMessage(chatId, loadingMsg.message_id).catch(() => {});

    if (!data || !data.filePath || !fs.existsSync(data.filePath)) {
      return bot.sendMessage(chatId, "❌ গানটি ডাউনলোড করা সম্ভব হয়নি!", {
        reply_to_message_id: replyMsgId
      });
    }

    const title = data.title || defaultTitle;

    await bot.sendAudio(chatId, fs.createReadStream(data.filePath), {
      caption: `🎵 <b>${title}</b>\n\n✅ <b>Download Complete!</b>`,
      parse_mode: 'HTML',
      reply_to_message_id: replyMsgId
    });

    if (fs.existsSync(data.filePath)) {
      fs.unlinkSync(data.filePath);
    }
  } catch (err) {
    console.error("DOWNLOAD ERROR:", err.message);
    await bot.deleteMessage(chatId, loadingMsg.message_id).catch(() => {});
    return bot.sendMessage(chatId, "❌ ডাউনলোড করার সময় সমস্যা হয়েছে!", {
      reply_to_message_id: replyMsgId
    });
  }
}

async function handleDirectDownload(bot, chatId, url, messageId) {
  return downloadAndSendAudio(bot, chatId, url, "Audio Track", messageId);
}
