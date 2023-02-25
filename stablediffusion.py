import requests
import io
import base64
from PIL import Image, PngImagePlugin
import sys



prompt = sys.argv[1]
ms = sys.argv[2]

prompt_arr = prompt.split()
print(prompt_arr)
steps = 20
if any("--s" in s for s in prompt_arr):
    steps = [s for s in prompt_arr if "--s" in s]
    steps = "".join(steps)[3:]

url = "http://127.0.0.1:7860"

payload = {
    "prompt": prompt,
    "negative_prompt": "ugly, tiling, poorly drawn hands, poorly drawn feet, poorly drawn face, out of frame, extra limbs, disfigured, deformed, body out of frame, bad anatomy, watermark, signature, cut off, low contrast, underexposed, overexposed, bad art, beginner, amateur, distorted face",
    "steps": steps,
    "restore_faces": True,
    "sampler_index": "DPM++ 2M Karras",
    "cfg_scale": 7,
    "batch_size": 3,
}

response = requests.post(url=f"{url}/sdapi/v1/txt2img", json=payload)

r = response.json()

image_num = 1
for i in r["images"]:
    image = Image.open(io.BytesIO(base64.b64decode(i.split(",", 1)[0])))

    png_payload = {"image": "data:image/png;base64," + i}
    response2 = requests.post(url=f"{url}/sdapi/v1/png-info", json=png_payload)

    pnginfo = PngImagePlugin.PngInfo()
    pnginfo.add_text("parameters", response2.json().get("info"))
    image.save(f'C:/Users/cmbit/OneDrive/Documents/repos/telegram-bot/public/pics/{prompt.replace(" ", "")}{ms}{image_num}.png', pnginfo=pnginfo)
    image_num += 1



