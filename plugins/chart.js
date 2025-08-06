const fs   = require('fs');
const path = require('path');
const { cmd } = require('../command');

const DATA_PATH = path.resolve(__dirname, '../data/send_data.json');

async function buildChartUrl(reports) {
  const labels = reports.map(r =>
    new Date(r.when).toLocaleDateString()
  );
  const dataSent = reports.map(r => r.sent);
  const chartConfig = {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: 'Messages Sent',
        data: dataSent,
        fill: false
      }]
    },
    options: {
      title: {
        display: true,
        text: 'Broadcasts Sent Over Time'
      },
      scales: {
        yAxes: [{ ticks: { beginAtZero: true } }]
      }
    }
  };
  return `https://quickchart.io/chart?c=${encodeURIComponent(JSON.stringify(chartConfig))}`;
}

cmd({
  pattern: "chart",
  desc: "Send a chart of recent broadcasts",
  category: "owner",
  react: "📈",
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
      return reply("ℹ️ No broadcast data to chart.");
    }

    const recent = reports.slice(-10);
    const chartUrl = await buildChartUrl(recent);

    await conn.sendMessage(from, {
      image: { url: chartUrl },
      caption: "📈 Broadcasts Sent Over Last 10 Runs"
    });
  } catch (err) {
    console.error("Chart error:", err);
    return reply("❌ Failed to generate chart.");
  }
});
