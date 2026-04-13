const { Telegraf } = require('telegraf');
const axios = require('axios');
const { createClient } = require('@supabase/supabase-js');

// 1. CONFIG - BDL HAD L’VALUES
const BOT_TOKEN = '8395509532:AAF07WSkCDxrf4_r1y7oxvoWMciE54bep1g';
const GROQ_API_KEY = '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';
const SUPABASE_URL = 'https://ahjxmqcokxnqtzkcljri.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFoanhtcWNva3hucXR6a2NsanJpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYwMjUwMTYsImV4cCI6MjA5MTYwMTAxNn0.szaq4Yd6EtI4OEsqdomNHR9MC1klsFI8TSlykLSZpM8';
const DAILY_FREE_LIMIT = 3; // 3 recettes fabor par nhar

const bot = new Telegraf(BOT_TOKEN);
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// 2. L’PROMPT LI YKHDEM MZN - HADA HWA SIRR
const RECIPE_PROMPT = `
Nta chef DZ professionnel. 3tik transcript wla caption dyal video TikTok.
Khrej liya JSON SEULEMENT, bla commentaire. Format:
{
  "title": "Smiya dyal recette b Darija",
  "ingredients": [{"name": "smiya", "qty": "1", "unit": "kas"}],
  "steps": ["1. dir...", "2. zid..."],
  "time": "30 min",
  "servings": "4 nnas",
  "notes": "nassi7a sghera"
}
Qawa3id:
1. Ila ma kaynach quantité, deviner b estimation ta3 chef DZ.
2. Bdl "cup" l "kas", "tablespoon" l "m3il9a kbira", "teaspoon" l "m3il9a sghira".
3. Ila video ma fihach makla, rad {"error": "Hadi machi recette"}
Text: `;

// 3. FUNCTIONS
async function getTikTokCaption(url) {
  try {
    // Nsta3ml api gratuit bach njbd caption
    const apiUrl = `https://www.tikwm.com/api/?url=${url}`;
    const res = await axios.get(apiUrl);
    return res.data.data.title + " " + res.data.data.desc;
  } catch (e) {
    return null;
  }
}

async function askGroq(text) {
  const res = await axios.post('https://api.groq.com/openai/v1/chat/completions', {
    model: "llama-3.1-70b-versatile",
    messages: [{ role: "user", content: RECIPE_PROMPT + text }],
    temperature: 0.2,
    response_format: { type: "json_object" }
  }, {
    headers: { 'Authorization': `Bearer ${GROQ_API_KEY}` }
  });
  return JSON.parse(res.data.choices[0].message.content);
}

async function checkUserLimit(userId) {
  const today = new Date().toISOString().split('T')[0];
  let { data } = await supabase.from('users').select().eq('id', userId).single();

  if (!data) {
    await supabase.from('users').insert({ id: userId, count: 0, last_date: today, premium: false });
    return { allowed: true, left: DAILY_FREE_LIMIT };
  }

  if (data.premium) return { allowed: true, left: 999 };

  if (data.last_date!== today) {
    await supabase.from('users').update({ count: 0, last_date: today }).eq('id', userId);
    data.count = 0;
  }

  if (data.count >= DAILY_FREE_LIMIT) return { allowed: false, left: 0 };

  return { allowed: true, left: DAILY_FREE_LIMIT - data.count };
}

async function incrementCount(userId) {
  await supabase.rpc('increment', { row_id: userId });
}

// 4. BOT LOGIC
bot.start((ctx) => {
  ctx.reply(`Salam ${ctx.from.first_name} 👋\nAna TikiTbib. Sift liya lien TikTok dyal ay makla o nradha lik recette maktouba b Darija.\n\n3ndk ${DAILY_FREE_LIMIT} recettes fabor kol nhar.\n\nBach twlli illimité: /premium`);
});

bot.command('premium', (ctx) => {
  ctx.reply(`Premium = 1000 DA/chhar\n1. Khlls f CCP: 12345678 Clé 90\n2. Sift screenshot ta3 reçu hna\n3. Nactivé lik f 5 min\n\nWla khlls b BaridiMob m3a Chargily: https://pay.chargily.com/test`);
});

bot.on('text', async (ctx) => {
  const url = ctx.message.text;
  const userId = ctx.from.id;

  if (!url.includes('tiktok.com')) return ctx.reply('Sift liya ghi lien TikTok s7i7');

  const limit = await checkUserLimit(userId);
  if (!limit.allowed) return ctx.reply(`Kmmlt l’gratuits dyal lyoum 😢\nDir /premium bach twlli illimité b 1000 DA/chhar`);

  const msg = await ctx.reply('Sana chwiya... nkhdem lik f recette 🍳');

  try {
    const caption = await getTikTokCaption(url);
    if (!caption) throw 'Ma 9drtch njbd video';

    const recipe = await askGroq(caption);
    if (recipe.error) throw recipe.error;

    await incrementCount(userId);

    let text = `**${recipe.title}** 👨‍🍳\n\n**L’ingrédients:**\n`;
    recipe.ingredients.forEach(i => text += `- ${i.qty} ${i.unit} ${i.name}\n`);
    text += `\n**Tariqa:**\n`;
    recipe.steps.forEach((s, idx) => text += `${s}\n`);
    text += `\n⏱️ ${recipe.time} | 🍽️ ${recipe.servings}\n`;
    text += `\n_Nassi7a: ${recipe.notes}_\n\nB9a lik ${limit.left - 1} fabor lyoum`;

    ctx.deleteMessage(msg.message_id);
    ctx.reply(text, { parse_mode: 'Markdown' });

  } catch (e) {
    ctx.deleteMessage(msg.message_id);
    ctx.reply('Sam7ni, ma 9drtch nfhm had video 😔 Jrb video akhra fiha makla w caption wad7');
  }
});

// 5. RUN
bot.launch();
console.log('Bot khdam...');

// 6. SUPABASE SQL - EXÉCUTÉ HADA MRA WA7DA
/*
create table users (
  id bigint primary key,
  count int default 0,
  last_date text,
  premium boolean default false
);

create or replace function increment(row_id bigint)
returns void as $$
  update users set count = count + 1 where id = row_id;
$$ language sql volatile;
*/
