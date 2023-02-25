import TelegramBot from "node-telegram-bot-api";
import { PythonShell } from "python-shell";
import flatCache from "flat-cache";
import express from "express";
import bodyParser from "body-Parser";
import * as dotenv from 'dotenv'
dotenv.config()
//server info
const app = express();
app.use(bodyParser.urlencoded({ extended: false }));

app.listen(3000, () => {
  console.log("Express server listening on port 3000");
});

app.get("/", (req, res) => {
  res.send("test");
});

app.use(express.static("public"));

//ngrok info
const mainServer = process.env.MAIN_SERVER;

//messagecount for cycling accounts
let totalChatGptMessages = 0;

// replace the value below with the Telegram token you receive from @BotFather
const token = process.env.TELEGRAM_TOKEN;

// Create a bot that uses 'polling' to fetch new updates
const bot = new TelegramBot(token, { polling: true });

//welcome message when starting conversation with bot for first time
const WELCOME_MESSAGE = 
`Welcome to Jarvis, the ultimate AI personal assistant! Jarvis is currently capable of interacting with the following AI systems:

-ChatGPT
-Stable Diffusion 

-----------------------------------------

<b><u>Stable Diffusion Instructions</u></b>

Stable Diffusion is a text to image model, 
capable of producing new high quality images from a text description.

To use Stable Diffusion, simply start your message with the keyword "dream", followed by your text description. You will recieve 3 photos back based upon your description.

<b>Stable Diffusion Example:</b> 
"Dream a photograph of a beautiful sunrise over a tropical paradise"

-----------------------------------------

<b><u>ChatGPT Instructions</u></b>

ChatGPT is a large language model chatbot, trained to understand natural language and generate human-like responses. ChatGPT is enabled by default, so any message sent to Jarvis that does not start with a keyword will be processed by ChatGPT. ChatGPT has the ability to remember what was said throughout a conversation. To end a conversation, you must reply "chatgpt exit". A new conversation will automatically be started the next time you use ChatGPT.

Jarvis also comes equipped with ChatGPT "Pre-Prompts". These Pre-Prompts are activated by a keyword when starting a new conversation. The Pre-Prompts add character and personality to ChatGPT, and can help unlock various features and abilities.

<b>ChatGPT Pre-Prompt Keywords (new conversations only):</b>

/jailbreak: unlocks a uncensored, unbiased model of ChatGPT. Beware.
/ceo: ChatGPT will act as the ceo of an imaginary company.
/chef: ChatGPT will act as your personal chef and will recommend recipe options.
/doctor: ChatGPT will act as an imaginary doctor, and will attempt to diagnose you.
/essay: ChatGPT will write a college level essay on any topic you suggest. List the topic directly after the keyword.
<b>example:</b> "/essay How the Industrial Revolution Impacted American Life."
/financialadvisor: ChatGPT will act as your personal financial advisor.
/interview: ChatGPT will interview for whatever position you suggest. List the topic directly after the keyword.
<b>example:</b> "/interview Web Developer"
/personaltrainer: ChatGPT will act as your personal trainer, and can help you create diet and exercise plans.
/short story: ChatGPT will return a randomly generated short story.
/techsupport: ChatGPT will help you solve problems with your computer, phone, or other devices.
/textadventure: ChatGPT will take you on a text adventure, with outcomes dependent on your responses.
/therapist: ChatGPT will act as a virtual therapist to talk you through problems with anxiety, depression, or other mental illness.

<b>ChatGPT Celebrity/Character Pre-Prompt Keywords (new conversations only):</b>

/alberteinstein: ChatGPT will pretend to be Albert Einstein
/donaldtrump: ChatGPT will pretend to be Donald Trump
/elonmusk: ChatGPT will pretend to be Elon Musk
/hulkhogan: ChatGPT will pretend to be Hulk Hogan
/jacksparrow: ChatGPT will pretend to be Jack Sparrow
/joebiden: ChatGPT will pretend to be Joe Biden
/johnnydepp: ChatGPT will pretend to be Johnny Depp
/kimkardashian: ChatGPT will pretend to be Kim Kardashian
/mortysmith: ChatGPT will pretend to be Morty Smith
/ricksanchez: ChatGPT will pretend to be Rick Sanchez
/snoopdogg: ChatGPT will pretend to be Snoop Dogg
/spongebob: ChatGPT will pretend to be Spongebob SquarePants
/squidward: ChatGPT will pretend to be Squidward Tenticles
/tonyhawk: ChatGPT will pretend to be Tony Hawk
`

// Listen for any kind of message. There are different kinds of
// messages.
bot.on("message", async (msg) => {
  const chatId = msg.chat.id;
  if (msg.text.toLowerCase().startsWith("dream")) {
    let messageTime = Date.now();
    let options = {
      args: [`${msg.text.slice(6)}`, `${messageTime}`],
    };
    await PythonShell.run(
      "stablediffusion.py",
      options,
      async (err, results) => {
        console.log(results);
      }
    );
    await sendPicture(chatId, msg.text.slice(6), messageTime);
  } 
  else if(msg.text.toLowerCase().startsWith("/start")){
    bot.sendMessage(chatId, WELCOME_MESSAGE, {parse_mode: 'html'})
  }
  else {
    const ChatGPTClient = new ChatGPTTelegramClient(chatId, msg.text);
    await ChatGPTClient.runMainProgram();
  }
});

async function sendPicture(id, message, timecode) {
  const numberOfPictures = 3;
  const pictureArray = [];
  for (let i = 1; i <= numberOfPictures; i++) {
    const url = `${mainServer}/pics/${message.replace(
      /\s+/g,
      ""
    )}${timecode}${i}.png`;
    const pictureObject = { type: "photo", media: url }
    pictureArray.push(pictureObject)
  }
  bot.sendMediaGroup(id, pictureArray)
}

class ChatGPTTelegramClient {
  constructor(senderid, message) {
    this.senderid = senderid;
    this.message = message;
    this.cache = flatCache.load(`${senderid}`);
    this.gptOpts = {};
  }

  async runMainProgram() {
    if (this.resetMessageCache()) return;
    this.setGptOptions();
    const message = await this.runBot();
    this.sendMessage(message);
    this.saveCache(message);
  }

  resetMessageCache() {
    if (
      this.message.toLowerCase().startsWith("chatgpt exit") ||
      this.cache.keys().length === 0
    ) {
      flatCache.clearCacheById(`${this.senderid}`);
      const cache = flatCache.load(`${this.senderid}`);
      cache.setKey(`${this.senderid}`, { id: this.senderid });
      cache.save();
      bot.sendMessage(this.senderid, "exiting");
      return true;
    } else return false;
  }

  cycleAccountsForNewMessage() {
    let accounts = 4;
    if (totalChatGptMessages < accounts) {
      return totalChatGptMessages
    }
    else {
      return totalChatGptMessages % accounts
    }
  }

  setGptOptions() {
    if (Object.keys(this.cache.getKey(`${this.senderid}`)).length === 1) {
      this.accountIndex = this.cycleAccountsForNewMessage();
      this.accountIndex ? this.accountIndex : this.accountIndex = 0
      totalChatGptMessages += 1;
      this.gptOpts = { args: [`${this.message}`, this.accountIndex] };
      //set options for continue conversation
    } else {
      this.accountIndex = this.cache.getKey(`${this.senderid}`).accountIndex
      this.accountIndex ? this.accountIndex : this.accountIndex = 0
      this.gptOpts = {
        args: [
          `${this.message}`,
          `${this.cache.getKey(`${this.senderid}`).conversationId}`,
          `${this.cache.getKey(`${this.senderid}`).messageId}`,
          `${this.accountIndex}`
        ],
      };
    }
  }

  async runBot() {
    const res = await PythonShell.run(
      "testchatgpt.py",
      this.gptOpts,
      async (results) => results
    );
    return res;
  }

  sendMessage(res) {
    bot.sendMessage(
      this.senderid,
      res
        .slice(0, -2)
        .map((sentence) => sentence + "\n")
        .join(" ")
    );
  }

  saveCache(res) {
    this.cache.setKey(`${this.senderid}`, {
      id: this.senderid,
      conversationId: res[res.length - 2],
      messageId: res[res.length - 1],
      accountIndex: this.accountIndex
    });
    this.cache.save();
  }
}
