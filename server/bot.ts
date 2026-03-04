import {
  Client,
  GatewayIntentBits,
  REST,
  Routes,
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  PermissionsBitField,
  EmbedBuilder,
} from "discord.js";
import { storage } from "./storage";

const commands = [
  new SlashCommandBuilder()
    .setName("argent")
    .setDescription("Afficher le solde d'un utilisateur")
    .addUserOption((option) =>
      option.setName("utilisateur").setDescription("L'utilisateur à vérifier").setRequired(false)
    ),
  new SlashCommandBuilder()
    .setName("journalier")
    .setDescription("Récupérer votre récompense quotidienne de 100 pièces"),
  new SlashCommandBuilder()
    .setName("payer")
    .setDescription("Envoyer de l'argent à un membre")
    .addUserOption((option) =>
      option.setName("utilisateur").setDescription("L'utilisateur à payer").setRequired(true)
    )
    .addIntegerOption((option) =>
      option.setName("montant").setDescription("Montant à envoyer").setRequired(true).setMinValue(1)
    ),
  new SlashCommandBuilder()
    .setName("dropargent")
    .setDescription("Créer un drop d'argent avec un bouton")
    .addIntegerOption((option) =>
      option.setName("montant").setDescription("Montant à dropper").setRequired(true).setMinValue(1)
    ),
  new SlashCommandBuilder()
    .setName("topargent")
    .setDescription("Classement des 10 plus riches"),
  new SlashCommandBuilder()
    .setName("slots")
    .setDescription("Jouer à la machine à sous")
    .addIntegerOption((option) =>
      option.setName("mise").setDescription("Le montant à parier").setRequired(true).setMinValue(10)
    ),
  new SlashCommandBuilder()
    .setName("duel")
    .setDescription("Défier un membre en duel au Pierre-Feuille-Ciseaux")
    .addUserOption((option) =>
      option.setName("adversaire").setDescription("Le membre à défier").setRequired(true)
    )
    .addIntegerOption((option) =>
      option.setName("mise").setDescription("Le montant à parier").setRequired(true).setMinValue(1)
    ),
  new SlashCommandBuilder()
    .setName("dropsurprise")
    .setDescription("Lancer un drop d'argent surprise (Admin uniquement)")
    .setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator),
  new SlashCommandBuilder()
    .setName("adminargent")
    .setDescription("Commandes d'administration économique")
    .setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator)
    .addSubcommand((subcommand) =>
      subcommand
        .setName("ajouter")
        .setDescription("Ajouter de l'argent à un membre")
        .addUserOption((option) =>
          option.setName("utilisateur").setDescription("L'utilisateur").setRequired(true)
        )
        .addIntegerOption((option) =>
          option.setName("montant").setDescription("Montant à ajouter").setRequired(true).setMinValue(1)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("retirer")
        .setDescription("Retirer de l'argent à un membre")
        .addUserOption((option) =>
          option.setName("utilisateur").setDescription("L'utilisateur").setRequired(true)
        )
        .addIntegerOption((option) =>
          option.setName("montant").setDescription("Montant à retirer").setRequired(true).setMinValue(1)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("réinitialiser")
        .setDescription("Réinitialiser tous les soldes")
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("définir")
        .setDescription("Définir le solde d'un membre")
        .addUserOption((option) =>
          option.setName("utilisateur").setDescription("L'utilisateur").setRequired(true)
        )
        .addIntegerOption((option) =>
          option.setName("montant").setDescription("Montant à définir").setRequired(true).setMinValue(0)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("transférer")
        .setDescription("Transférer de l'argent entre deux utilisateurs")
        .addUserOption((option) =>
          option.setName("de").setDescription("Utilisateur source").setRequired(true)
        )
        .addUserOption((option) =>
          option.setName("vers").setDescription("Utilisateur destination").setRequired(true)
        )
        .addIntegerOption((option) =>
          option.setName("montant").setDescription("Montant").setRequired(true).setMinValue(1)
        )
    ),
];

async function setupCommands(clientId: string, token: string) {
  const rest = new REST({ version: "10" }).setToken(token);
  try {
    console.log("Début du rafraîchissement des commandes (/).");
    await rest.put(Routes.applicationCommands(clientId), { body: commands });
    console.log("Commandes (/) rechargées avec succès.");
  } catch (error) {
    console.error(error);
  }
}

export async function setupBot() {
  const token = process.env.DISCORD_TOKEN!;
  const clientId = process.env.DISCORD_CLIENT_ID!;

  await setupCommands(clientId, token);

  const client = new Client({ intents: [GatewayIntentBits.Guilds] });

  client.on("ready", () => {
    console.log(`Connecté en tant que ${client.user?.tag}!`);
    
    setInterval(async () => {
      try {
        const guilds = client.guilds.cache;
        for (const [, guild] of guilds) {
          const channel = guild.channels.cache.find(c => c.name === "général" && c.isTextBased());
          if (channel && channel.isTextBased()) {
            const amount = Math.floor(Math.random() * (500 - 100 + 1)) + 100;
            const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
              new ButtonBuilder()
                .setCustomId(`drop_${amount}_system`)
                .setLabel(`Récupérer ${amount} Pièces !`)
                .setStyle(ButtonStyle.Success)
            );
            await (channel as any).send({
              content: `🎁 **DROP AUTOMATIQUE !** ${amount} pièces sont à gagner ! Le premier qui clique remporte le lot !`,
              components: [row]
            });
          }
        }
      } catch (err) {
        console.error("Auto drop error:", err);
      }
    }, 4 * 60 * 60 * 1000);
  });

  client.on("interactionCreate", async (interaction) => {
    try {
      if (interaction.isChatInputCommand()) {
        await handleCommand(interaction);
      } else if (interaction.isButton()) {
        await handleButton(interaction);
      }
    } catch (error) {
      console.error("Interaction Error:", error);
      if (interaction.isRepliable()) {
        const payload = { content: "Une erreur est survenue lors de l'exécution de cette commande.", ephemeral: true };
        if (interaction.deferred || interaction.replied) {
          await interaction.followUp(payload);
        } else {
          await interaction.reply(payload);
        }
      }
    }
  });

  await client.login(token);
}

async function getOrCreateUser(discordId: string) {
  let user = await storage.getUser(discordId);
  if (!user) {
    user = await storage.createUser({ discordId, balance: 0 });
  }
  return user;
}

async function handleCommand(interaction: ChatInputCommandInteraction) {
  const { commandName } = interaction;

  if (commandName === "argent") {
    await interaction.deferReply();
    const targetUser = interaction.options.getUser("utilisateur") || interaction.user;
    const userDb = await getOrCreateUser(targetUser.id);
    await interaction.editReply(`${targetUser.username} possède ${userDb.balance} pièces. Ton solde est de ${userDb.balance} pièces.`);
  } 
  else if (commandName === "journalier") {
    await interaction.deferReply();
    const userDb = await getOrCreateUser(interaction.user.id);
    const now = new Date();
    if (userDb.lastDaily) {
      const lastDaily = new Date(userDb.lastDaily);
      const diffMs = now.getTime() - lastDaily.getTime();
      const diffHrs = diffMs / (1000 * 60 * 60);
      if (diffHrs < 24) {
        const remainingHrs = Math.ceil(24 - diffHrs);
        return interaction.editReply(`Tu as déjà récupéré ta récompense quotidienne. Réessaie dans ${remainingHrs} heures.`);
      }
    }

    await storage.updateUser(interaction.user.id, {
      balance: userDb.balance + 100,
      lastDaily: now,
    });
    await interaction.editReply("Tu as récupéré ta récompense quotidienne de 100 pièces !");
  } 
  else if (commandName === "payer") {
    await interaction.deferReply();
    const targetUser = interaction.options.getUser("utilisateur", true);
    const amount = interaction.options.getInteger("montant", true);

    if (targetUser.id === interaction.user.id) {
      return interaction.editReply("Tu ne peux pas te payer toi-même.");
    }

    const senderDb = await getOrCreateUser(interaction.user.id);
    if (senderDb.balance < amount) {
      return interaction.editReply("Tu n'as pas assez de pièces.");
    }

    await storage.updateBalance(interaction.user.id, -amount);
    await storage.updateBalance(targetUser.id, amount);

    await interaction.editReply(`Tu as envoyé avec succès ${amount} pièces à ${targetUser.username}.`);
  } 
  else if (commandName === "dropargent") {
    const amount = interaction.options.getInteger("montant", true);
    const senderDb = await getOrCreateUser(interaction.user.id);

    if (senderDb.balance < amount) {
      return interaction.reply({ content: "Tu n’as pas assez de 🪙 pour créer un drop.", ephemeral: true });
    }

    await storage.updateBalance(interaction.user.id, -amount);

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(`drop_${amount}_${interaction.user.id}`)
        .setLabel(`Récupérer ${amount} Pièces !`)
        .setStyle(ButtonStyle.Success)
    );

    await interaction.reply({
      content: `${interaction.user.username} a lancé un drop de ${amount} pièces ! Le premier qui clique gagne.`,
      components: [row]
    });
  } 
  else if (commandName === "topargent") {
    await interaction.deferReply();
    const topUsers = await storage.getTopUsers(10);
    const embed = new EmbedBuilder()
      .setTitle("Classement Économique")
      .setColor(0xffd700);

    let desc = "";
    for (let i = 0; i < topUsers.length; i++) {
      desc += `${i + 1}. <@${topUsers[i].discordId}> - ${topUsers[i].balance} pièces\n`;
    }
    embed.setDescription(desc || "Aucun utilisateur trouvé.");

    await interaction.editReply({ embeds: [embed] });
  } 
  else if (commandName === "slots") {
    await interaction.deferReply();
    const mise = interaction.options.getInteger("mise", true);
    const userDb = await getOrCreateUser(interaction.user.id);

    if (userDb.balance < mise) {
      return interaction.editReply("Tu n'as pas assez de pièces pour parier ce montant.");
    }

    const emojis = ["🍒", "🍋", "🍊", "🍇", "💎", "7️⃣"];
    const result = [
      emojis[Math.floor(Math.random() * emojis.length)],
      emojis[Math.floor(Math.random() * emojis.length)],
      emojis[Math.floor(Math.random() * emojis.length)],
    ];

    let gain = 0;
    let message = "";

    if (result[0] === result[1] && result[1] === result[2]) {
      gain = mise * 10;
      message = `INCROYABLE ! Tu as aligné 3 symboles identiques ! Tu gagnes **${gain}** pièces (x10) ! 🎰`;
    } else if (result[0] === result[1] || result[1] === result[2] || result[0] === result[2]) {
      gain = mise * 2;
      message = `Bravo ! Tu as aligné 2 symboles identiques ! Tu gagnes **${gain}** pièces (x2) ! ✨`;
    } else {
      gain = -mise;
      message = `Dommage ! Aucun symbole ne correspond. Tu as perdu **${mise}** pièces. 💸`;
    }

    await storage.updateBalance(interaction.user.id, gain === -mise ? -mise : (gain - mise));

    const embed = new EmbedBuilder()
      .setTitle("Machine à Sous 🎰")
      .setDescription(`[ ${result[0]} | ${result[1]} | ${result[2]} ]\n\n${message}`)
      .setColor(gain > 0 ? 0x00ff00 : 0xff0000)
      .setFooter({ text: `Nouveau solde : ${(await storage.getUser(interaction.user.id))?.balance} pièces` });

    await interaction.editReply({ embeds: [embed] });
  }
  else if (commandName === "duel") {
    await interaction.deferReply();
    const opponent = interaction.options.getUser("adversaire", true);
    const mise = interaction.options.getInteger("mise", true);

    if (opponent.id === interaction.user.id) {
      return interaction.editReply("Tu ne peux pas te défier toi-même.");
    }
    if (opponent.bot) {
      return interaction.editReply("Tu ne peux pas défier un bot.");
    }

    const challengerDb = await getOrCreateUser(interaction.user.id);
    const opponentDb = await getOrCreateUser(opponent.id);

    if (challengerDb.balance < mise) {
      return interaction.editReply("Tu n'as pas assez de pièces pour ce pari.");
    }
    if (opponentDb.balance < mise) {
      return interaction.editReply(`${opponent.username} n'a pas assez de pièces pour ce pari.`);
    }

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId(`duel_accept_${interaction.user.id}_${opponent.id}_${mise}`).setLabel("Accepter").setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId(`duel_decline_${interaction.user.id}_${opponent.id}_${mise}`).setLabel("Refuser").setStyle(ButtonStyle.Danger)
    );

    await interaction.editReply({
      content: `${opponent}, ${interaction.user.username} te défie en duel (Pierre-Feuille-Ciseaux) pour **${mise}** pièces !`,
      components: [row]
    });
  }
  else if (commandName === "adminargent") {
    await interaction.deferReply({ ephemeral: true });
    const subcommand = interaction.options.getSubcommand();

    if (subcommand === "ajouter") {
      const targetUser = interaction.options.getUser("utilisateur", true);
      const amount = interaction.options.getInteger("montant", true);
      await storage.updateBalance(targetUser.id, amount);
      await interaction.editReply(`Ajout de ${amount} pièces à ${targetUser.username}.`);
    } 
    else if (subcommand === "retirer") {
      const targetUser = interaction.options.getUser("utilisateur", true);
      const amount = interaction.options.getInteger("montant", true);
      const userDb = await getOrCreateUser(targetUser.id);
      
      const toRemove = Math.min(userDb.balance, amount);
      await storage.updateBalance(targetUser.id, -toRemove);
      await interaction.editReply(`Retrait de ${toRemove} pièces à ${targetUser.username}.`);
    } 
    else if (subcommand === "réinitialiser") {
      await storage.resetAllBalances();
      await interaction.editReply("Tous les soldes ont été réinitialisés à 0.");
    } 
    else if (subcommand === "définir") {
      const targetUser = interaction.options.getUser("utilisateur", true);
      const amount = interaction.options.getInteger("montant", true);
      await getOrCreateUser(targetUser.id);
      await storage.updateUser(targetUser.id, { balance: amount });
      await interaction.editReply(`Solde de ${targetUser.username} défini à ${amount} pièces.`);
    } 
    else if (subcommand === "transférer") {
      const fromUser = interaction.options.getUser("de", true);
      const toUser = interaction.options.getUser("vers", true);
      const amount = interaction.options.getInteger("montant", true);

      const fromDb = await getOrCreateUser(fromUser.id);
      if (fromDb.balance < amount) {
        return interaction.editReply(`${fromUser.username} n'a pas assez de pièces.`);
      }

      await storage.updateBalance(fromUser.id, -amount);
      await storage.updateBalance(toUser.id, amount);
      await interaction.editReply(`Transfert de ${amount} pièces de ${fromUser.username} vers ${toUser.username}.`);
    }
  } else if (commandName === "dropsurprise") {
    const amount = Math.floor(Math.random() * (500 - 100 + 1)) + 100;
    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(`drop_${amount}_admin_surprise`)
        .setLabel(`Récupérer ${amount} Pièces !`)
        .setStyle(ButtonStyle.Success)
    );

    await interaction.reply({
      content: `🎁 **DROP SURPRISE !** Un administrateur a lancé un drop de **${amount}** pièces ! Le premier qui clique remporte le lot !`,
      components: [row]
    });
  }
}

async function handleButton(interaction: any) {
  if (interaction.customId.startsWith("drop_")) {
    const parts = interaction.customId.split("_");
    const amount = parseInt(parts[1]);
    
    await storage.updateBalance(interaction.user.id, amount);

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId("claimed")
        .setLabel(`Récupéré par ${interaction.user.username}`)
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(true)
    );

    await interaction.update({ components: [row] });
    await interaction.followUp({ content: `Tu as récupéré les ${amount} pièces !`, ephemeral: true });
  } else if (interaction.customId.startsWith("duel_accept_")) {
    const parts = interaction.customId.split("_");
    const challengerId = parts[2];
    const opponentId = parts[3];
    const mise = parseInt(parts[4]);

    if (interaction.user.id !== opponentId) {
      return interaction.reply({ content: "Ce défi ne t'est pas destiné.", ephemeral: true });
    }

    const challengerDb = await storage.getUser(challengerId);
    const opponentDb = await storage.getUser(opponentId);

    if (!challengerDb || challengerDb.balance < mise || !opponentDb || opponentDb.balance < mise) {
      return interaction.update({ content: "Duel annulé : l'un des joueurs n'a plus assez de pièces.", components: [] });
    }

    await startDuelRound(interaction, challengerId, opponentId, mise, 1, { challenger: 0, opponent: 0 });
  } else if (interaction.customId.startsWith("duel_decline_")) {
    const parts = interaction.customId.split("_");
    const opponentId = parts[3];
    if (interaction.user.id !== opponentId) return interaction.reply({ content: "Ce défi ne t'est pas destiné.", ephemeral: true });
    await interaction.update({ content: "Le duel a été refusé.", components: [] });
  } else if (interaction.customId.startsWith("duel_move_")) {
    const parts = interaction.customId.split("_");
    const move = parts[2];
    const challengerId = parts[3];
    const opponentId = parts[4];
    const mise = parseInt(parts[5]);
    const round = parseInt(parts[6]);
    const cScore = parseInt(parts[7]);
    const oScore = parseInt(parts[8]);
    const movesEncoded = parts[9];
    
    const scores = { challenger: cScore, opponent: oScore };
    const currentRoundMoves = JSON.parse(decodeURIComponent(movesEncoded));

    if (interaction.user.id !== challengerId && interaction.user.id !== opponentId) {
      return interaction.reply({ content: "Tu ne fais pas partie de ce duel.", ephemeral: true });
    }

    if (currentRoundMoves[interaction.user.id]) {
      return interaction.reply({ content: "Tu as déjà choisi ton coup.", ephemeral: true });
    }

    currentRoundMoves[interaction.user.id] = move;

    if (Object.keys(currentRoundMoves).length === 2) {
      await resolveDuelRound(interaction, challengerId, opponentId, mise, round, scores, currentRoundMoves);
    } else {
      const moves = JSON.stringify(currentRoundMoves);
      const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId(`duel_move_pierre_${challengerId}_${opponentId}_${mise}_${round}_${scores.challenger}_${scores.opponent}_${encodeURIComponent(moves)}`).setLabel("🪨 Pierre").setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId(`duel_move_feuille_${challengerId}_${opponentId}_${mise}_${round}_${scores.challenger}_${scores.opponent}_${encodeURIComponent(moves)}`).setLabel("📄 Feuille").setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId(`duel_move_ciseaux_${challengerId}_${opponentId}_${mise}_${round}_${scores.challenger}_${scores.opponent}_${encodeURIComponent(moves)}`).setLabel("✂️ Ciseaux").setStyle(ButtonStyle.Primary)
      );
      
      const embed = new EmbedBuilder()
        .setTitle(`Duel : Manche ${round}`)
        .setDescription(`<@${challengerId}> vs <@${opponentId}>\nScore: ${scores.challenger} - ${scores.opponent}\n\nUn joueur a déjà choisi ! À ton tour !`)
        .setColor(0x0099ff);

      await interaction.update({ embeds: [embed], components: [row] });
    }
  } else if (interaction.customId.startsWith("duel_next_")) {
    const parts = interaction.customId.split("_");
    const challengerId = parts[2];
    const opponentId = parts[3];
    const mise = parseInt(parts[4]);
    const round = parseInt(parts[5]);
    const cScore = parseInt(parts[6]);
    const oScore = parseInt(parts[7]);

    if (interaction.user.id !== challengerId && interaction.user.id !== opponentId) {
      return interaction.reply({ content: "Tu ne fais pas partie de ce duel.", ephemeral: true });
    }

    await startDuelRound(interaction, challengerId, opponentId, mise, round, { challenger: cScore, opponent: oScore });
  }
}

async function startDuelRound(interaction: any, challengerId: string, opponentId: string, mise: number, round: number, scores: any) {
  const moves = JSON.stringify({});
  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId(`duel_move_pierre_${challengerId}_${opponentId}_${mise}_${round}_${scores.challenger}_${scores.opponent}_${encodeURIComponent(moves)}`).setLabel("🪨 Pierre").setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId(`duel_move_feuille_${challengerId}_${opponentId}_${mise}_${round}_${scores.challenger}_${scores.opponent}_${encodeURIComponent(moves)}`).setLabel("📄 Feuille").setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId(`duel_move_ciseaux_${challengerId}_${opponentId}_${mise}_${round}_${scores.challenger}_${scores.opponent}_${encodeURIComponent(moves)}`).setLabel("✂️ Ciseaux").setStyle(ButtonStyle.Primary)
  );

  const embed = new EmbedBuilder()
    .setTitle(`Duel : Manche ${round}`)
    .setDescription(`<@${challengerId}> vs <@${opponentId}>\nScore: ${scores.challenger} - ${scores.opponent}\n\nChoisissez votre coup !`)
    .setColor(0x0099ff);

  await interaction.update({ embeds: [embed], components: [row] });
}

async function resolveDuelRound(interaction: any, challengerId: string, opponentId: string, mise: number, round: number, scores: any, moves: any) {
  const cMove = moves[challengerId];
  const oMove = moves[opponentId];

  let resultMessage = "";
  if (cMove === oMove) {
    resultMessage = `Égalité ! Les deux ont choisi ${getEmoji(cMove)}.`;
  } else if (
    (cMove === "pierre" && oMove === "ciseaux") ||
    (cMove === "feuille" && oMove === "pierre") ||
    (cMove === "ciseaux" && oMove === "feuille")
  ) {
    scores.challenger++;
    resultMessage = `<@${challengerId}> gagne la manche ! ${getEmoji(cMove)} bat ${getEmoji(oMove)}.`;
  } else {
    scores.opponent++;
    resultMessage = `<@${opponentId}> gagne la manche ! ${getEmoji(oMove)} bat ${getEmoji(cMove)}.`;
  }

  const embed = new EmbedBuilder()
    .setTitle(`Résultat Manche ${round}`)
    .setDescription(`${resultMessage}\n\n**Score actuel :**\n<@${challengerId}>: ${scores.challenger}\n<@${opponentId}>: ${scores.opponent}`)
    .setColor(0x00ff00);

  if (scores.challenger >= 2 || scores.opponent >= 2 || round >= 3) {
    let winnerId = null;
    if (scores.challenger > scores.opponent) winnerId = challengerId;
    else if (scores.opponent > scores.challenger) winnerId = opponentId;
    
    if (winnerId) {
      const bonus = Math.floor(mise * 0.1);
      const totalWin = mise + bonus;
      const loserId = winnerId === challengerId ? opponentId : challengerId;

      await storage.updateBalance(loserId, -mise);
      await storage.updateBalance(winnerId, totalWin);

      embed.setTitle("Duel Terminé !")
        .setDescription(`${resultMessage}\n\n🏆 **<@${winnerId}> remporte le duel !**\nGain: **${totalWin}** pièces (Mise + 10% bonus)`)
        .setColor(0xffd700);
    } else {
      embed.setTitle("Duel Terminé !")
        .setDescription(`${resultMessage}\n\n🤝 **Égalité parfaite !** Personne ne perd d'argent.`)
        .setColor(0x808080);
    }
    await interaction.update({ embeds: [embed], components: [] });
  } else {
    const nextRound = round + 1;
    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(`duel_next_${challengerId}_${opponentId}_${mise}_${nextRound}_${scores.challenger}_${scores.opponent}`)
        .setLabel(`Commencer la Manche ${nextRound}`)
        .setStyle(ButtonStyle.Primary)
    );
    await interaction.update({ embeds: [embed], components: [row] });
  }
}

function getEmoji(move: string) {
  if (move === "pierre") return "🪨";
  if (move === "feuille") return "📄";
  return "✂️";
}
