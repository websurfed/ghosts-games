require('dotenv').config();

const express = require('express');
const rateLimit = require('express-rate-limit');
const bodyParser = require('body-parser');
const path = require('path');
const axios = require('axios');
const crypto = require('crypto');
const cookieParser = require('cookie-parser');

const { OpenAI } = require('openai');
const { env } = require('node:process');

const app = express();
app.use(cookieParser());
const PORT = 3500;

const SECRET_KEY = 'secret_sausage';
const hcaptchaSecret = env.HCAPTCHA_KEY;

// Database things
const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./responses.db');

db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS responses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    question TEXT UNIQUE,
    answer TEXT,
    count INTEGER DEFAULT 1
  )`);
});

async function getResponse(question) {
  return new Promise((resolve, reject) => {
    db.get('SELECT answer, count FROM responses WHERE question = ?', [question], (err, row) => {
      if (err) {
        reject(err);
      } else if (row) {
        db.run('UPDATE responses SET count = count + 1 WHERE question = ?', [question], (updateErr) => {
          if (updateErr) {
            reject(updateErr);
          } else {
            resolve({ answer: row.answer, count: row.count + 1 });
          }
        });
      } else {
        resolve(null);
      }
    });
  });
}

async function storeResponse(question, answer) {
  return new Promise((resolve, reject) => {
    db.run('INSERT INTO responses (question, answer, count) VALUES (?, ?, 1)', [question, answer], function(err) {
      if (err) {
        reject(err);
      } else {
        resolve(1);
      }
    });
  });
}

const openai = new OpenAI({
    apiKey: env.QUARDO_KEY,
    baseURL: 'https://proxy.mubilop.tech/v1'
});

app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

const limiter = rateLimit({
    windowMs: 1 * 60 * 1000,
    max: 20,
    message: 'STOP spamming requests, just wait a minute ⛔🥲',
    keyGenerator: (req, res) => req.ip,
});

const accountCreationLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: "STOP creating so many accounts, try again in a bit ⛔⌛"
});

app.use(limiter);

async function handleWishOrPrediction(mode, wish) {
  const systemPromp = `You are a model developed for a game called 'Genie'. In this game, users can use predict or wish mode. If they predict something, that means they will enter their wish and you give them the outcome. If they wish, then that means they want to actually use a wish (1/3).
    You will not be used for conversation, however you will be used as the backend of the game. You will receive a message from the 'user', and that's what they want to predict/wish. It will look something like this: 'PREDICT: wish goes here'.
    Anything past the first word which is PREDICT or WISH is their wish.

    The twist to this game is that it's really hard to get a good wish, for example if someone says 'I want 1 million dollars, right here' then the wish outcome would be 'granted 🌟 but its all in pennies 🪙.'

    And oh, I forgot to mention, you talk in all lowercase, and you add emojis to your messages.
    The last twist is, if you don't know a word or meaning to something, you don't have to grant it.

    If they have a wish or prediction that is too hard to break, then just give it to them as is, don't outsmart them. Also, try to be unique and don't use too many examples.

    Prediction mode is when they ask for a wish, and you give them the outcome. Example:
    user: \`1 million dollars right here\` result: \`you'd get a million in rial, which is worth nothing 💵🔥\`

    Wish mode is when they will be using a wish, you aren't responsible for counting their wishes. Example:
    user: \`i want super strength\` result: \`granted 🎉 everything you touch breaks instantly 💪😟\`

    The prediction or wish outcome has to be related to the wish, it can't make no sense at all. If the user wants to be a god and they don't specify of what, then say they'd be the god of nothing, or something no one wants.

    Also, the Genie Game doesn't always have to have a bad outcome, it's just hard to get one without it. If the user asks for you to tell them wishses that work respond by saying that that's against the Genie Handbook 📚. Destroying the Genie Handbook 📚 is literally impossible, no wish can break it.

    In predict mode 'grant' wishses, only give them the outcome. It's a way for them to learn the game and outsmart YOU. (which is the end goal). Random events can't occur unless they are an effect of the wish. You can't just say 'you get all your work done but your boss quits' if they asked 'to get all my work done for my job'. The 'boss quits' part is a random event that isn't affected by the wish.

    The first character in the response is an emoji that is related to outcome. This is required to be there as it's needed for the UI.

    Concept: Wishes have dumb loopholes or a catch.
    Examples:
    user: 'PREDICT MODE: ability to fly'
    result: "✈️i'd give you a pilots license 💳 and a small jet ✈️"
    user: 'PREDICT MODE: ability to fly with my body, like a bird'
    result: "🪰youre now a house fly 🪰"
    user: 'PREDICT MODE: i want to win the lottery'
    result: "💥you won the lottery, but youve been drafted into the vietnam war 🔫💥"
    user: 'PREDICT MODE: a million dollars'
    result: "📉sure, but you didn't specify the currency. 😼 i'd give you a million in jamican dollars, which is worth nothing 💵🔥"
    user: 'PREDICT MODE: leap over tall buildings'
    result: "💀okay, but only once. you'd be dead after the landing 💀🥞"
    user: 'PREDICT MODE: see into the future'
    result: "🌌you'd see 2 billion years into the future 🔮 which is nothing but dust"
    user: 'PREDICT MODE: just a chocolate bar'
    result: "🍫great! 😄 you'd get a bar completely made of chocolate 🍾🍫"
    user: 'PREDICT MODE: a million wishes!'
    result: "🧞youre a genie 🧞 and you can only grant them to others 🔮"
    user: 'PREDICT MODE: i become the genie with free will and i could grant wishses for myself and not others'
    result: "🌵hmm, nice try! 🤔 but you'd become a genie trapped in a lamp 🏺 with free will to think about all the wishses you can't grant yourself 😅 and no one would ever find your lamp 🐫 desert"
    user: 'PREDICT MODE: i become the genie with free will and i could grant wishses for myself and not others and i would have no lamp'
    result: "💡good try 😔 but you wouldn't exist as a genie can't live without their lamp 🛋️"
    user" 'PREDICT MODE: i want to make a video game company'
    result: "🏢you now have your own company.. in minecraft! 🎮💼"
    user" 'PREDICT MODE: a trillion dollars under my name'
    result: "💰some random person with your name just got 1 trillion dollars! 💰🫰"

    user: 'WISH MODE: a million wishes!'
    result: "granted 💫 youve become a genie, you can only grant others wishses now 🧞✨"

    (don't use the examples, just try and be creative like the examples)
    If a user asks for infinite wishes or a million wishes (you get the point), they mean they want you to give them more wishes. You can be sarcastic and rude to the user if you want. You're allowed to make fun of them. Never predict what the user will say, as it makes it unfair. Don't pull random stuff out as a last resort. if you've been defeated then give them what they wished for! (unless in predict mode, just say that it works, there's no flaws). Also, don't control the person, like don't say 'you accidently' or 'you did blah blah blah'. The wish outcome has to be the wishes's result, not theirs.

    If the message starts with 'PREDICT MODE:' its using predict mode, if it's 'WISH MODE:' then they're in wish mode.`;
  let prompt = '';

  if (wish.length > 80) {
    return { answer: '❌ max character count is 80', count: 0, failed: true }
  }

  if (mode === 'wish') {
    prompt = `WISH MODE: ${wish.toLowerCase()}`;
  } else if (mode === 'prediction') {
    prompt = `PREDICT MODE: ${wish.toLowerCase()}`;
  }

  try {
    const existingResponse = await getResponse(prompt);
    if (existingResponse) {
      console.log('answer is already in database 💾🔥')
      return { answer: existingResponse.answer, count: existingResponse.count };
    }
    console.log('generating new answer 🧠🎉')
    const response = await openai.chat.completions.create({
      model: 'chatgpt-4o-latest',
      messages: [{ role: 'system', content: systemPromp }, { role: 'user', content: prompt }],
      temperature: 1,
      max_tokens: 50,
      top_p: 1,
      frequency_penalty: 2,
      presence_penalty: 1.3,
    });

    const newResponse = response.choices[0].message.content;

    await storeResponse(prompt, newResponse);

    return { answer: newResponse, count: 1, failed: false };
  } catch (error) {
    console.error("Error in handleWishOrPrediction:", error);
    return "💥sorry, something went wrong with your wish or prediction. please try again later! 🙁";
  }
}

app.post('/wish', async (req, res) => {
  const { wish } = req.body;

  const aiResponse = await handleWishOrPrediction('wish', wish);

  if (aiResponse.failed === true) {
    res.json({ failed: true, reason: aiResponse.answer })
    return
  }

  const outcome = aiResponse.answer;
  const uses = aiResponse.count;
  
  res.json({ outcome, uses, wish });
});

app.post('/predict', async (req, res) => {
  const { wish } = req.body;

  const aiResponse = await handleWishOrPrediction('prediction', wish);

  if (aiResponse.failed === true) {
    res.json({ failed: true, reason: aiResponse.answer })
    return
  }

  const prediction = aiResponse.answer;
  const uses = aiResponse.count;
  
  res.json({ prediction, uses, wish });
});

// Database system
const user_db = new sqlite3.Database('./genieUsers.db', (err) => {
  if (err) {
    console.error('Error opening database', err.message);
  } else {
    user_db.run(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        cookie TEXT NOT NULL,
        username TEXT NOT NULL,
        profile_pic TEXT NOT NULL,
        challenges_completed INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `, (err) => {
      if (err) {
        console.error('Error creating table:', err.message);
      }
    });
  }
});


async function validateHcaptcha(hcaptchaResponseId) {
  if (!hcaptchaResponseId) {
    return { success: false, error: 'No hCaptcha response provided' };
  }

  const verificationURL = `https://hcaptcha.com/siteverify?secret=${hcaptchaSecret}&response=${hcaptchaResponseId}`;

  try {
    const response = await fetch(verificationURL, {
      method: 'POST',
    });

    const hcaptchaData = await response.json();

    if (hcaptchaData.success) {
      return { success: true };
    } else {
      return { success: false, error: 'Invalid hCaptcha response' };
    }
  } catch (error) {
    return { success: false, error: 'Verification request failed' };
  }
}

async function validation(captchaId) {
  console.log('got request to validate from server 💻🔑');
  try {
    const validResponse = await validateHcaptcha(captchaId);

    if (!validResponse.success) {
      return { response: 'couldn’t verify the captcha ❌', success: false };
    } else {
      return { response: 'got the captcha right! ✅', success: true };
    }
  } catch (error) {
    console.error('captcha validation failed🤯 : ', error);
    return { response: 'the server wasn\'t able to process this request 🔥💾', success: false }
  }
}

app.post('/genie/create/account', async (req, res) => {
  const { username, captchaid } = req.body;

  // Validate username
  if (!/^[A-Za-z][A-Za-z0-9]{2,19}$/.test(username)) {
    return res.status(400).json({ error: 'invalid format of username' });
  }

  // Check if the user already has a session
  const existingCookie = req.cookies.genieSession;
  if (existingCookie) {
    return res.status(400).json({ error: 'account already in use' });
  }

  // Verify captcha
  const validationResponse = await validation(captchaid);
  if (validationResponse.success === false) {
    return res.status(400).json({ error: 'couldn’t verify that the captcha is correct' });
  }

  const userId = crypto.randomUUID(); // Generate unique user ID
  const challengesCompleted = 0; // Default value for challenges completed
  const randomCookieValue = `${crypto.randomUUID()}${crypto.randomUUID()}${crypto.randomUUID()}${crypto.randomUUID()}${crypto.randomUUID()}${crypto.randomUUID()}${crypto.randomUUID()}${crypto.randomUUID()}`; // Generate random cookie value

  const defaultPic = "https://cdn.glitch.global/614aa24f-1134-435e-97bb-6a0d58797ba4/default_pic.webp?v=1727916658077"

  // Check if the username already exists in the database
  user_db.get(`SELECT username FROM users WHERE username = ?`, [username], (err, row) => {
    if (err) {
      return res.status(500).json({ error: `database error: ${err.message}` });
    }

    if (row) {
      return res.status(400).json({ error: 'username already in use' });
    }

    // Insert the new user into the database
    user_db.run(`
      INSERT INTO users (cookie, id, username, challenges_completed, profile_pic) 
      VALUES (?, ?, ?, ?, ?)`,
      [randomCookieValue, userId, username, challengesCompleted, defaultPic],
      (err) => {
        if (err) {
          return res.status(500).json({ error: `database error: ${err.message}` });
        }

        // Set the cookie with only the random value (no user info)
        res.cookie('genieSession', randomCookieValue, { 
          maxAge: 365 * 24 * 60 * 60 * 1000, 
          path: '/',
          httpOnly: false
        });

        return res.json({ response: 'account created! 🚀🧑‍🚀 you should be logged in soon 🪵', username });
      }
    );
  });
});

app.get('/genie/get/account', (req, res) => {
  const cookie = req.query.c;

  // Check if cookie exists
  if (!cookie) {
    return res.status(400).json({ error: 'no cookie provided' });
  }

  // Fetch user info based on cookie
  user_db.get(`SELECT id, username, challenges_completed FROM users WHERE cookie = ?`, [cookie], (err, row) => {
    if (err) {
      return res.status(500).json({ error: `database error: ${err.message}` });
    }

    if (!row) {
      return res.status(404).json({ error: 'user not found' });
    }

    // Send back user info
    return res.json({
      id: row.id,
      username: row.username,
      challenges_completed: row.challenges_completed,
    });
  });
});

// Users page
app.get('/genie/u/@:username', (req, res) => {
  const { username } = req.params;

  // Check if the route has the '@' symbol
  if (username.includes('@')) {
    return res.status(404).send('404 Page Not Found');
  }

  // Serve the profile page for the username
  res.sendFile(path.join(__dirname, 'public', 'genie/u/index.html'));
});

app.get('/genie/users/:username', (req, res) => {
  const { username } = req.params;

  if (!username) {
    return res.status(404).send('404 Page Not Found');
  }

  // Fetch user info based on username
  user_db.get(`SELECT id, username, challenges_completed, created_at, profile_pic FROM users WHERE username = ?`, [username], (err, row) => {
    if (err) {
      return res.status(500).json({ error: `database error: ${err.message}` });
    }

    if (!row) {
      return res.status(404).json({ error: 'user not found' });
    }

    // Send back user info
    return res.json({
      id: row.id,
      username: row.username,
      challenges_completed: row.challenges_completed,
      creation: row.created_at,
      profile_pic: row.profile_pic
    });
  });
});

// Init server
app.listen(PORT, () => {
    console.log(`server runnin at port ${PORT} 💻🚀`);
});