import { ChannelType, MessageFlags, PermissionFlagsBits } from 'discord.js';
import { successEmbed } from '../../../utils/embeds.js';
import { logger } from '../../../utils/logger.js';
import { TitanBotError, ErrorTypes } from '../../../utils/errorHandler.js';
import { addJoinToCreateTrigger } from '../../../utils/database.js';
import { InteractionHelper } from '../../../utils/interactionHelper.js';

export default {
    async execute(interaction, config, client) {
        const category = interaction.options.getChannel('category');
        const nameTemplate = interaction.options.getString('channel_name') || "{username}'s Room";
        const userLimit = interaction.options.getInteger('user_limit') ?? 0;
        const bitrate = interaction.options.getInteger('bitrate') ?? 64;
        const guildId = interaction.guild.id;

        try {

            // ✅ Permission check
            if (!interaction.member.permissions.has(PermissionFlagsBits.ManageGuild)) {
                throw new TitanBotError(
                    "NO_PERMISSION",
                    ErrorTypes.PERMISSION,
                    "Manage Server permission required"
                );
            }

            // ✅ Safe bitrate (Discord limit protection)
            const safeBitrate = Math.min(Math.max(bitrate * 1000, 8000), 96000);

            // ❌ Trigger channel should NOT use userLimit
            const triggerChannel = await interaction.guild.channels.create({
                name: 'Join to Create',
                type: ChannelType.GuildVoice,
                parent: category?.id ?? null,
                userLimit: 0,
                bitrate: safeBitrate,
                permissionOverwrites: [
                    {
                        id: interaction.guild.id,
                        allow: [
                            PermissionFlagsBits.ViewChannel,
                            PermissionFlagsBits.Connect
                        ],
                    },
                ],
            });

            // ✅ Save config
            await addJoinToCreateTrigger(client, guildId, triggerChannel.id, {
                nameTemplate,
                userLimit,
                bitrate: safeBitrate,
                categoryId: category?.id ?? null
            });

            logger.info(`[JTC] Created trigger ${triggerChannel.id} in ${guildId}`);

            // ✅ Response embed
            const embed = successEmbed(
                `Created trigger channel: ${triggerChannel}\n\n` +
                `• Template: \`${nameTemplate}\`\n` +
                `• User Limit: ${userLimit === 0 ? 'Unlimited' : userLimit}\n` +
                `• Bitrate: ${bitrate} kbps\n` +
                `• Category: ${category ? category.name : 'Root'}\n\n` +
                `Now users will get temporary voice channels automatically.`,
                '✅ Join To Create Setup Complete'
            );

            // ✅ Safe reply handling
            if (interaction.deferred || interaction.replied) {
                await InteractionHelper.safeEditReply(interaction, { embeds: [embed] });
            } else {
                await InteractionHelper.safeReply(interaction, {
                    embeds: [embed],
                    flags: MessageFlags.Ephemeral
                });
            }

        } catch (error) {
            logger.error('[JTC SETUP ERROR]', error);

            if (error instanceof TitanBotError) throw error;

            throw new TitanBotError(
                `Setup failed: ${error.message}`,
                ErrorTypes.DISCORD_API,
                'Failed to create Join to Create system'
            );
        }
    }
};
