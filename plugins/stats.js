const fs   = require('fs');
const path = require('path');
const { cmd } = require('../command');

const DATA_PATH = path.resolve(__dirname, '../data/send_data.json');

cmd({
  pattern: "stats",
  desc: "Show broadcast analytics summary",
  category: "owner",
  react: "📊",
  filename: __filename
},
async (conn, mek, m, {
  from, sender, reply, isOwner
}) => {
  try {
    const botOwner = conn.user.id.split(":")[0] + "@s.whatsapp.net";
    if (sender !== botOwner) return reply("🚫 Owner only.");

    const store = fs.existsSync(DATA_PATH)
      ? JSON.parse(fs.readFileSync(DATA_PATH))
      : { reports: [] };
    const reports = store.reports || [];
    if (!reports.length) {
      return reply("ℹ️ No broadcast reports available yet.");
    }

    const recent = reports.slice(-5).reverse();
    let text = "📊 *Broadcast Stats (Last 5)*\n\n";
    recent.forEach((r, i) => {
      const when = new Date(r.when).toLocaleString();
      text += `*${i+1}.* ${when}\n`
           + `   Sent: ${r.sent} | Failed: ${r.failed}\n`
           + `   Time: ${r.time}s\n\n`;
    });

    const totalSent = reports.reduce((sum, r) => sum + r.sent, 0);
    const totalFail = reports.reduce((sum, r) => sum + r.failed, 0);
    text += `*Total Sent:* ${totalSent}\n*Total Failed:* ${totalFail}`;

    return reply(text);
  } catch (err) {
    console.error("Stats error:", err);
    return reply("❌ Failed to load stats.");
  }
});
