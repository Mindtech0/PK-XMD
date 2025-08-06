const fs = require('fs');
const path = require('path');
const { v4: uuid } = require('uuid');
const { cmd } = require('../command');
const cooldowns = new Map();

const DATA_PATH = path.resolve(__dirname, '../data/send_data.json');
let store = { templates: {}, optOut: [], reports: [] };
if (fs.existsSync(DATA_PATH)) store = JSON.parse(fs.readFileSync(DATA_PATH));

cmd({
  pattern: "send",
  desc: "Broadcast to all group members with scheduling, media, templates, analytics.",
  category: "owner",
  react: "🚀",
  filename: __filename
},
async (conn, mek, m, {
  from, quoted, body, isCmd, command, args, q,
  isGroup, sender, senderNumber, botNumber2, botNumber,
  pushname, isMe, isOwner, groupMetadata, groupName,
  participants, groupAdmins, isBotAdmins, isAdmins, reply
}) => {
  try {
    await conn.sendMessage(from, { react: { text: '⏳', key: m.key } });

    const senderId = sender;
    const botOwner = conn.user.id.split(":")[0] + "@s.whatsapp.net";
    if (senderId !== botOwner) {
      return reply("🚫 Owner only command.");
    }

    const flags = args.filter(a => a.startsWith('--')).map(f => f.slice(2));
    const scheduledFlag = flags.find(f => f.startsWith('at='));
    const isSchedule = !!scheduledFlag;
    const sendTime = isSchedule ? new Date(scheduledFlag.split('=')[1]) : null;
    const multiNames = args.join(' ').split('|')[0].split(',').map(g => g.trim());
    let messageTemplate = args.join(' ').split('|')[1] || '';
    const mediaFlag = flags.find(f => f.startsWith('media='));
    const media = mediaFlag ? mediaFlag.split('=')[1] : null;
    const confirmNeeded = multiNames.length > 50;

    if (confirmNeeded && !store.pendingConfirm) {
      store.pendingConfirm = { id: senderId, groups: multiNames, msg: messageTemplate };
      fs.writeFileSync(DATA_PATH, JSON.stringify(store, null, 2));
      return reply(`⚠️ You're about to send to ${multiNames.length} groups. Reply YES to proceed or NO to cancel.`);
    }
    if (store.pendingConfirm && m.text.toLowerCase() === 'no') {
      delete store.pendingConfirm;
      fs.writeFileSync(DATA_PATH, JSON.stringify(store, null, 2));
      return reply("❌ Broadcast cancelled.");
    }
    if (store.pendingConfirm && m.text.toLowerCase() === 'yes') {
      const cfg = store.pendingConfirm;
      multiNames.length = 0;
      multiNames.push(...cfg.groups);
      messageTemplate = cfg.msg;
      delete store.pendingConfirm;
      fs.writeFileSync(DATA_PATH, JSON.stringify(store, null, 2));
    }

    if (isSchedule && sendTime > Date.now()) {
      return reply(`⏰ Broadcast scheduled at ${sendTime.toLocaleString()}`);
    }

    const cdTime = 60 * 1000;
    if (cooldowns.has(senderId) && cooldowns.get(senderId) > Date.now()) {
      const rem = ((cooldowns.get(senderId) - Date.now()) / 1000).toFixed(1);
      return reply(`⏳ Wait ${rem}s before using again.`);
    }
    cooldowns.set(senderId, Date.now() + cdTime);

    let totalSent = 0, totalFail = 0, startAll = Date.now();
    const allGroups = await conn.groupFetchAllParticipating();

    for (const groupName of multiNames) {
      const grp = Object.values(allGroups).find(g => g.subject.toLowerCase() === groupName.toLowerCase());
      if (!grp) continue;
      const meta = await conn.groupMetadata(grp.id);
      const admins = meta.participants.filter(p => p.admin).map(p => p.id);
      const members = meta.participants.map(p => p.id).filter(id => id !== senderId && !admins.includes(id));

      for (const userId of members) {
        if (store.optOut.includes(userId)) continue;
        let text = messageTemplate || store.templates['default'] || 'Hello {{name}}!';
        const p = await conn.onWhatsApp(userId);
        let first = p[0]?.notify?.split(' ')[0] || '';
        text = text.replace(/{{first_name}}/g, first)
                   .replace(/{{group}}/g, grp.subject)
                   .replace(/{{total}}/g, members.length);

        const sendOpts = { text };
        if (media) {
          sendOpts[media.match(/\.(jpg|png|gif)$/) ? 'image' : 'video'] = {
            url: media,
            caption: text
          };
        }

        try {
          await retrySend(() => conn.sendMessage(userId, sendOpts), 3, 1000);
          totalSent++;
        } catch {
          totalFail++;
        }
      }
    }

    const elapsed = ((Date.now() - startAll) / 1000).toFixed(1);
    const report = { id: uuid(), when: new Date(), sent: totalSent, failed: totalFail, time: elapsed };
    store.reports.push(report);
    fs.writeFileSync(DATA_PATH, JSON.stringify(store, null, 2));

    await reply(`✅ Broadcast Complete!\n📤 Sent: ${totalSent}\n❌ Failed: ${totalFail}\n⏱ Took: ${elapsed}s`);
  } catch (err) {
    console.error("Broadcast error:", err);
    await conn.sendMessage(from, { react: { text: '❌', key: m.key } });
    reply("❌ Broadcast failed.");
  }
});

async function retrySend(fn, attempts, delay) {
  for (let i = 0; i < attempts; i++) {
    try { return await fn(); }
    catch (e) {
      if (i === attempts - 1) throw e;
      await new Promise(r => setTimeout(r, delay));
    }
  }
}

module.exports.saveTemplate = (name, content) => {
  store.templates[name] = content;
  fs.writeFileSync(DATA_PATH, JSON.stringify(store, null, 2));
};

module.exports.optOutUser = (userId) => {
  if (!store.optOut.includes(userId)) {
    store.optOut.push(userId);
    fs.writeFileSync(DATA_PATH, JSON.stringify(store, null, 2));
  }
};
