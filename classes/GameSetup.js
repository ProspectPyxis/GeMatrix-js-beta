/* eslint-disable no-unused-vars */
const { nanoid } = require('nanoid');

class GameSetup {

    /**
     * @class
     * @param {Discord.Client} bot - The bot instance.
     * @param {Discord.Message} triggermsg - The message that created this GameSetup instance.
     * @param {Game} game - The game to setup.
     */
    constructor(bot, triggermsg, game) {

        this.bot = bot;
        this.msg = triggermsg;
        this.game = game;

        // Shorthands
        this.channel = triggermsg.channel;
        this.guild = triggermsg.guild;
        this.name = game.gameData.name;

        this.players = [triggermsg.author];
        this.gm = triggermsg.author;

        this.id = nanoid();
        this.options = game.gameData.defaultOptions;
        this.turnOrder = game.gameData.turnOrder === 1 ? [triggermsg.author] : null;
        this.randomTurns = false;

        this.init();

    }

    async init() {
        this.setupmsg = await this.channel.send(this.getSetupMessage());
        this.timer = setTimeout(() => {
            this.channel.send(`Setup for game "${this.game.gameData.name}" has timed out.`);
            this.abort();
        }, 120000);
    }

    /**
     * @returns {string} - The setup message string.
     */
    getSetupMessage() {
        let str = "";

        str += "**Setting up game:** " + this.name + "\n" + "**Host:** " + this.gm.tag + "\n--------------------\n";

        str += "**Players:**\n";
        str += this.players.join(" ");

        if (this.turnOrder) {
            str += "\n\n**Current turn order:**\n";
            if (this.randomTurns) str += "*Randomized!*";
            else str += this.turnOrder.join(", ");
        }

        if (Object.keys(this.options).length !== 0 || this.options.constructor !== Object) {
            // TODO: Refactor this for later games with custom rulesetss
        } else {
            str += "\n\nThis game has no custom rules available."
        }

        str += `\n\n*Once you are ready, run the command \`${this.bot.getPrefix(this.guild)}setupgame start\` to start the game.*`;
        str += `\n*To cancel this setup, run the command \`${this.bot.getPrefix(this.guild)}setupgame cancel\`.*`;
        str += `\n*Setup times out automatically 120 seconds after the last command.*`

        return str;
    }

    async interpretCommand(msg, args) {
        let cmd = args.shift();

        switch (cmd) {
            case 'invite':
                if (this.players.length === this.game.gameData.maxPlayers) {
                    this.channel.send(`You've already hit the player limit for this game! (Player limit: ${this.game.gameData.maxPlayers})`);
                    break;
                }
                if (this.players.length + msg.mentions.members.size > this.constructor.gameData.maxPlayers) {
                    this.channel.send(`You've invited too many players! (Player limit: ${this.constructor.gameData.maxPlayers})\nPlease invite less players.`);
                    break;
                }

                for (const i of msg.mentions.members.entries()) {
                    this.inviteUser(i[1].user);
                }
                this.channel.send('Users have been invited! The relevant user(s) must type "accept" to join the game within 30 seconds.');
                break;

            case 'option':
            case 'set':
                if (Object.keys(this.game.gameData.defaultOptions).length === 0 && this.game.gameData.defaultOptions === Object) {
                    this.channel.send("No custom options are available for this game!");
                    break;
                }
                if (!(args[0] in this.options)) {
                    this.channel.send(`The game option \`${args[0]} was not found for this game!`);
                    break;
                }

                switch (typeof this.options[args[0]]) {
                    case 'boolean':
                        this.options[args[0]] = args[1] === 'true' || args[1] == 1;
                        break;
                    case 'number':
                        this.options[args[0]] = Number(args[1]);
                        break;
                    case 'string':
                        args.shift();
                        this.options[args[0]] = args.join(' ');
                        break;
                    case 'object':
                        // TODO: Make this handle enum cases, since if it's none of the above three it's likely an enum
                        break;
                    default:
                        throw new Error('Error setting game option: unidentified variable');
                }
                this.setupmsg.edit(this.getSetupMessage());
                break;

            case 'turnorder':
            case 'turns':
                if (!this.game.gameData.turnOrder) {
                    this.channel.send("This game does not have turn orders!");
                    break;
                }

                if (args[0] == "random") {
                    this.randomTurns = !this.randomTurns;
                    this.channel.send(`Random Turn Order has been toggled to: \`${this.randomTurns}\`.`);
                }
                else if (this.randomTurns) {
                    this.channel.send("Random turn order is currently on - please turn it off to enable manual turn setting.");
                }
                else if (msg.mentions.members.size === 0) {
                    this.channel.send("You have not mentioned any player to change the position of!");
                }
                else if (!this.turnOrder.find(element => element.id === user.id)) {
                    this.channel.send("The user could not be found in the players list! Have you invited them yet?");
                }
                else {
                    // OPTIMIZE: There's probably a more efficient/cleaner way to do this?
                    var pos = parseInt(args[0]);
                    if (!pos || pos-1 < 0 || pos-1 > this.players.length) {
                        this.channel.send(`Position ${args[0]} is undefined! Did you order your arguments correctly?`);
                        break;
                    }

                    var user = msg.mentions.members.first().user;
                    var temp = this.turnOrder.filter(element => element.id !== user.id);
                    temp.splice(pos - 1, 0, user); // Using pos - 1 here because arrays start at 0 and not 1
                    this.turnOrder = temp;
                }
                break;

            case 'resend':
                this.setupmsg.delete();
                this.setupmsg = await this.channel.send(this.getSetupMessage());
                break;

            case 'start':
                clearTimeout(this.timer);
                this.bot.activeGames[this.guild.id][this.channel.id] = new this.game(this.id, this.bot, this.turnOrder ? this.turnOrder : this.players, this.options);
                return;

            case 'cancel':
                clearTimeout(this.timer);
                this.channel.send(`Setup for game "${this.game.gameData.name}" has been aborted.`);
                this.abort();
                return;
        }

        clearTimeout(this.timer);
        this.timer = setTimeout(() => {
            this.channel.send(`Setup for game "${this.game.gameData.name}" has timed out.`);
            this.abort();
        }, 120000);
    }

    /**
     * @param {Discord.User} user - The user to invite to the game.
     */
    inviteUser(user) {
        this.msg.channel.awaitMessages(response => response.author.id === user.id && response.content.toLowerCase() === "accept", {
                max: 1,
                time: 30000,
                errors: ['time'],
            })
            .then((collected) => {
                this.msg.channel.send(`${user} Invite accepted!`);
                this.players.push(user);
                this.setupmsg.edit(this.getSetupMessage());
            })
            .catch(() => {
                this.msg.channel.send(`Invite for user **${user.tag}** has timed out.`);
            });
    }

    abort() {
        delete this.bot.activeGames[this.guild.id][this.channel.id];
        if (Object.keys(this.bot.activeGames[this.guild.id]).length === 0 && this.bot.activeGames.constructor === Object)
            delete this.bot.activeGames[this.guild.id];
    }

}

module.exports = GameSetup;
