import { logger } from '../utils/logger.js';

export const botConfig = {

  // =========================
  // BOT PRESENCE
  // =========================
  presence: {
    status: "online",
    activities: [
      {
        name: "ZAVRO Bot | Made by ZAVRO",
        type: 4,
      },
    ],
  },

  // =========================
  // COMMAND BEHAVIOR
  // =========================
  commands: {
    owners: process.env.OWNER_IDS?.split(",") || [],
    defaultCooldown: 3,
    deleteCommands: false,
    testGuildId: process.env.TEST_GUILD_ID,
  },

  // =========================
  // APPLICATIONS SYSTEM
  // =========================
  applications: {
    defaultQuestions: [
      { question: "What is your name?", required: true },
      { question: "How old are you?", required: true },
      { question: "Why do you want to join?", required: true },
    ],
    statusColors: {
      pending: "#FFA500",
      approved: "#00FF00",
      denied: "#FF0000",
    },
    applicationCooldown: 24,
    deleteDeniedAfter: 7,
    deleteApprovedAfter: 30,
    managerRoles: [],
  },

  // =========================
  // EMBEDS
  // =========================
  embeds: {
    colors: {
      primary: "#336699",
      secondary: "#2F3136",

      success: "#57F287",
      error: "#ED4245",
      warning: "#FEE75C",
      info: "#3498DB",

      light: "#FFFFFF",
      dark: "#202225",
      gray: "#99AAB5",

      blurple: "#5865F2",
      green: "#57F287",
      yellow: "#FEE75C",
      fuchsia: "#EB459E",
      red: "#ED4245",
      black: "#000000",

      giveaway: {
        active: "#57F287",
        ended: "#ED4245",
      },
      ticket: {
        open: "#57F287",
        claimed: "#FAA61A",
        closed: "#ED4245",
        pending: "#99AAB5",
      },
      economy: "#F1C40F",
      birthday: "#E91E63",
      moderation: "#9B59B6",

      priority: {
        none: "#95A5A6",
        low: "#3498db",
        medium: "#2ecc71",
        high: "#f1c40f",
        urgent: "#e74c3c",
      },
    },

    footer: {
      text: "ZAVRO",
      icon: null,
    },

    thumbnail: null,

    author: {
      name: null,
      icon: null,
      url: null,
    },
  },

  // =========================
  // ECONOMY
  // =========================
  economy: {
    currency: {
      name: "coins",
      namePlural: "coins",
      symbol: "$",
    },
    startingBalance: 0,
    baseBankCapacity: 100000,
    dailyAmount: 100,
    workMin: 10,
    workMax: 100,
    begMin: 5,
    begMax: 50,
    robSuccessRate: 0.4,
    robFailJailTime: 3600000,
  },

  shop: {},

  tickets: {
    defaultCategory: null,
    supportRoles: [],
    priorities: {
      none: { emoji: "⚪", color: "#95A5A6", label: "None" },
      low: { emoji: "🟢", color: "#2ECC71", label: "Low" },
      medium: { emoji: "🟡", color: "#F1C40F", label: "Medium" },
      high: { emoji: "🔴", color: "#E74C3C", label: "High" },
      urgent: { emoji: "🚨", color: "#E91E63", label: "Urgent" },
    },
    defaultPriority: "none",
    archiveCategory: null,
    logChannel: null,
  },

  giveaways: {
    defaultDuration: 86400000,
    minimumWinners: 1,
    maximumWinners: 10,
    minimumDuration: 300000,
    maximumDuration: 2592000000,
    allowedRoles: [],
    bypassRoles: [],
  },

  birthday: {
    defaultRole: null,
    announcementChannel: null,
    timezone: "UTC",
  },

  verification: {
    defaultMessage: "Verify to continue in ZAVRO server.",
    defaultButtonText: "Verify",

    autoVerify: {
      defaultCriteria: "none",
      defaultAccountAgeDays: 7,
      serverSizeThreshold: 1000,
      minAccountAge: 1,
      maxAccountAge: 365,
      sendDMNotification: true,

      criteria: {
        account_age: "Account must be older than specified days",
        server_size: "All users if server is small",
        none: "All users immediately",
      },
    },

    verificationCooldown: 5000,
    maxVerificationAttempts: 3,
    attemptWindow: 60000,
    maxCooldownEntries: 10000,
    maxAttemptEntries: 10000,
    cooldownCleanupInterval: 300000,
    maxAuditMetadataBytes: 4096,
    maxInMemoryAuditEntries: 1000,

    logAllVerifications: true,
    keepAuditTrail: true,
  },

  welcome: {
    defaultWelcomeMessage:
      "Welcome {user} to ZAVRO! We now have {memberCount} members!",
    defaultGoodbyeMessage:
      "{user} has left ZAVRO. We now have {memberCount} members.",
    defaultWelcomeChannel: null,
    defaultGoodbyeChannel: null,
  },

  counters: {
    defaults: {
      name: "{name} Counter",
      description: "ZAVRO server counter",
      type: "voice",
      channelName: "{name}-{count}",
    },
    permissions: {
      deny: ["VIEW_CHANNEL"],
      allow: ["VIEW_CHANNEL", "CONNECT", "SPEAK"],
    },
    messages: {
      created: "✅ Created counter **{name}**",
      deleted: "🗑️ Deleted counter **{name}**",
      updated: "🔄 Updated counter **{name}**",
    },
    types: {
      members: {
        name: "👥 Members",
        description: "Total members",
        getCount: (guild) => guild.memberCount.toString(),
      },
      bots: {
        name: "🤖 Bots",
        description: "Total bots",
        getCount: (guild) =>
          guild.members.cache.filter((m) => m.user.bot).size.toString(),
      },
      members_only: {
        name: "👤 Humans",
        description: "Total humans",
        getCount: (guild) =>
          guild.members.cache.filter((m) => !m.user.bot).size.toString(),
      },
    },
  },

  messages: {
    noPermission: "No permission.",
    cooldownActive: "Wait {time} before using again.",
    errorOccurred: "Something went wrong.",
    missingPermissions: "Missing permissions.",
    commandDisabled: "Command disabled.",
    maintenanceMode: "ZAVRO is under maintenance.",
  },

  features: {
    economy: true,
    leveling: true,
    moderation: true,
    logging: true,
    welcome: true,
    tickets: true,
    giveaways: true,
    birthday: true,
    counter: true,
    verification: true,
    reactionRoles: true,
    joinToCreate: true,
    voice: true,
    search: true,
    tools: true,
    utility: true,
    community: true,
    fun: true,
  },
};

export function validateConfig(config) {
  const errors = [];

  if (!process.env.DISCORD_TOKEN && !process.env.TOKEN) {
    errors.push("Bot token is required");
  }

  if (!process.env.CLIENT_ID) {
    errors.push("Client ID is required");
  }

  if (process.env.NODE_ENV === 'production') {
    if (!process.env.POSTGRES_HOST) errors.push("DB host missing");
    if (!process.env.POSTGRES_USER) errors.push("DB user missing");
    if (!process.env.POSTGRES_PASSWORD) errors.push("DB password missing");
  }

  return errors;
}

const configErrors = validateConfig(botConfig);

if (configErrors.length > 0) {
  logger.error("Config errors:\n" + configErrors.join("\n"));
  if (process.env.NODE_ENV === "production") process.exit(1);
}

export const BotConfig = botConfig;

export function getColor(path, fallback = "#99AAB5") {
  if (typeof path === "number") return path;
  if (typeof path === "string" && path.startsWith("#")) {
    return parseInt(path.replace("#", ""), 16);
  }

  const result = path
    .split(".")
    .reduce(
      (obj, key) => (obj && obj[key] !== undefined ? obj[key] : fallback),
      botConfig.embeds.colors,
    );

  return typeof result === "string" && result.startsWith("#")
    ? parseInt(result.replace("#", ""), 16)
    : result;
}

export function getRandomColor() {
  const colors = Object.values(botConfig.embeds.colors).flatMap((c) =>
    typeof c === "string" ? c : Object.values(c),
  );
  return colors[Math.floor(Math.random() * colors.length)];
}

export default botConfig;
