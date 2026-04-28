const fs = require('fs');

addCommand({ pattern: "^show$", access: "all", desc: "_It allows you to view the view once messages._" }, async (msg, match, sock, rawMessage) => {
    const grupId = msg.key.remoteJid;

    // Reply-to check
    if (!msg.quotedMessage) {
        if (msg.key.fromMe) {
            return await sock.sendMessage(grupId, { text: "_Please reply to a view once message!_", edit: msg.key });
        } else {
            return await sock.sendMessage(grupId, { text: "_Please reply to a view once message!_"}, { quoted: rawMessage.messages[0] });
        }
    }

    // Check if the quoted message is any kind of view-once structure
    const hasViewOnce = msg.quotedMessage?.viewOnceMessage 
        || msg.quotedMessage?.viewOnceMessageV2 
        || msg.quotedMessage?.viewOnceMessageV2Extension;

    if (!hasViewOnce) {
        if (msg.key.fromMe) {
            return await sock.sendMessage(grupId, { text: "_Please reply to a view once message!_", edit: msg.key });
        } else {
            return await sock.sendMessage(grupId, { text: "_Please reply to a view once message!_"}, { quoted: rawMessage.messages[0] });
        }
    }

    // Extract the actual media object from the nested structure
    const media = msg.quotedMessage?.viewOnceMessage?.message?.imageMessage
        || msg.quotedMessage?.viewOnceMessage?.message?.videoMessage
        || msg.quotedMessage?.viewOnceMessageV2?.message?.imageMessage
        || msg.quotedMessage?.viewOnceMessageV2?.message?.videoMessage
        || msg.quotedMessage?.viewOnceMessageV2Extension?.message?.imageMessage
        || msg.quotedMessage?.viewOnceMessageV2Extension?.message?.videoMessage;

    if (!media) {
        if (msg.key.fromMe) {
            return await sock.sendMessage(grupId, { text: "_Could not extract media from this message!_", edit: msg.key });
        } else {
            return await sock.sendMessage(grupId, { text: "_Could not extract media from this message!_"}, { quoted: rawMessage.messages[0] });
        }
    }

    // Determine media type from the extracted object
    const isImage = media.mimetype?.startsWith("image") || !!media.imageMessage;
    const mediaType = isImage ? "image" : "video";
    const extension = isImage ? ".png" : ".mp4";

    const mediaPath = `./viewOnceMessage${Math.floor(Math.random() * 1000)}${extension}`;

    // Download indicator
    const downloadMessage = msg.key.fromMe 
        ? { text: "_⏳ Downloading.._", edit: msg.key } 
        : { text: "_⏳ Downloading.._", quoted: rawMessage.messages[0] };

    const sentMessage = await sock.sendMessage(grupId, downloadMessage);

    // Download the media
    await global.downloadMedia(media, mediaType, mediaPath);

    // Delete the "downloading" status and send the actual media
    const deleteMessage = { delete: msg.key.fromMe ? msg.key : sentMessage.key };
    await sock.sendMessage(grupId, deleteMessage);

    const sendMediaMessage = {
        [mediaType]: { url: mediaPath },
        caption: "_✅ Downloaded!_"
    };

    const finalMessage = msg.key.fromMe 
        ? sendMediaMessage 
        : { ...sendMediaMessage, quoted: rawMessage.messages[0] };

    await sock.sendMessage(grupId, finalMessage);

    // Cleanup
    if (fs.existsSync(mediaPath)) fs.unlinkSync(mediaPath);
});
