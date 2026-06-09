import { SlashCommandBuilder, PermissionsBitField } from 'discord.js';

export const data = new SlashCommandBuilder()
    .setName('say')
    .setDescription('Make the bot repeat your message')
    .addStringOption(option =>
        option.setName('text')
            .setDescription('Message to send')
            .setRequired(true)
    )
    .addBooleanOption(option =>
        option.setName('ephemeral')
            .setDescription('Send confirmation only visible to you')
            .setRequired(false)
    );

export async function execute(interaction) {
    const text = interaction.options.getString('text');
    const ephemeral = interaction.options.getBoolean('ephemeral') ?? true;

    // Permission check (safe for servers)
    if (!interaction.member.permissions.has(PermissionsBitField.Flags.ManageMessages)) {
        return interaction.reply({
            content: '❌ You need **Manage Messages** permission to use this command.',
            ephemeral: true
        });
    }

    // Block dangerous mentions (anti ping spam)
    const safeText = text
        .replace(/@everyone/g, '@\u200beveryone')
        .replace(/@here/g, '@\u200bhere');

    await interaction.reply({
        content: '✅ Message sent!',
        ephemeral
    });

    await interaction.channel.send({ content: safeText });
}
