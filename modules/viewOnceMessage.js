const fs = require('fs');

addCommand({ pattern: "^show$", access: "all", desc: "_It allows you to view the view once messages._" }, async (msg, match, sock, rawMessage) => {
    try {
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
        let media = null;
        let mediaType = null;
        
        // Try to find image or video in any of the possible view-once structures
        const viewOnceStructures = [
            msg.quotedMessage?.viewOnceMessage?.message,
            msg.quotedMessage?.viewOnceMessageV2?.message,
            msg.quotedMessage?.viewOnceMessageV2Extension?.message
        ];
        
        for (const structure of viewOnceStructures) {
            if (!structure) continue;
            
            if (structure.imageMessage) {
                media = structure.imageMessage;
                mediaType = "image";
                break;
            } else if (structure.videoMessage) {
                media = structure.videoMessage;
                mediaType = "video";
                break;
            }
        }

        if (!media) {
            if (msg.key.fromMe) {
                return await sock.sendMessage(grupId, { text: "_Could not extract media from this message!_", edit: msg.key });
            } else {
                return await sock.sendMessage(grupId, { text: "_Could not extract media from this message!_"}, { quoted: rawMessage.messages[0] });
            }
        }

        // Determine file extension
        const extension = mediaType === "image" ? ".png" : ".mp4";
        const timestamp = Date.now();
        const mediaPath = `./viewOnceMessage_${timestamp}${extension}`;

        // Download indicator
        const downloadMessage = msg.key.fromMe 
            ? { text: "_⏳ Downloading.._", edit: msg.key } 
            : { text: "_⏳ Downloading.._", quoted: rawMessage.messages[0] };

        const sentMessage = await sock.sendMessage(grupId, downloadMessage);

        // Download the media - replace this with your actual download function
        try {
            // This is likely where your issue is - replace with your actual download method
            if (typeof global.downloadMedia === 'function') {
                await global.downloadMedia(media, mediaType, mediaPath);
            } else {
                // Alternative download method using the Baileys library if available
                const stream = await sock.downloadMediaMessage(msg.quotedMessage);
                const writeStream = fs.createWriteStream(mediaPath);
                stream.pipe(writeStream);
                
                await new Promise((resolve, reject) => {
                    writeStream.on('finish', resolve);
                    writeStream.on('error', reject);
                });
            }
        } catch (downloadError) {
            console.error("Download error:", downloadError);
            
            // Update the message with error
            const errorMessage = msg.key.fromMe 
                ? { text: "_❌ Failed to download media!_", edit: msg.key } 
                : { text: "_❌ Failed to download media!_", edit: sentMessage.key };
            
            await sock.sendMessage(grupId, errorMessage);
            return;
        }

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

        // Cleanup - use a timeout to ensure the message is sent before deleting
        setTimeout(() => {
            if (fs.existsSync(mediaPath)) {
                try {
                    fs.unlinkSync(mediaPath);
                } catch (cleanupError) {
                    console.error("Cleanup error:", cleanupError);
                }
            }
        }, 5000);
        
    } catch (error) {
        console.error("Show command error:", error);
        const grupId = msg.key.remoteJid;
        await sock.sendMessage(grupId, { text: "_❌ An error occurred!_" }, { quoted: rawMessage.messages[0] });
    }
});
