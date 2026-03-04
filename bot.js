const {
  Client,
  GatewayIntentBits,
  REST,
  Routes,
  SlashCommandBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  PermissionsBitField,
  EmbedBuilder,
} = require("discord.js");
const fs = require("fs");
const path = require("path");

// --- Database (JSON) ---
const DB_FILE = path.join(__dirname, "database.json");

function readDB() {
  if (!fs.existsSync(DB_FILE)) return { users: {} };
  try {
    const data = fs.readFileSync(DB_FILE, "utf-8");
    return JSON.parse(data);
  } catch (e) {
    return { users: {} };
  }
}

function writeDB(data) {
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
}

function getUser(discordId) {
  const db = readDB();
  if (!db.users[discordId]) {
    db.users[discordId] = { discordId, balance: 0, lastDaily: null };
    writeDB(db);
  }
  return db.users[discordId];
}

function updateUser(discordId, updates) {
  const db = readDB();
  const user = getUser(discordId);
  db.users[discordId] = { ...user, ...updates };
  writeDB(db);
  return db.users[discordId];
}

function updateBalance(discordId, amount) {
  const user = getUser(discordId);
  return updateUser(discordId, { balance: user.balance + amount });
}

// --- Logic Helpers ---
function getEmoji(move) {
  if (move === "pierre") return "🪨";
  if (move === "feuille") return "📄";
  return "✂️";
}

// --- Bot Logic ---
const token = process.env.DISCORD_TOKEN;
const clientId = process.env.DISCORD_CLIENT_ID;

if (!token || !clientId) {
  console.error("ERREUR : DISCORD_TOKEN ou DISCORD_CLIENT_ID manquant.");
  process.exit(1);
}

const commands = [
  new SlashCommandBuilder()
    .setName("argent")
    .setDescription("Voir le solde d'un utilisateur")
    .addUserOption(o => o.setName("utilisateur").setDescription("L'utilisateur dont vous voulez voir le solde").setRequired(false)),
  new SlashCommandBuilder()
    .setName("journalier")
    .setDescription("Récupérer sa récompense quotidienne de 100 pièces"),
  new SlashCommandBuilder()
    .setName("payer")
    .setDescription("Envoyer de l'argent à un autre membre")
    .addUserOption(o => o.setName("utilisateur").setDescription("Le destinataire du paiement").setRequired(true))
    .addIntegerOption(o => o.setName("montant").setDescription("Le montant à envoyer").setRequired(true).setMinValue(1)),
  new SlashCommandBuilder()
    .setName("dropargent")
    .setDescription("Lancer un drop d'argent dans le salon")
    .addIntegerOption(o => o.setName("montant").setDescription("Le montant total du drop").setRequired(true).setMinValue(1)),
  new SlashCommandBuilder()
    .setName("topargent")
    .setDescription("Afficher le classement des 10 joueurs les plus riches"),
  new SlashCommandBuilder()
    .setName("slots")
    .setDescription("Tenter sa chance à la machine à sous")
    .addIntegerOption(o => o.setName("mise").setDescription("Le montant de la mise").setRequired(true).setMinValue(10)),
  new SlashCommandBuilder()
    .setName("duel")
    .setDescription("Défier un membre au Pierre-Feuille-Ciseaux")
    .addUserOption(o => o.setName("adversaire").setDescription("Le membre à défier").setRequired(true))
    .addIntegerOption(o => o.setName("mise").setDescription("Le montant de la mise du duel").setRequired(true).setMinValue(1)),
  new SlashCommandBuilder()
    .setName("dropsurprise")
    .setDescription("Lancer un drop d'argent surprise (Admin uniquement)")
    .setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator),
  new SlashCommandBuilder()
    .setName("adminargent")
    .setDescription("Commandes d'administration pour l'économie")
    .setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator)
    .addSubcommand(s => s
      .setName("ajouter")
      .setDescription("Ajouter de l'argent à un utilisateur")
      .addUserOption(o => o.setName("utilisateur").setDescription("L'utilisateur cible").setRequired(true))
      .addIntegerOption(o => o.setName("montant").setDescription("Le montant à ajouter").setRequired(true).setMinValue(1)))
    .addSubcommand(s => s
      .setName("retirer")
      .setDescription("Retirer de l'argent à un utilisateur")
      .addUserOption(o => o.setName("utilisateur").setDescription("L'utilisateur cible").setRequired(true))
      .addIntegerOption(o => o.setName("montant").setDescription("Le montant à retirer").setRequired(true).setMinValue(1)))
    .addSubcommand(s => s
      .setName("réinitialiser")
      .setDescription("Réinitialiser l'économie (tous les soldes à 0)"))
    .addSubcommand(s => s
      .setName("définir")
      .setDescription("Fixer le solde d'un utilisateur")
      .addUserOption(o => o.setName("utilisateur").setDescription("L'utilisateur cible").setRequired(true))
      .addIntegerOption(o => o.setName("montant").setDescription("Le nouveau montant du solde").setRequired(true).setMinValue(0))),
];

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.on("ready", async () => {
  console.log(`Connecté: ${client.user.tag}`);
  const rest = new REST({ version: "10" }).setToken(token);
  try {
    await rest.put(Routes.applicationCommands(clientId), { body: commands.map(c => c.toJSON()) });
    console.log("Commandes Slash enregistrées avec succès.");
  } catch (e) {
    console.error("Erreur lors de l'enregistrement des commandes :", e);
  }
  
  setInterval(() => {
    client.guilds.cache.forEach(g => {
      const c = g.channels.cache.find(ch => ch.name === "général" && ch.isTextBased());
      if (c) {
        const amt = Math.floor(Math.random() * 401) + 100;
        const row = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId(`drop_${amt}`).setLabel(`Récupérer ${amt} !`).setStyle(ButtonStyle.Success));
        c.send({ content: `🎁 **DROP AUTOMATIQUE !** (${amt} 🪙)`, components: [row] }).catch(console.error);
      }
    });
  }, 4 * 60 * 60 * 1000);
});

client.on("interactionCreate", async (i) => {
  if (i.isChatInputCommand()) {
    const { commandName: cmd } = i;
    if (cmd === "argent") {
      const t = i.options.getUser("utilisateur") || i.user;
      const user = getUser(t.id);
      await i.reply(`${t.username} a **${user.balance}** pièces.`);
    } else if (cmd === "journalier") {
      const u = getUser(i.user.id);
      if (u.lastDaily && Date.now() - u.lastDaily < 86400000) return i.reply({ content: "Déjà fait !", ephemeral: true });
      updateUser(i.user.id, { balance: u.balance + 100, lastDaily: Date.now() });
      await i.reply("100 pièces reçues !");
    } else if (cmd === "payer") {
      const t = i.options.getUser("utilisateur", true), a = i.options.getInteger("montant", true);
      if (getUser(i.user.id).balance < a) return i.reply("Solde insuffisant.");
      updateBalance(i.user.id, -a); updateBalance(t.id, a);
      await i.reply(`Envoyé ${a} à ${t.username}.`);
    } else if (cmd === "dropargent") {
      const a = i.options.getInteger("montant", true);
      if (getUser(i.user.id).balance < a) return i.reply("Solde insuffisant.");
      updateBalance(i.user.id, -a);
      const row = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId(`drop_${a}`).setLabel("Récupérer").setStyle(ButtonStyle.Success));
      await i.reply({ content: `Drop de ${a} !`, components: [row] });
    } else if (cmd === "topargent") {
      const db = readDB();
      const top = Object.values(db.users).sort((a,b) => b.balance-a.balance).slice(0,10);
      const embed = new EmbedBuilder().setTitle("Top 10").setDescription(top.map((u,idx) => `${idx+1}. <@${u.discordId}>: ${u.balance}`).join("\n") || "Aucun utilisateur.").setColor(0xffd700);
      await i.reply({ embeds: [embed] });
    } else if (cmd === "slots") {
      const m = i.options.getInteger("mise", true); 
      const u = getUser(i.user.id);
      if (u.balance < m) return i.reply("Solde insuffisant.");
      const em = ["🍒","🍋","🍊","💎","7️⃣"], r = [em[Math.floor(Math.random()*5)], em[Math.floor(Math.random()*5)], em[Math.floor(Math.random()*5)]];
      let g = -m; if (r[0]===r[1] && r[1]===r[2]) g = m*9; else if (r[0]===r[1] || r[1]===r[2] || r[0]===r[2]) g = m;
      updateBalance(i.user.id, g);
      await i.reply(`🎰 [ ${r.join(" | ")} ] 🎰\n${g>0 ? `Gagné ${g} !` : `Perdu ${m}.`}`);
    } else if (cmd === "duel") {
      const t = i.options.getUser("adversaire", true), m = i.options.getInteger("mise", true);
      if (i.user.id === t.id || t.bot) return i.reply("Impossible.");
      if (getUser(i.user.id).balance < m || getUser(t.id).balance < m) return i.reply("Argent insuffisant.");
      const row = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId(`duel_acc_${i.user.id}_${t.id}_${m}`).setLabel("Accepter").setStyle(ButtonStyle.Success));
      await i.reply({ content: `<@${t.id}>, duel de <@${i.user.id}> (${m} 🪙) !`, components: [row] });
    } else if (cmd === "dropsurprise") {
      const a = Math.floor(Math.random()*401)+100;
      const row = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId(`drop_${a}`).setLabel("Récupérer").setStyle(ButtonStyle.Success));
      await i.reply({ content: `🎁 **DROP SURPRISE !**`, components: [row] });
    } else if (cmd === "adminargent") {
      const s = i.options.getSubcommand(), t = i.options.getUser("utilisateur"), a = i.options.getInteger("montant");
      if (s==="ajouter") updateBalance(t.id, a); 
      else if (s==="retirer") updateBalance(t.id, -a);
      else if (s==="définir") updateUser(t.id, { balance: a }); 
      else if (s==="réinitialiser") { const d=readDB(); Object.values(d.users).forEach(u=>u.balance=0); writeDB(d); }
      await i.reply({ content: "Opération effectuée avec succès.", ephemeral: true });
    }
  } else if (i.isButton()) {
    if (i.customId.startsWith("drop_")) {
      const a = parseInt(i.customId.split("_")[1]); updateBalance(i.user.id, a);
      await i.update({ content: `✅ Récupéré par ${i.user.username} !`, components: [] });
    } else if (i.customId.startsWith("duel_acc_")) {
      const [, , cid, tid, m] = i.customId.split("_");
      if (i.user.id !== tid) return i.reply({ content: "Pas pour toi.", ephemeral: true });
      startDuel(i, cid, tid, parseInt(m), 1, { c: 0, t: 0 });
    } else if (i.customId.startsWith("duel_mv_")) {
      const [, , mv, cid, tid, m, r, cs, ts, movesEnc] = i.customId.split("_");
      if (i.user.id !== cid && i.user.id !== tid) return i.reply({ content: "Pas ton duel.", ephemeral: true });
      const moves = JSON.parse(decodeURIComponent(movesEnc || "{}"));
      if (moves[i.user.id]) return i.reply({ content: "Déjà joué.", ephemeral: true });
      moves[i.user.id] = mv;
      if (Object.keys(moves).length === 2) resolveDuel(i, cid, tid, parseInt(m), parseInt(r), { c: parseInt(cs), t: parseInt(ts) }, moves);
      else {
        const row = duelRow(cid, tid, m, r, cs, ts, JSON.stringify(moves));
        await i.update({ content: "Un joueur a choisi ! À l'autre !", components: [row] });
      }
    } else if (i.customId.startsWith("duel_nxt_")) {
      const [, , cid, tid, m, r, cs, ts] = i.customId.split("_");
      if (i.user.id !== cid && i.user.id !== tid) return;
      startDuel(i, cid, tid, parseInt(m), parseInt(r), { c: parseInt(cs), t: parseInt(ts) });
    }
  }
});

function duelRow(cid, tid, m, r, cs, ts, moves) {
  const enc = encodeURIComponent(moves);
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`duel_mv_pierre_${cid}_${tid}_${m}_${r}_${cs}_${ts}_${enc}`).setLabel("🪨").setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId(`duel_mv_feuille_${cid}_${tid}_${m}_${r}_${cs}_${ts}_${enc}`).setLabel("📄").setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId(`duel_mv_ciseaux_${cid}_${tid}_${m}_${r}_${cs}_${ts}_${enc}`).setLabel("✂️").setStyle(ButtonStyle.Primary)
  );
}

async function startDuel(i, cid, tid, m, r, scores) {
  const row = duelRow(cid, tid, m, r, scores.c, scores.t, "{}");
  const msg = { content: `⚔️ **Manche ${r}** | <@${cid}> vs <@${tid}> | Score: ${scores.c}-${scores.t}`, components: [row] };
  i.deferred || i.replied ? await i.editReply(msg) : await i.update(msg);
}

async function resolveDuel(i, cid, tid, m, r, scores, moves) {
  const cm = moves[cid], tm = moves[tid];
  let res = "Égalité !";
  if (cm !== tm) {
    if ((cm==="pierre"&&tm==="ciseaux")||(cm==="feuille"&&tm==="pierre")||(cm==="ciseaux"&&tm==="feuille")) { scores.c++; res = `<@${cid}> gagne !`; }
    else { scores.t++; res = `<@${tid}> gagne !`; }
  }
  const desc = `${res} (${getEmoji(cm)} vs ${getEmoji(tm)})`;
  if (scores.c >= 2 || scores.t >= 2 || r >= 3) {
    const win = scores.c > scores.t ? cid : (scores.t > scores.c ? tid : null);
    if (win) {
      const lose = win === cid ? tid : cid;
      updateBalance(lose, -m); updateBalance(win, Math.floor(m * 1.1));
      await i.update({ content: `${desc}\n🏆 **<@${win}> gagne le duel !** (+${Math.floor(m*1.1)} pièces)`, components: [] });
    } else await i.update({ content: `${desc}\n🤝 Match nul !`, components: [] });
  } else {
    const row = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId(`duel_nxt_${cid}_${tid}_${m}_${r+1}_${scores.c}_${scores.t}`).setLabel("Manche suivante").setStyle(ButtonStyle.Primary));
    await i.update({ content: `${desc}\nScore: ${scores.c}-${scores.t}`, components: [row] });
  }
}

client.login(token);
