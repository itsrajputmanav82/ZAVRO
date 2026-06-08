import 'dotenv/config';
import { Client, Collection, GatewayIntentBits } from 'discord.js';
import { REST } from '@discordjs/rest';
import express from 'express';
import cron from 'node-cron';

import config from './config/application.js';
import { initializeDatabase } from './utils/database.js';
import { getServerCounters, saveServerCounters, updateCounter } from './services/serverstatsService.js';
import { logger, startupLog, shutdownLog } from './utils/logger.js';
import { checkBirthdays } from './services/birthdayService.js';
import { checkGiveaways } from './services/giveawayService.js';
import { loadCommands, registerCommands as registerSlashCommands } from './handlers/commandLoader.js';

class ZAVROBot extends Client {
  constructor() {
    super({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildMessageReactions,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildBans,
      ],
    });

    this.config = config;
    this.commands = new Collection();
    this.events = new Collection();
    this.buttons = new Collection();
    this.selectMenus = new Collection();
    this.modals = new Collection();
    this.cooldowns = new Collection();
    this.db = null;

    const token = config.bot?.token || process.env.DISCORD_TOKEN || process.env.TOKEN;
    this.rest = new REST({ version: '10' }).setToken(token);
  }

  async start() {
    try {
      startupLog('Starting ZAVRO Bot...');

      await new Promise(r => setTimeout(r, 1000));

      startupLog('Initializing database...');
      const dbInstance = await initializeDatabase();
      this.db = dbInstance.db;

      const dbStatus = this.db.getStatus?.() || { isDegraded: true };

      if (dbStatus.isDegraded) {
        logger.warn('⚠️ Database running in fallback mode (no persistence)');
      } else {
        startupLog('Database connected successfully');
      }

      startupLog('Starting web server...');
      this.startWebServer();

      startupLog('Loading commands...');
      await loadCommands(this);

      startupLog(`Commands loaded: ${this.commands.size}`);

      startupLog('Loading handlers...');
      await this.loadHandlers();

      startupLog('Logging into Discord...');
      await this.login(config.bot?.token || process.env.DISCORD_TOKEN || process.env.TOKEN);

      startupLog('Registering slash commands...');
      await this.registerCommands();

      startupLog('ZAVRO Bot is now ONLINE ✅');

      this.setupCronJobs();

    } catch (err) {
      logger.error('Failed to start ZAVRO Bot:', err);
      process.exit(1);
    }
  }

  startWebServer() {
    const app = express();
    const port = Number(process.env.PORT || 3000);

    app.get('/health', (req, res) => {
      res.json({
        status: 'ok',
        bot: 'ZAVRO',
        uptime: process.uptime(),
      });
    });

    app.get('/', (req, res) => {
      res.json({ message: 'ZAVRO Bot Online' });
    });

    app.listen(port, () => {
      startupLog(`Web server running on port ${port}`);
    });
  }

  setupCronJobs() {
    cron.schedule('0 6 * * *', () => checkBirthdays(this));
    cron.schedule('* * * * *', () => checkGiveaways(this));
    cron.schedule('*/15 * * * *', () => this.updateAllCounters());
  }

  async updateAllCounters() {
    if (!this.db) return;

    for (const [guildId, guild] of this.guilds.cache) {
      try {
        const counters = await getServerCounters(this, guildId);
        const valid = [];

        for (const counter of counters) {
          const channel = guild.channels.cache.get(counter.channelId);
          if (channel) {
            valid.push(counter);
            await updateCounter(this, guild, counter);
          }
        }

        await saveServerCounters(this, guildId, valid);

      } catch (err) {
        logger.error(`Counter update error (${guildId}):`, err);
      }
    }
  }

  async loadHandlers() {
    const handlers = [
      { path: 'events', required: true },
      { path: 'interactions', required: true },
    ];

    for (const h of handlers) {
      try {
        const module = await import(`./handlers/${h.path}.js`);
        const fn = module.default;

        if (typeof fn === 'function') {
          await fn(this);
        }
      } catch (err) {
        logger.error(`Handler load failed: ${h.path}`, err);
        if (h.required) throw err;
      }
    }
  }

  async registerCommands() {
    try {
      await registerSlashCommands(this, this.config.bot?.guildId);
    } catch (err) {
      logger.error('Slash command registration failed:', err);
    }
  }

  async shutdown(reason = 'UNKNOWN') {
    shutdownLog(`Shutting down ZAVRO Bot (${reason})`);

    try {
      cron.getTasks().forEach(t => t.stop());

      if (this.db?.db?.pool) {
        await this.db.db.pool.end();
      }

      this.destroy();

      shutdownLog('ZAVRO Bot stopped safely');
      process.exit(0);

    } catch (err) {
      logger.error('Shutdown error:', err);
      process.exit(1);
    }
  }
}

const bot = new ZAVROBot();

process.on('SIGINT', () => bot.shutdown('SIGINT'));
process.on('SIGTERM', () => bot.shutdown('SIGTERM'));

process.on('uncaughtException', (err) => {
  logger.error(err);
  bot.shutdown('UNCAUGHT_EXCEPTION');
});

process.on('unhandledRejection', (err) => {
  logger.error(err);
  bot.shutdown('UNHANDLED_REJECTION');
});

bot.start();

export default ZAVROBot;
