const { Telegraf } = require('telegraf');
const axios = require('axios');
const { createClient } = require('@supabase/supabase-js');
const express = require('express');

// 1. CONFIG - KEYS DYAWLK
const BOT_TOKEN = process.env.BOT_TOKEN;
const GROQ_API_KEY = process.env.GROQ_API_KEY;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;

const bot = new Telegraf(BOT_TOKEN);
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// 2. EXPRESS SERVER BACH RENDER YFR7
const app = express();
const PORT = process.env.PORT || 3000;
app.get('/', (req, res) => res.send('TikiTbib Bot is running!'));
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

// 3. MESSAGES
const MSG_WELCOME = `Salam 👋 Ana TikiTbib!
Siftli lien ta3 video makla mn TikTok wla Instagram, n3tik Recette S7i7a 🥗
3ndk 3 free / nhar. Bghiti illimité? /premium`;

const MSG_LIMIT = `Kmlt 3 free dyal lyum 😅
Premium = 500da / chhar brk → /premium`;

const MSG_PREMIUM = `🔥 TikiTbib Premium - 500da / chhar
✅ Recettes illimité
✅ Calories + Macros + Alternative s7i7a

Khlss f CCP: 123456789 CLÉ 12 Wail Benali
Ba3d ma tkhlss, sift screenshot hna. Nactivik f 5 min.`;

// 4. LOGIC TA3 LIMIT
async function checkLimit(userId) {
  const today = new Date().toISOString().split('T')[0];
  let { data: user } = await supabase.from('users').select('*').eq('id', userId).single();

  if (!user) {
    await supabase.from('users').insert({ id: userId, count: 0, last_date: today });
    return true;
  }

  if (user.premium) return true;

  if (user.last_date!== today) {
    await supabase.from('users').update({ count: 0, last_date: today }).eq('id', userId);
    return true;
  }

  return user.count < 3;
}

// 5. COMMANDS
bot.start((ctx) => ctx.reply(MSG_WELCOME));
bot.command('premium', (ctx) => ctx.reply(MSG_PREMIUM));

// 6. VIDEO HANDLER
bot.on('text', async (ctx) => {
  const url = ctx.message.text;
  const userId = ctx.from.id;

  if (!url.includes('tiktok.com') &&!url.includes('instagram.com')) {
    return ctx.reply('Siftli lien ta3 TikTok wla Instagram brk 🙏');
  }

  const canUse = await checkLimit(userId);
  if (!canUse) return ctx.reply(MSG_LIMIT);

  ctx.reply('Sana n7dr lik recette... 10s ⏳');

  try {
    const groqRes = await axios.post('https://api.groq.com/openai/v1/chat/completions', {
      model: 'llama-3.1-8b-instant',
      messages: [{
        role: 'user',
        content: `Hada lien ta3 video makla: ${url}. Mdli recette s7i7a b darja dziriya. 1. Ingrédients 2. Tariqa 3. Calories. Ghir 1000 DA l'ingrédients.`
      }]
    }, {
      headers: { 'Authorization': `Bearer ${GROQ_API_KEY}` }
    });

    const recette = groqRes.data.choices[0].message.content;
    await ctx.reply(recette);
    await supabase.rpc('increment', { row_id: userId });

  } catch (e) {
    ctx.reply('Video s3iba chwiya 😅 Jrb wa7da khra.');
  }
});

// 7. RUN
bot.launch();
console.log('Bot khdam...');

// 8. SUPABASE SQL - EXÉCUTÉ HADA MRA WA7DA
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
