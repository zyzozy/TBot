const TelegramBot = require('node-telegram-bot-api');
const cheerio = require('cheerio');
const rp = require('request-promise');
const schedule = require('node-schedule');
const mysql = require('mysql2');
require('dotenv').config();

const TOKEN = process.env.BOT_TOKEN;
let numberOfAttempts = 0;

console.log(process.env.DB_USER);
const connection = mysql.createConnection({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  database: process.env.DB_BASE,
  password: process.env.DB_PASSWORD,
});

const bot = new TelegramBot(TOKEN, {
  polling: true,
});

bot.on('message', (msg) => {
  switch (true) {
    case msg.text.toLowerCase().includes('бро') &&
      msg.text.toLowerCase().includes('мем'):
      getFromDB(msg.chat.id);
      break;
    case msg.text === 'pars':
      parsePikabu();
      break;
    case msg.text.includes('%') && msg.text.toLowerCase().includes('мем'):
      let tags = createTagList(msg.text);
      getRandomMemByTag(tags, msg.chat.id);
      break;
  }
});

bot.on('callback_query', async function onCallbackQuery(callbackQuery) {
  const action = callbackQuery.data;
  const msg = callbackQuery.message;
  const user = callbackQuery.from;
  const mass = action.split(' ');

  //console.log(callbackQuery);
  if (mass[0] === 'like') {
    await checkUrlInLikeRates(mass[1], user.id, 1, msg.message_id, msg.chat.id);
  } else {
    await checkUrlInLikeRates(
      mass[1],
      user.id,
      -1,
      msg.message_id,
      msg.chat.id
    );
  }
  if (msg.chat.type == 'private') {
    getFromDB(msg.chat.id);
  }
});

async function changeRateInCaption(msgId, chatId, photoId) {
  let ratePhoto = await makeQueryAllLikes([photoId]);

  bot.editMessageCaption(`🤍 ${ratePhoto}`, {
    chat_id: chatId,
    message_id: msgId,
    reply_markup: {
      inline_keyboard: [
        [
          { text: '👍🏾', callback_data: `like ${photoId}` },
          { text: '👎🏾', callback_data: `dislike ${photoId}` },
        ],
      ],
    },
  });
}

function createTagList(textTags) {
  let newMassTags = [];
  let tagSubstr = textTags.substring(textTags.indexOf('%') + 1);

  massTags = tagSubstr.split(',');
  massTags.forEach((element) => {
    newMassTags.push(element.trim());
  });

  return newMassTags.join(',');
}

async function getRandomMemByTag(tags, chatId) {
  numberOfAttempts++;
  let url = encodeURI(`https://pikabu.ru/tag/мемы,${tags}?n=4&r=7`);
  let numberOfPages = await countPagesOnSite(url);
  let urlRandomPicture = await getRandomImageFromSite(numberOfPages, url);
  if (urlRandomPicture !== '') {
    let insertId = await addToDB(urlRandomPicture);
    if (insertId) {
      sendPhotoToChat(urlRandomPicture, insertId, chatId);
    } else {
      if (numberOfAttempts < 10) {
        getRandomMemByTag(tags, chatId);
      } else {
        bot.sendMessage(chatId, 'Пока ничего новенького, бро!');
      }
    }
  } else {
    bot.sendMessage(
      chatId,
      'Бро, ты либо сформулируй нормально, либо придумывай такие мемы сам!'
    );
  }
}

async function getRandomImageFromSite(numberOfPages, url) {
  randomPage = Math.floor(Math.random() * numberOfPages);
  let randomUrl = '';
  return await rp(url + `&page=${randomPage}`).then((html) => {
    $ = cheerio.load(html);
    const allPictures = $('img.story-image__image', html);
    if (allPictures.length) {
      randomImage = Math.floor(Math.random() * allPictures.length);
      randomUrl = $('img.story-image__image', html)[randomImage].attribs[
        'data-large-image'
      ];
    }
    return randomUrl;
  });
}

async function countPagesOnSite(url) {
  return await rp(url)
    .then(function (html) {
      $ = cheerio.load(html);
      const postsCount = parseInt(
        $('div.stories-search__feed-panel > span', html).text().split(' ')[0]
      );
      return Math.ceil(postsCount / 10);
    })
    .catch((err) => {
      throw err;
    });
}

async function checkUrlInLikeRates(photoId, userId, rate, messageId, chatId) {
  const sqlCheck = 'select * from likeRates where id_user = ? and id_urls = ?';
  const sqlInsert =
    'INSERT INTO likeRates(id_user, id_urls, rate) VALUES (?, ?, ?)';
  let alreadyHaveUrl = false;

  alreadyHaveUrl = await makeQueryCheck(sqlCheck, [userId, photoId]);
  if (alreadyHaveUrl == false) {
    connection.query(sqlInsert, [userId, photoId, rate], (err) => {
      if (err) throw err;
      changeRateInCaption(messageId, chatId, photoId);
    });
  }
}

const parsePikabu = async function parsePikabu() {
  console.log('Start parsing pikabu.ru...');
  const urlPikabu =
    'https://pikabu.ru/tag/%D0%A7%D0%B5%D1%80%D0%BD%D1%8B%D0%B9%20%D1%8E%D0%BC%D0%BE%D1%80/best?n=4&r=7';
  let numberOfPages = await countPagesOnSite(urlPikabu);
  await getAllImagesFromSite(numberOfPages, urlPikabu);
  console.log('End parsing pikabu.ru!');
};

async function getAllImagesFromSite(pages, url) {
  //console.log('Downloading files...');
  console.log('Number of pages: ', pages);
  let counter = 0;
  for (j = 1; j <= pages; j++) {
    console.log('Page ', j);
    await rp(url + `&page=${j}`).then(async (html) => {
      $ = cheerio.load(html);
      const allPictures = $('img.story-image__image', html);
      for (let i = 0; i < allPictures.length - 1; i++) {
        const urlPicture = $('img.story-image__image', html)[i].attribs[
          'data-large-image'
        ];
        insertId = await addToDB(urlPicture);
        if (insertId) {
          counter++;
        }
      }
    });
  }
  console.log(`Added ${counter} images`);
}

async function addToDB(urlPicture) {
  const sqlCheck = 'SELECT * FROM urls WHERE url = ?';
  const sqlInsert = 'INSERT INTO urls(url) VALUES (?)';
  let alreadyHaveUrl = false;
  let insertId = 0;
  alreadyHaveUrl = await makeQueryCheck(sqlCheck, [urlPicture]);
  if (alreadyHaveUrl == false) {
    insertId = await makeQueryInsert(sqlInsert, [urlPicture]);
  }
  return insertId;
}

function makeQueryInsert(sqlText, params) {
  return new Promise((resolve) => {
    connection.query(sqlText, params, function (err, result) {
      if (err) throw err;
      resolve(result.insertId);
    });
  });
}

function makeQueryCheck(sqlCheck, params) {
  return new Promise((resolve, reject) => {
    connection.query(sqlCheck, params, function (err, rows) {
      if (err) reject(err);
      resolve(rows.length);
    });
  });
}

function makeQueryAllLikes(params) {
  return new Promise((resolve, reject) => {
    const sqlText =
      'select ifnull(sum(rate),0) as sumLike from likerates where id_urls = ?';
    connection.query(sqlText, params, function (err, rows) {
      let allLikes = 0;
      if (err) reject(err);
      if (rows.length) {
        allLikes = rows[0].sumLike;
      }
      resolve(allLikes);
    });
  });
}

function getFromDB(chatId) {
  const sqlText =
    'select u.id, u.url, ifnull(r.rate,0) from urls u left join (select id_urls, sum(rate) as rate from likerates group by(id_urls)) r on u.id = r.id_urls where id not in (select id_urls from alreadyPosted where id_user = ?) order by ifnull(r.rate,0) desc, rand() limit 1;';
  connection.query(sqlText, [chatId], function (err, rows) {
    if (err) throw err;
    if (rows.length) {
      sendPhotoToChat(rows[0].url, rows[0].id, chatId);
      //downLoadFile(rows[0].url, rows[0].id, chatId);
    } else {
      bot.sendMessage(chatId, 'Новых мемасиков еще не наклепали');
    }
  });
}

async function sendPhotoToChat(URLPhoto, photoId, chatId) {
  let ratePhoto = await makeQueryAllLikes([photoId]);
  bot.sendPhoto(chatId, URLPhoto, {
    caption: `🤍 ${ratePhoto}`,
    reply_markup: {
      inline_keyboard: [
        [
          { text: '👍🏾', callback_data: `like ${photoId}` },
          { text: '👎🏾', callback_data: `dislike ${photoId}` },
        ],
      ],
    },
  });
  numberOfAttempts = 0;
  setToDBAlreadyPosted(chatId, photoId);
}

function setToDBAlreadyPosted(chatId, photoId) {
  const sqlText =
    'INSERT INTO alreadyPosted (id_urls, id_user) SELECT id, ? FROM urls WHERE id = ?';
  connection.query(sqlText, [chatId, photoId], (err) => {
    if (err) throw err;
  });
}

const job = schedule.scheduleJob('57 * * * *', parsePikabu);

// function countPages() {
//   const postsCount = 0;

//   rp(urlPikabu)
//     .then(function (html) {
//       console.log(`Counting pages...`);
//       $ = cheerio.load(html);
//       const postsCount = parseInt(
//         $('div.stories-search__feed-panel > span', html).text().split(' ')[0]
//       );
//       const pages = Math.ceil(postsCount / 10);
//       getAllImagesFromSite(pages);
//     })
//     .catch((err) => {
//       throw err;
//     });
// }

// async function downLoadFile(urlPicture, photoId, chatId) {
//   var request1 = request.get(
//     {
//       url: urlPicture,
//       encoding: 'binary',
//     },
//     async (err, response, body) => {
//       if (err) throw err;
//       // const fileName = `src\/pictures\/${Date.now()}.png`;
//       // fs.writeFile(fileName, body, 'binary', (err) => {
//       //   if (err) throw err;
//       // });
//       fileName = await saveFile(body);

//       sendPhotoToChat(urlPicture, photoId, chatId);
//     }
//   );
// }

// async function saveFile(body) {
//   return new Promise((resolve, reject) => {
//     const fileName = `src\/pictures\/${Date.now()}.png`;
//     fs.writeFile(fileName, body, 'binary', (err) => {
//       if (err) reject(err);
//       resolve(fileName);
//     });
//   });
// }

// function deleteFile(fileName) {
//   fs.unlink(fileName, (err) => {
//     if (err) throw err;
//   });
// }

//----------------------------------
// bot.on('message', (msg) => {
//   switch (msg.text) {
//     case KB.picture:
//       // parsePikabu(msg.chat.id);
//       //sendPictureScreen(msg.chat.id);
//       break;
//     case KB.curency:
//       sendCurrenceScreen(msg.chat.id);
//       break;
//     case KB.back:
//       sendGreeting(msg, false);
//       break;
//     case 'картинка':
//       getFromDB(2);
//       break;
//     case KB.car:
//     case KB.cat:
//       // sendPictureByName(msg.chat.id, msg.text);
//       break;
//   }
// });

// bot.on('callback_query', (query) => {
//   const base = query.data;
//   const symbol = 'RUB';
//   console.log('sdsdsd2323');
//   request(
//     `http://api.fixer.io/latest?symbols=${symbol}&base=${base}`,
//     (error, response, body) => {
//       if (error) {
//         throw error;
//       }
//       if (response.statusCode === 200) {
//         const currencyData = JSON.parse(body);
//         console.log(currencyData);
//       }
//     }
//   );
// });

// function sendPictureScreen(chatId) {
//   bot.sendMessage(chatId, 'Выберите тип картинки', {
//     reply_markup: {
//       keyboard: [[KB.cat, KB.car], [KB.back]],
//     },
//   });
// }

// function sendGreeting(msg, sayHello = true) {
//   const text = sayHello
//     ? `Приветствую, ${msg.from.first_name}\nЧто вы хотите сделать?`
//     : 'Что вы хотите сделать?';
//   bot.sendMessage(msg.chat.id, text, {
//     reply_markup: {
//       keyboard: [[KB.curency, KB.picture]],
//     },
//   });
// }

// function sendPictureByName(chatId, picName) {
//   const srcs = PicScrs[picName];
//   const src = srcs[_.random(0, srcs.length - 1)];
//   bot.sendMessage(chatId, `Загружаю...`);
//   fs.readFile(`${__dirname}/pictures/${src}`, (error, picture) => {
//     if (error) {
//       throw error;
//     }
//     bot.sendPhoto(chatId, picture).then(() => {
//       bot.sendMessage(chatId, `Отправлено`);
//     });
//   });
// }

// function sendCurrenceScreen(chatId) {
//   bot.sendMessage(chatId, `Выберите тип валюты:`, {
//     reply_markup: {
//       inline_keyboard: [
//         [
//           {
//             text: 'Доллар',
//             callback_data: 'USD',
//           },
//         ],
//         [
//           {
//             text: 'Евро',
//             callback_data: 'EUR',
//           },
//         ],
//       ],
//     },
//   });
// }

// const KB = {
//   curency: 'Курс валюты',
//   picture: 'Картинка',
//   cat: 'Котик',
//   car: 'Машина',
//   back: 'Назад',
// };

// const PicScrs = {
//   [KB.cat]: ['cat1.jpg', 'cat2.jpg', 'cat3.jpg'],
//   [KB.car]: ['car1.jpg', 'car2.jpg', 'car3.jpg'],
// };
