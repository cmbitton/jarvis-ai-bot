const res = await fetch("https://api.openai.com/v1/chat/completions", {
    "headers": {
      "accept": "*/*",
      "accept-language": "en-US,en;q=0.9",
      "sec-fetch-dest": "empty",
      "sec-fetch-mode": "cors",
      "sec-fetch-site": "same-site"
    },
    "referrer": "https://platform.openai.com/",
    "referrerPolicy": "strict-origin-when-cross-origin",
    "body": null,
    "method": "OPTIONS",
    "mode": "cors",
    "credentials": "omit"
  });

console.log(res)