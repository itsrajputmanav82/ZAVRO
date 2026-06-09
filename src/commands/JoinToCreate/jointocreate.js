import { getColor } from '../../config/bot.js';
import {
    SlashCommandBuilder,
    PermissionFlagsBits,
    MessageFlags,
    ChannelType,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ComponentType,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    EmbedBuilder
} from 'discord.js';

import { errorEmbed, successEmbed } from '../../utils/embeds.js';
import { logger } from '../../utils/logger.js';
import { TitanBotError, ErrorTypes } from '../../utils/errorHandler.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';

import {
    initializeJoinToCreate,
    getChannelConfiguration,
    updateChannelConfig,
    removeTriggerChannel,
    hasManageGuildPermission,
    logConfigurationChange,
    getConfiguration
} from '../../services/joinToCreateService.js';

export default {
    data: new SlashCommandBuilder()
        .setName("jointocreate")
        .setDescription("Manage Join to Create system")
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
        .setDMPermission(false)
        .addSubcommand(sub =>
            sub.setName("setup")
                .setDescription("Create Join to Create system")
                .addChannelOption(opt =>
                    opt.setName("category")
                        .setDescription("Category")
                        .addChannelTypes(ChannelType.GuildCategory)
                )
                .addStringOption(opt =>
                    opt.setName("channel_name")
                        .setDescription("Template")
                        .addChoices(
                            { name: "{username}'s Room", value: "{username}'s Room" },
                            { name: "🎮 Gaming Room", value: "🎮 {username}'s Gaming Room" },
                            { name: "💬 Chat Room", value: "💬 {username}'s Chat Room" }
                        )
                )
                .addIntegerOption(opt =>
                    opt.setName("user_limit")
                        .setDescription("0 = unlimited")
                )
                .addIntegerOption(opt =>
                    opt.setName("bitrate")
                        .setDescription("8-96 kbps")
                )
        )
        .addSubcommand(sub =>
            sub.setName("dashboard")
                .setDescription("Configure system")
                .addChannelOption(opt =>
                    opt.setName("trigger_channel")
                        .setDescription("Voice channel")
                        .setRequired(true)
                        .addChannelTypes(ChannelType.GuildVoice)
                )
        ),

    async execute(interaction, client) {
        try {

            if (!hasManageGuildPermission(interaction.member)) {
                throw new TitanBotError(
                    "No permission",
                    ErrorTypes.PERMISSION,
                    "Manage Server required"
                );
            }

            const sub = interaction.options.getSubcommand();
            await InteractionHelper.safeDefer(interaction, { flags: MessageFlags.Ephemeral });

            if (sub === "setup") return setup(interaction, client);
            if (sub === "dashboard") return dashboard(interaction, client);

        } catch (err) {
            logger.error(err);

            return InteractionHelper.safeEditReply(interaction, {
                embeds: [errorEmbed("Error", err.userMessage || "Something went wrong")]
            });
        }
    }
};
async function setup(interaction, client) {
    const category = interaction.options.getChannel("category");
    const nameTemplate = interaction.options.getString("channel_name") || "{username}'s Room";
    const userLimit = interaction.options.getInteger("user_limit") ?? 0;
    const bitrate = interaction.options.getInteger("bitrate") ?? 64;

    const existing = await getConfiguration(client, interaction.guild.id);

    if (existing?.triggerChannels?.length) {
        throw new TitanBotError(
            "Already exists",
            ErrorTypes.VALIDATION,
            "Use dashboard instead"
        );
    }

    const trigger = await interaction.guild.channels.create({
        name: "Join to Create",
        type: ChannelType.GuildVoice,
        parent: category?.id,
        bitrate: 64000,
        userLimit: 0,
        permissionOverwrites: [
            {
                id: interaction.guild.id,
                allow: [
                    PermissionFlagsBits.ViewChannel,
                    PermissionFlagsBits.Connect
                ]
            }
        ]
    });

    await initializeJoinToCreate(client, interaction.guild.id, trigger.id, {
        nameTemplate,
        userLimit,
        bitrate: bitrate * 1000,
        categoryId: category?.id
    });

    await logConfigurationChange(client, interaction.guild.id, interaction.user.id,
        "Setup JTC",
        { trigger: trigger.id }
    );

    return InteractionHelper.safeEditReply(interaction, {
        embeds: [
            successEmbed("Setup Done", `Created: ${trigger}\nTemplate: ${nameTemplate}`)
        ]
    });
}
async function dashboard(interaction, client) {
    const trigger = interaction.options.getChannel("trigger_channel");
    const config = await getChannelConfiguration(client, interaction.guild.id, trigger.id);

    const embed = new EmbedBuilder()
        .setTitle("JTC Dashboard")
        .setColor(getColor("info"))
        .addFields(
            { name: "Template", value: config.channelConfig?.nameTemplate || "{username}'s Room" },
            { name: "Limit", value: String(config.channelConfig?.userLimit ?? 0) },
            { name: "Bitrate", value: String((config.channelConfig?.bitrate ?? 64000) / 1000) + " kbps" }
        );

    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`jtc_name_${trigger.id}`).setLabel("Name").setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId(`jtc_limit_${trigger.id}`).setLabel("Limit").setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId(`jtc_bitrate_${trigger.id}`).setLabel("Bitrate").setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId(`jtc_delete_${trigger.id}`).setLabel("Delete").setStyle(ButtonStyle.Danger)
    );

    await InteractionHelper.safeEditReply(interaction, {
        embeds: [embed],
        components: [row]
    });

    const msg = await interaction.fetchReply();

    const collector = msg.createMessageComponentCollector({
        componentType: ComponentType.Button,
        time: 300000
    });

    collector.on("collect", async (i) => {
        if (!hasManageGuildPermission(i.member)) {
            return i.reply({ content: "No permission", flags: MessageFlags.Ephemeral });
        }

        if (i.customId.includes("jtc_name_")) return nameModal(i, trigger, config, client);
        if (i.customId.includes("jtc_limit_")) return limitModal(i, trigger, config, client);
        if (i.customId.includes("jtc_bitrate_")) return bitrateModal(i, trigger, config, client);
        if (i.customId.includes("jtc_delete_")) return deleteSystem(i, trigger, client);
    });

    collector.on("end", () => {
        msg.edit({ components: [] }).catch(() => {});
    });
}
async function nameModal(i, trigger, config, client) {
    const modal = new ModalBuilder()
        .setCustomId(`name_${trigger.id}`)
        .setTitle("Name Template");

    const input = new TextInputBuilder()
        .setCustomId("value")
        .setLabel("Template")
        .setStyle(TextInputStyle.Short)
        .setValue(config.channelConfig?.nameTemplate || "{username}'s Room");

    modal.addComponents(new ActionRowBuilder().addComponents(input));

    await i.showModal(modal);

    const res = await i.awaitModalSubmit({
        filter: x => x.user.id === i.user.id,
        time: 60000
    });

    await updateChannelConfig(client, i.guild.id, trigger.id, {
        nameTemplate: res.fields.getTextInputValue("value")
    });

    return res.reply({
        embeds: [successEmbed("Updated", "Template updated")],
        flags: MessageFlags.Ephemeral
    });
}
async function limitModal(i, trigger, config, client) {
    const modal = new ModalBuilder()
        .setCustomId(`limit_${trigger.id}`)
        .setTitle("User Limit");

    const input = new TextInputBuilder()
        .setCustomId("value")
        .setLabel("0 - 99")
        .setStyle(TextInputStyle.Short);

    modal.addComponents(new ActionRowBuilder().addComponents(input));

    await i.showModal(modal);

    const res = await i.awaitModalSubmit({
        filter: x => x.user.id === i.user.id,
        time: 60000
    });

    let val = parseInt(res.fields.getTextInputValue("value"));
    if (isNaN(val)) val = 0;
    val = Math.min(Math.max(val, 0), 99);

    await updateChannelConfig(client, i.guild.id, trigger.id, {
        userLimit: val
    });

    return res.reply({
        embeds: [successEmbed("Updated", `Limit: ${val}`)],
        flags: MessageFlags.Ephemeral
    });
}
async function bitrateModal(i, trigger, config, client) {
    const modal = new ModalBuilder()
        .setCustomId(`bitrate_${trigger.id}`)
        .setTitle("Bitrate");

    const input = new TextInputBuilder()
        .setCustomId("value")
        .setLabel("8 - 96 kbps")
        .setStyle(TextInputStyle.Short);

    modal.addComponents(new ActionRowBuilder().addComponents(input));

    await i.showModal(modal);

    const res = await i.awaitModalSubmit({
        filter: x => x.user.id === i.user.id,
        time: 60000
    });

    let val = parseInt(res.fields.getTextInputValue("value"));
    if (isNaN(val)) val = 64;
    val = Math.min(Math.max(val, 8), 96);

    await updateChannelConfig(client, i.guild.id, trigger.id, {
        bitrate: val * 1000
    });

    return res.reply({
        embeds: [successEmbed("Updated", `${val} kbps`)],
        flags: MessageFlags.Ephemeral
    });
}
async function deleteSystem(i, trigger, client) {
    await removeTriggerChannel(client, i.guild.id, trigger.id);

    if (trigger.members.size === 0) {
        trigger.delete().catch(() => {});
    }

    return i.reply({
        embeds: [successEmbed("Deleted", "System removed")],
        flags: MessageFlags.Ephemeral
    });
}
