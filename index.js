const TelegramBot = require('node-telegram-bot-api');
const TOKEN = '1929663164:AAHJof-svXvEoVStXmR-6XZRyHv17bwLMOU';
const _ = require('lodash');
const fs = require('fs');
const request = require('request');
const cheerio = require('cheerio');
const rp = require('request-promise');
const urlPikabu =
  'https://pikabu.ru/tag/%D0%A7%D0%B5%D1%80%D0%BD%D1%8B%D0%B9%20%D1%8E%D0%BC%D0%BE%D1%80?n=4&r=8';
const schedule = require('node-schedule');
const mysql = require('mysql2');

const connection = mysql.createConnection({
  host: 'localhost',
  user: 'root',
  database: 'test',
  password: 'tbotpass',
});

const bot = new TelegramBot(TOKEN, {
  polling: true,
});

// bot.onText(/qqq/, (msg) => {
//   tryKeyBoard(msg);
// });

bot.on('callback_query', function onCallbackQuery(callbackQuery) {
  const action = callbackQuery.data;
  const msg = callbackQuery.message;
  const opts = {
    chat_id: msg.chat.id,
    message_id: msg.message_id,
  };
  let text;
  console.log(action);
  if (action === 'like') {
    text = 'You hit Like';
  } else {
    text = 'You hit dislike';
  }

  bot.sendMessage(msg.chat.id, text);
});

// function tryKeyBoard(msg) {
//   bot.sendMessage(msg.chat.id, 'text', {
//     reply_markup: {
//       inline_keyboard: [
//         [{ text: 'button 1', callback_data: '1' }],
//         [{ text: '👍', callback_data: '2' }],
//       ],
//     },
//   });
// }

bot.onText(/мем/, (msg) => {
  getFromDB(msg.chat.id, 2);
});

bot.onText(/pars/, (msg) => {
  parsePikabu();
});

const parsePikabu = function parsePikabu() {
  console.log('Start parsing pikabu.ru...');

  countPages();
};

function countPages() {
  const postsCount = 0;

  rp(urlPikabu)
    .then(function (html) {
      console.log(`Counting pages...`);
      $ = cheerio.load(html);
      const postsCount = parseInt(
        $('div.stories-search__feed-panel > span', html).text().split(' ')[0]
      );
      const pages = Math.ceil(postsCount / 10);
      console.log(pages);
      getImages(pages);
    })
    .catch((err) => {
      throw err;
    });
}

async function getImages(pages) {
  //console.log('Downloading files...');

  //  for (j = 1; j <= pages; j++) {
  for (j = 1; j <= 6; j++) {
    await rp(urlPikabu + `&page=${j}`).then((html) => {
      $ = cheerio.load(html);
      const allPictures = $('img.story-image__image', html);
      for (let i = 0; i < 1; i++) {
        if (i <= allPictures.length - 1) {
          const urlPicture = $('img.story-image__image', html)[i].attribs[
            'data-large-image'
          ];
          addToDB(urlPicture);
        }
      }
    });
  }
}

async function addToDB(urlPicture) {
  const sqlCheck = 'SELECT * FROM urls WHERE url = ?';
  const sqlInsert = 'INSERT INTO urls(url) VALUES (?)';
  let alreadyHaveUrl = false;

  alreadyHaveUrl = await makeQuery(sqlCheck, urlPicture);

  if (alreadyHaveUrl == false) {
    connection.query(sqlInsert, [urlPicture], function (err, rows, fields) {
      if (err) throw err;
    });
  }
}

function makeQuery(sqlCheck, urlPicture) {
  return new Promise((resolve, reject) => {
    connection.query(sqlCheck, [urlPicture], function (err, rows, fields) {
      if (err) reject(err);
      resolve(rows.length);
    });
  });
}
function getFromDB(chatId, id) {
  const sqlText =
    'select id, url from urls where id not in (select id_urls from alreadyPosted where id_user = ?) order by rand() limit 1';
  connection.query(sqlText, [chatId], function (err, rows, fields) {
    if (err) throw err;
    if (rows.length) {
      downLoadFile(rows[0].url, rows[0].id, chatId);
    } else {
      bot.sendMessage(chatId, 'Новых мемасиков еще не наклепали');
    }
  });
}
async function downLoadFile(urlPicture, photoId, chatId) {
  var request1 = request.get(
    {
      url: urlPicture,
      encoding: 'binary',
    },
    async (err, response, body) => {
      if (err) throw err;
      // const fileName = `src\/pictures\/${Date.now()}.png`;
      // fs.writeFile(fileName, body, 'binary', (err) => {
      //   if (err) throw err;
      // });
      fileName = await saveFile(body);

      sendPhotoToChat(fileName, photoId, chatId);
    }
  );
}

async function saveFile(body) {
  return new Promise((resolve, reject) => {
    const fileName = `src\/pictures\/${Date.now()}.png`;
    fs.writeFile(fileName, body, 'binary', (err) => {
      if (err) reject(err);
      resolve(fileName);
    });
  });
}
function sendPhotoToChat(fileName, photoId, chatId) {
  fs.readFile(fileName, (err, picture) => {
    if (err) throw err;
    bot.sendPhoto(chatId, picture, {
      reply_markup: {
        inline_keyboard: [
          [
            { text: '👍🏾', callback_data: 'like' },
            { text: '👎🏾', callback_data: 'dislike' },
          ],
        ],
      },
    });
    deleteFile(fileName);
    setToDBAlreadyPosted(chatId, photoId);
  });
}

function setToDBAlreadyPosted(chatId, photoId) {
  //const sqlText = 'INSERT INTO alreadyPosted(id_urls, id_user) VALUES (?,?)';

  const sqlText =
    'INSERT INTO alreadyPosted (id_urls, id_user) SELECT id, ? FROM urls WHERE id = ?';
  connection.query(sqlText, [chatId, photoId], function (err, rows, fields) {
    if (err) throw err;
  });
}

function deleteFile(fileName) {
  fs.unlink(fileName, (err) => {
    if (err) throw err;
  });
}

const job = schedule.scheduleJob('57 * * * *', parsePikabu);

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
