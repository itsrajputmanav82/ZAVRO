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

/* =========================
   INTERNAL CACHE LAYER
========================= */
const jtcCache = new Map();

/* =========================
   LOCK SYSTEM (ANTI RACE)
========================= */
const locks = new Set();
const lock = (id) => locks.add(id);
const unlock = (id) => locks.delete(id);
const isLocked = (id) => locks.has(id);

/* =========================
   MAIN COMMAND
========================= */
export default {
    data: new SlashCommandBuilder()
        .setName("jointocreate")
        .setDescription("Enterprise Join To Create System")
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
        .setDMPermission(false)
        .addSubcommand(sub =>
            sub.setName("setup")
                .setDescription("Setup system")
                .addChannelOption(opt =>
                    opt.setName("category")
                        .setDescription("Category")
                        .addChannelTypes(ChannelType.GuildCategory)
                )
                .addStringOption(opt =>
                    opt.setName("channel_name")
                        .setDescription("Template")
                )
                .addIntegerOption(opt =>
                    opt.setName("user_limit")
                        .setDescription("0 = unlimited")
                )
                .addIntegerOption(opt =>
                    opt.setName("bitrate")
                        .setDescription("8-96")
                )
        )
        .addSubcommand(sub =>
            sub.setName("dashboard")
                .setDescription("Control panel")
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
                    "NO_PERMISSION",
                    ErrorTypes.PERMISSION,
                    "Manage Server required"
                );
            }

            const sub = interaction.options.getSubcommand();
            await InteractionHelper.safeDefer(interaction, { flags: MessageFlags.Ephemeral });

            if (sub === "setup") return setup(interaction, client);
            if (sub === "dashboard") return dashboard(interaction, client);

        } catch (e) {
            logger.error("[JTC ERROR]", e);

            return InteractionHelper.safeEditReply(interaction, {
                embeds: [errorEmbed("Error", e.userMessage || "System failure")]
            });
        }
    }
};
async function setup(interaction, client) {
    const guildId = interaction.guild.id;

    if (isLocked(guildId)) {
        throw new TitanBotError(
            "LOCKED",
            ErrorTypes.VALIDATION,
            "System busy, try again"
        );
    }

    lock(guildId);

    try {
        const category = interaction.options.getChannel("category");
        const nameTemplate = interaction.options.getString("channel_name") || "{username}'s Room";
        const userLimit = interaction.options.getInteger("user_limit") ?? 0;
        const bitrate = interaction.options.getInteger("bitrate") ?? 64;

        const existing = await getConfiguration(client, guildId);

        if (existing?.triggerChannels?.length > 0) {
            throw new TitanBotError(
                "EXISTS",
                ErrorTypes.VALIDATION,
                "Already setup. Use dashboard."
            );
        }

        const trigger = await interaction.guild.channels.create({
            name: "Join To Create",
            type: ChannelType.GuildVoice,
            parent: category?.id,
            bitrate: 64000,
            userLimit: 0,
            permissionOverwrites: [
                {
                    id: guildId,
                    allow: [
                        PermissionFlagsBits.ViewChannel,
                        PermissionFlagsBits.Connect
                    ]
                }
            ]
        });

        await initializeJoinToCreate(client, guildId, trigger.id, {
            nameTemplate,
            userLimit,
            bitrate: bitrate * 1000,
            categoryId: category?.id
        });

        jtcCache.set(guildId, {
            triggerId: trigger.id,
            updatedAt: Date.now()
        });

        await logConfigurationChange(client, guildId, interaction.user.id,
            "ENTERPRISE_SETUP",
            { trigger: trigger.id }
        );

        return InteractionHelper.safeEditReply(interaction, {
            embeds: [
                successEmbed(
                    "SYSTEM ONLINE",
                    `Trigger created: ${trigger}`
                )
            ]
        });

    } finally {
        unlock(guildId);
    }
}
async function dashboard(interaction, client) {
    const trigger = interaction.options.getChannel("trigger_channel");
    const guildId = interaction.guild.id;

    const cache = jtcCache.get(guildId);
    let config;

    if (cache?.triggerId === trigger.id) {
        config = cache;
    } else {
        config = await getChannelConfiguration(client, guildId, trigger.id);
    }

    const embed = new EmbedBuilder()
        .setTitle("ENTERPRISE JTC PANEL")
        .setColor(getColor("info"))
        .addFields(
            {
                name: "Template",
                value: config.channelConfig?.nameTemplate || "{username}"
            },
            {
                name: "Limit",
                value: String(config.channelConfig?.userLimit ?? 0)
            },
            {
                name: "Bitrate",
                value: String((config.channelConfig?.bitrate ?? 64000) / 1000)
            }
        );

    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`jtc_name_${trigger.id}`).setLabel("NAME").setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId(`jtc_limit_${trigger.id}`).setLabel("LIMIT").setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId(`jtc_bitrate_${trigger.id}`).setLabel("BITRATE").setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId(`jtc_delete_${trigger.id}`).setLabel("DELETE").setStyle(ButtonStyle.Danger)
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
        if (!hasManageGuildPermission(i.member)) return;

        const id = i.customId;

        if (id.includes("jtc_name_")) return nameModal(i, trigger, client);
        if (id.includes("jtc_limit_")) return limitModal(i, trigger, client);
        if (id.includes("jtc_bitrate_")) return bitrateModal(i, trigger, client);
        if (id.includes("jtc_delete_")) return deleteSystem(i, trigger, client);
    });

    collector.on("end", () => {
        msg.edit({ components: [] }).catch(() => {});
    });
}
async function nameModal(i, trigger, client) {
    const modal = new ModalBuilder()
        .setCustomId(`name_${trigger.id}`)
        .setTitle("Template");

    const input = new TextInputBuilder()
        .setCustomId("v")
        .setLabel("Name Template")
        .setStyle(TextInputStyle.Short)
        .setValue("{username}'s Room");

    modal.addComponents(new ActionRowBuilder().addComponents(input));

    await i.showModal(modal);

    const res = await i.awaitModalSubmit({
        filter: x => x.user.id === i.user.id,
        time: 60000
    });

    await updateChannelConfig(client, i.guild.id, trigger.id, {
        nameTemplate: res.fields.getTextInputValue("v")
    });

    return res.reply({
        embeds: [successEmbed("UPDATED", "Template changed")],
        flags: MessageFlags.Ephemeral
    });
}
async function limitModal(i, trigger, client) {
    const modal = new ModalBuilder()
        .setCustomId(`limit_${trigger.id}`)
        .setTitle("User Limit");

    const input = new TextInputBuilder()
        .setCustomId("v")
        .setLabel("0-99")
        .setStyle(TextInputStyle.Short);

    modal.addComponents(new ActionRowBuilder().addComponents(input));

    await i.showModal(modal);

    const res = await i.awaitModalSubmit({ filter: x => x.user.id === i.user.id, time: 60000 });

    let val = parseInt(res.fields.getTextInputValue("v"));
    val = Math.max(0, Math.min(val || 0, 99));

    await updateChannelConfig(client, i.guild.id, trigger.id, { userLimit: val });

    return res.reply({
        embeds: [successEmbed("UPDATED", `Limit ${val}`)],
        flags: MessageFlags.Ephemeral
    });
}

async function bitrateModal(i, trigger, client) {
    const modal = new ModalBuilder()
        .setCustomId(`bitrate_${trigger.id}`)
        .setTitle("Bitrate");

    const input = new TextInputBuilder()
        .setCustomId("v")
        .setLabel("8-96 kbps")
        .setStyle(TextInputStyle.Short);

    modal.addComponents(new ActionRowBuilder().addComponents(input));

    await i.showModal(modal);

    const res = await i.awaitModalSubmit({ filter: x => x.user.id === i.user.id, time: 60000 });

    let val = parseInt(res.fields.getTextInputValue("v"));
    val = Math.max(8, Math.min(val || 64, 96));

    await updateChannelConfig(client, i.guild.id, trigger.id, {
        bitrate: val * 1000
    });

    return res.reply({
        embeds: [successEmbed("UPDATED", `${val} kbps`)],
        flags: MessageFlags.Ephemeral
    });
}
async function deleteSystem(i, trigger, client) {
    await removeTriggerChannel(client, i.guild.id, trigger.id);

    jtcCache.delete(i.guild.id);

    if (trigger.members.size === 0) {
        trigger.delete().catch(() => {});
    }

    return i.reply({
        embeds: [successEmbed("REMOVED", "System deleted")],
        flags: MessageFlags.Ephemeral
    });
}
