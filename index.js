// A majority of this code was taken from An Idiot's Guide's guidebot. Thank you!

const Discord = require("discord.js");
const { promisify } = require("util");
const readdir = promisify(require("fs").readdir);
const Enmap = require("enmap");
const winston = require("winston");
const { format } = require("logform");

const config = require("./config/global_config.js");

const Game = require("./classes/Game.js");

const bot = new Discord.Client();

bot.config = config;

require("./common/bot_functions.js")(bot);

bot.commands = new Enmap();
bot.aliases = new Enmap();
bot.games = [];

/*
There's probably a better way to do this, but enmaps can't store classes
so I'm just using an object to store active games with some additional GC code (see ./common/bot_functions.js)
I'm not sure if the GC code is necessary but better safe than memory leak down the line
*/
bot.activeGames = {};

// Setup logger
bot.logger = winston.createLogger({
    level: "debug",
    format: format.combine(
        format(info => {
            info.level = info.level.toUpperCase()
            return info;
        })(),
        format.cli(),
        format.timestamp({
            format: 'YYYY-MM-DD HH:mm:ss'
        }),
        format.printf(info => `${info.timestamp} ${info.level}: ${info.message}`)
    ),
    transports: [
        new winston.transports.Console()
    ]
});

const init = async () => {

    const cmdFiles = await readdir("./commands/");
    bot.logger.log('info', `Loading a total of ${cmdFiles.length} commands.`);
    cmdFiles.forEach(f => {
        if (!f.endsWith(".js")) return;
        const response = bot.loadCommand(f);
        if (response) bot.logger.log('error', response);
    });

    const evtFiles = await readdir("./events/");
    bot.logger.log('info', `Loading a total of ${evtFiles.length} events.`);
    evtFiles.forEach(file => {
        const eventName = file.split(".")[0];
        bot.logger.log('info', `Loading Event: ${eventName}`);
        const event = require(`./events/${file}`);
        bot.on(eventName, event.bind(null, bot));
    });

    const gameFiles = await readdir("./classes/games/");
    bot.logger.log('info', `Loading a total of ${gameFiles.length} games.`);
    gameFiles.forEach(file => {
        const gameName = file.split(".")[0];
        bot.logger.log('info', `Loading Game: ${gameName}`);
        const g = require(`./classes/games/${file}`);
        if (!(g instanceof Game)) return bot.logger.log('error', `Unable to load game ${gameName}: Not an instance of Game`)
        bot.games.push(g);
    });

    bot.logger.log('info', "Logging in...");
    bot.login(bot.config.token);
};

init();