import { SlashCommandSubcommandBuilder, EmbedBuilder, type ChatInputCommandInteraction } from "discord.js";
import { genColor } from "../../utils/colorGen.js";
import { getLevelingTable, getSettingsTable } from "../../utils/database.js";
import { errorEmbed } from "../../utils/embeds/errorEmbed.js";
import { QuickDB } from "quick.db";
import { Reward } from "../settings/leveling/rewards.js";

export default class Level {
  data: SlashCommandSubcommandBuilder;
  db: QuickDB<any>;

  constructor(db?: QuickDB<any>) {
    this.db = db;
    this.data = new SlashCommandSubcommandBuilder()
      .setName("level")
      .setDescription("Shows your (or another user's) level.")
      .addUserOption(option => option
        .setName("user")
        .setDescription("Select the user.")
      );
  }

  async run(interaction: ChatInputCommandInteraction) {
    const db = this.db;
    const settingsTable = await getSettingsTable(db);
    const levelingTable = await getLevelingTable(db);

    const user = interaction.options.getUser("user");
    const member = interaction.member;
    const guild = interaction.guild;

    const id = user ? user.id : member.user.id;
    const selectedMember = guild.members.cache.filter(member => member.user.id === id).map(user => user)[0];
    const avatarURL = selectedMember.displayAvatarURL();

    const levelEnabled = await settingsTable
      ?.get(`${guild.id}.leveling.enabled`)
      .then(data => {
        if (!data) return false;
        return data;
      })
      .catch(() => false);

    if (!levelEnabled) return await interaction.followUp({
      embeds: [errorEmbed("Leveling is disabled for this server.")]
    });

    const { exp, levels } = await levelingTable
      ?.get(`${guild.id}.${selectedMember.id}`)
      .then(data => {
        if (!data) return { exp: 0, level: 0 };
        return { exp: parseInt(data.exp), levels: parseInt(data.levels) };
      })
      .catch(() => { return { exp: 0, levels: 0 } });

    const formattedExp = exp?.toLocaleString("en-US");

    if (!exp && !levels) await levelingTable.set(`${guild.id}.${selectedMember.id}`, { levels: 0, exp: 0 });

    let rewards = [];
    let nextReward = null;
    const levelRewards = await settingsTable
      ?.get(`${interaction.guild.id}.leveling.rewards`)
      .then(data => {
        if (!data) return [] as Reward[] ?? [] as Reward[];
        return data as Reward[] ?? [] as Reward[];
      })
      .catch(() => [] as Reward[]);

    for (const { roleId, level } of levelRewards) {
      const role = await interaction.guild.roles.fetch(roleId).catch(() => {});
      const reward = { roleId, level };

      if (levels < level) {
        if (nextReward) break;
        nextReward = reward;
        break;
      }

      rewards.push(role);
    }

    const expUntilLevelup = Math.floor((2 * 50) * 1.25 * ((levels ?? 0) + 1));
    const formattedExpUntilLevelup = expUntilLevelup?.toLocaleString("en-US");
    const levelUpEmbed = new EmbedBuilder()
      .setAuthor({ name: `•  ${selectedMember.user.username}`, iconURL: avatarURL })
      .setFields(
        {
          name: `⚡ • Level ${levels ?? 0}`,
          value: [
            `**Exp**: ${formattedExp ?? 0}/${formattedExpUntilLevelup} until level up`,
            `**Next Level**: ${(levels ?? 0) + 1}`
          ].join("\n")
        },
        {
          name: `🎁 • ${rewards.length} Rewards`,
          value: [
            `${rewards.length > 0 ? rewards.map(reward => `<@&${reward.id}>`).join(" ") : "No rewards unlocked"}`,
            nextReward ? `**Upcoming reward**: <@&${nextReward.roleId}>` : "**Upcoming reward**: *Cricket, cricket, cricket* - Looks like you claimed everything!"
          ].join("\n")
        }
      )
      .setThumbnail(avatarURL)
      .setTimestamp()
      .setColor(genColor(200));

    await interaction.followUp({ embeds: [levelUpEmbed] });
  }
}
