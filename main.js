import TelegramBot from "node-telegram-bot-api";
import { PythonShell } from "python-shell";
import flatCache from "flat-cache";
import express from "express";
import bodyParser from "body-Parser";
import * as dotenv from "dotenv";
import { ChatGPTClient } from "@waylaidwanderer/chatgpt-api"
import {prompts} from "./prompts.js";
ChatGPTClient.apply
//loads env files
dotenv.config();

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

//Chatgpt api
const api = new ChatGPTAPI({
  apiKey: process.env.OPENAI_API_KEY
})

// replace the value below with the Telegram token you receive from @BotFather
const token = process.env.TELEGRAM_TOKEN;

// Create a bot that uses 'polling' to fetch new updates
const bot = new TelegramBot(token, { polling: true });

//welcome message when starting conversation with bot for first time
const WELCOME_MESSAGE = prompts.instructions
// Listen for any kind of message. There are different kinds of
// messages.
bot.on("message", async (msg) => {
  const chatId = msg.chat.id;
  if (msg.text.toLowerCase().startsWith("dream")) {
    const stableDiffusionClient = new StableDiffusionClient(chatId, msg);
    await stableDiffusionClient.runStableDiffusion();
    await stableDiffusionClient.sendPictureResults();
  }
  else if (msg.text.toLowerCase().startsWith("/help")) {
  bot.sendMessage(chatId, WELCOME_MESSAGE, { parse_mode: "html" });
  }
  else {
    const ChatGPTClient = new ChatGPTOfficial(chatId, msg.text);
    await ChatGPTClient.runMainProgram();
  }
});

class StableDiffusionClient {
  constructor(senderid, message) {
    this.senderid = senderid;
    this.message = message.text.slice(6);
  }

  async runStableDiffusion() {
    try {
      this.messageTime = Date.now();
      let options = {
        args: [`${this.message}`, `${this.messageTime}`],
      };
      await PythonShell.run("stablediffusion.py", options);
    } catch (err) {
      console.log(err);
    }
  }

  async sendPictureResults() {
    try {
      const numberOfPictures = 3;
      const pictureArray = [];
      for (let i = 1; i <= numberOfPictures; i++) {
        const url = `${mainServer}/pics/${this.message.replace(/\s+/g, "")}${
          this.messageTime
        }${i}.png`;
        const pictureObject = { type: "photo", media: url };
        pictureArray.push(pictureObject);
      }
      bot.sendMediaGroup(this.senderid, pictureArray);
    } catch (err) {
      console.log(err);
    }
  }
}

class ChatGPTOfficial {
  constructor(senderid, message) {
  this.senderid = senderid;
  this.message = message;
  this.cache = flatCache.load(`${senderid}`);
  this.gptOpts = {};
}

async runMainProgram() {
  // flatCache.clearAll(); return
  if (this.resetMessageCache()) return;
  this.setGptOptions();
  const message = await this.runChatGPT(this.gptOpts);
  console.log(message)
  this.sendMessage(message);
  this.saveCache(message);
}

resetMessageCache() {
  if (
    this.message.toLowerCase().startsWith("chatgpt exit") ||
    this.message.toLowerCase().startsWith("/start") ||
    this.cache.keys().length === 0
  ) {
    flatCache.clearCacheById(`${this.senderid}`);
    this.cache.setKey(`${this.senderid}`, { id: this.senderid });
    this.cache.save();
    bot.sendMessage(this.senderid, 'Starting New Conversation...Please type your first message, or respond with "/help" to see a list of options');
    return true;
  } else return false;
}

checkForPrePrompt(){
  const prePrompts = Object.keys(prompts);
  for (const key of prePrompts){
    if (this.message.startsWith(key)){
      this.message.replace(key, "")
      return prompts[key]
    }
  }
  return false
}
setGptOptions() {
  if (Object.keys(this.cache.getKey(`${this.senderid}`)).length === 1) {
    this.gptOpts = {args: [this.message]};
    const prePrompt = this.checkForPrePrompt();
    if(prePrompt){
      this.gptOpts["prePrompt"] = prePrompt
    }
    //set options for continue conversation
  } else {
    this.gptOpts = {args: [this.message, `${this.cache.getKey(`${this.senderid}`).conversationId}`, `${this.cache.getKey(`${this.senderid}`).parentMessageId}`]};
  }
}

async runChatGPT(opts) {
  if(opts.args.length === 1){
    if(opts.prePrompt){
    return await api.sendMessage(this.message, {systemMessage: opts.prePrompt})
    }
    return await api.sendMessage(this.message)
  }
  else{
    if(this.cache.getKey(`${this.senderid}`).prePrompt){
      return await api.sendMessage(this.message, {parentMessageId: `${opts.args[1]}`, systemMessage: this.cache.getKey(`${this.senderid}`).prePrompt})
    }
    else{
      return await api.sendMessage(this.message, {parentMessageId: `${opts.args[1]}`})
    }
  }
}

sendMessage(res) {
  bot.sendMessage(
    this.senderid,
    res.text
  );
}

saveCache(res) {
  console.log(res.id)
  if(this.gptOpts.prePrompt){
    this.cache.setKey(`${this.senderid}`, {
      id: this.senderid,
      parentMessageId: res.id,
      prePrompt: this.gptOpts.prePrompt
    });
  }
  else if(this.cache.getKey(`${this.senderid}`).prePrompt){
    this.cache.setKey(`${this.senderid}`, {
      id: this.senderid,
      parentMessageId: res.id,
      prePrompt: this.cache.getKey(`${this.senderid}`).prePrompt
    });
  }
  else{
    this.cache.setKey(`${this.senderid}`, {
      id: this.senderid,
      parentMessageId: res.id,
    });
  }
  this.cache.save();
}
}
