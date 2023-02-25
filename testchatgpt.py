from revChatGPT.V1 import Chatbot
import sys
import os
from dotenv import load_dotenv
from gptprompts import prompts

load_dotenv()
prompt = sys.argv[1]
emails = [os.environ.get("EMAIL1"), os.environ.get("EMAIL2"), os.environ.get("EMAIL3"), os.environ.get("EMAIL4")]


def check_pre_prompt():
    global prompt
    for promptkey in prompts:
        if promptkey in prompt:
            prompt = prompt.replace(promptkey, "")
            return prompts[promptkey]
    return ""




response = ""

all_args = sys.argv[1:]
if (len(sys.argv) > 3):
    conversation_Id = sys.argv[2]
    parental_Id = sys.argv[3]
    account_index = sys.argv[4]
    chatbot = Chatbot(config={
        "email": f"{emails[int(account_index)]}",
        "password": os.environ.get("MAIN_PASSWORD")
    })

    for data in chatbot.ask(prompt, conversation_Id, parental_Id):
        response = data["message"]
        conv_id = (data['conversation_id'])
        parent_id = (data['parent_id'])
else:
    account_index = sys.argv[2]
    chatbot = Chatbot(config={
        "email": f"{emails[int(account_index)]}",
        "password": os.environ.get("MAIN_PASSWORD")
    })

    pre_prompt = check_pre_prompt()
    for data in chatbot.ask((pre_prompt + prompt)):
        response = data["message"]
        conv_id = (data['conversation_id'])
        parent_id = (data['parent_id'])


print(response)
print(conv_id)
print(parent_id)
