import TelegramBot from "node-telegram-bot-api";
import { PythonShell } from "python-shell";
import flatCache from "flat-cache";
import express from "express";
import bodyParser from "body-parser";
import * as dotenv from "dotenv";
import { ChatGPTClient } from "@waylaidwanderer/chatgpt-api"
import {prompts} from "./prompts.js";
import { KeyvFile } from "keyv-file"


const cacheOptions = {
  // Options for the Keyv cache, see https://www.npmjs.com/package/keyv
  // This is used for storing conversations, and supports additional drivers (conversations are stored in memory by default)
  // For example, to use a JSON file (`npm i keyv-file`) as a database:
  store: new KeyvFile({ filename: 'cache.json' }),
};

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
    if (this.message.includes(key)){
      this.message.replace(key, "")
      return {key: key.slice(1), prompt: prompts[key]}
    }
  }
  return false
}

setModel() {
  if(this.message.toLowerCase().startsWith("/gpt4") || this.message.toLowerCase().startsWith("/chatgpt")){
    if(this.message.toLowerCase().startsWith("/gpt4")){
      this.gptOpts["model"] = "gpt-4"
      return {model: "gpt-4"}
    }
    else if(this.message.toLowerCase().startsWith("/chatgpt")){
      this.gptOpts["model"] = "gpt-3.5-turbo"
      return {model: "gpt-3.5-turbo"}
    }
  }
  else if(this.cache.getKey(`${this.senderid}`).model === "gpt-4" || this.cache.getKey(`${this.senderid}`).model === "gpt-3.5-turbo"){
    if(this.cache.getKey(`${this.senderid}`).model === "gpt-4"){
      this.gptOpts["model"] = "gpt-4"
      return {model: "gpt-4"}
    }
    else if(this.cache.getKey(`${this.senderid}`).model === "gpt-3.5-turbo"){
      this.gptOpts["model"] = "gpt-3.5-turbo"
      return {model: "gpt-3.5-turbo"}
    }
  }
  else {
    this.gptOpts["model"] = "gpt-3.5-turbo"
    return {model: "gpt-3.5-turbo"}
  }
}

setGptOptions() {
  //set options for a new conversation
  if (Object.keys(this.cache.getKey(`${this.senderid}`)).length === 1) {
    this.gptOpts = {args: [this.message]};
  //set options for continue conversation
  } else {
    this.gptOpts = {args: [this.message, `${this.cache.getKey(`${this.senderid}`).conversationId}`, `${this.cache.getKey(`${this.senderid}`).parentMessageId}`]};
  }
  //checks for and sets ChatGPT preprompt
  const prePrompt = (this.checkForPrePrompt() || this.cache.getKey(`${this.senderid}`).prePrompt);
  if(prePrompt){
    this.gptOpts["prePrompt"] = prePrompt.prompt;
    this.gptOpts["gptLabel"] = prePrompt.key;
    this.ChatGPTAPI = new ChatGPTClient(process.env.OPENAI_API_KEY, {chatGptLabel: prePrompt.key, promptPrefix: prePrompt.prompt, modelOptions: this.setModel()}, cacheOptions);
  }
  else{
    this.ChatGPTAPI = new ChatGPTClient(process.env.OPENAI_API_KEY, {chatGptLabel: 'system', modelOptions: this.setModel()}, cacheOptions);
  }
}

async runChatGPT(opts) {
  if(opts.args.length === 1){
    return await this.ChatGPTAPI.sendMessage(this.message)
  }
  else{
    console.log("other message")
    return await this.ChatGPTAPI.sendMessage(this.message, {parentMessageId: `${opts.args[2]}`, conversationId: `${opts.args[1]}`})
  }
}

sendMessage(res) {
  bot.sendMessage(
    this.senderid,
    res.response
  );
}

saveCache(res) {
  console.log(res.id)
  if(this.gptOpts.prePrompt){
    this.cache.setKey(`${this.senderid}`, {
      id: this.senderid,
      parentMessageId: res.messageId,
      conversationId: res.conversationId,
      prePrompt: {prompt: this.gptOpts.prePrompt, key: this.gptOpts.gptLabel},
      model: this.gptOpts.model
    });
  }
  else if(this.cache.getKey(`${this.senderid}`).prePrompt){
    this.cache.setKey(`${this.senderid}`, {
      id: this.senderid,
      parentMessageId: res.messageId,
      conversationId: res.conversationId,
      prePrompt: this.cache.getKey(`${this.senderid}`).prePrompt,
      model: this.gptOpts.model
    });
  }
  else{
    this.cache.setKey(`${this.senderid}`, {
      id: this.senderid,
      parentMessageId: res.messageId,
      conversationId: res.conversationId,
      model: this.gptOpts.model
    });
  }
  this.cache.save();
}
}
