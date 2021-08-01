const TelegramBot = require('node-telegram-bot-api');
const TOKEN = '1929663164:AAHJof-svXvEoVStXmR-6XZRyHv17bwLMOU';
const _ = require('lodash');
const fs = require('fs');
const http = require('http');
const request = require('request');
const cheerio = require('cheerio');
const rp = require('request-promise');
const XMLHttpRequest = require('xmlhttprequest').XMLHttpRequest;
const tress = require('tress');
const urlPikabu =
  'https://pikabu.ru/tag/%D0%A7%D0%B5%D1%80%D0%BD%D1%8B%D0%B9%20%D1%8E%D0%BC%D0%BE%D1%80?n=4&r=8';
//'https://pikabu.ru/tag/%D0%9F%D0%B0%D1%80%D0%B0%D0%BC%D1%83%D1%88%D0%B8%D1%80?n=4';

const bot = new TelegramBot(TOKEN, {
  polling: true,
});

const KB = {
  curency: 'Курс валюты',
  picture: 'Картинка',
  cat: 'Котик',
  car: 'Машина',
  back: 'Назад',
};

const PicScrs = {
  [KB.cat]: ['cat1.jpg', 'cat2.jpg', 'cat3.jpg'],
  [KB.car]: ['car1.jpg', 'car2.jpg', 'car3.jpg'],
};

bot.onText(/\/start/, (msg) => {
  sendGreeting(msg);
});

bot.on('message', (msg) => {
  switch (msg.text) {
    case KB.picture:
      parsePikabu(msg.chat.id);
      //sendPictureScreen(msg.chat.id);
      break;
    case KB.curency:
      sendCurrenceScreen(msg.chat.id);
      break;
    case KB.back:
      sendGreeting(msg, false);
      break;
    case KB.car:
    case KB.cat:
      // sendPictureByName(msg.chat.id, msg.text);
      break;
  }
});

bot.on('callback_query', (query) => {
  const base = query.data;
  const symbol = 'RUB';
  console.log('sdsdsd2323');
  request(
    `http://api.fixer.io/latest?symbols=${symbol}&base=${base}`,
    (error, response, body) => {
      if (error) {
        throw error;
      }
      if (response.statusCode === 200) {
        const currencyData = JSON.parse(body);
        console.log(currencyData);
      }
    }
  );
});

function sendPictureScreen(chatId) {
  bot.sendMessage(chatId, 'Выберите тип картинки', {
    reply_markup: {
      keyboard: [[KB.cat, KB.car], [KB.back]],
    },
  });
}

function sendGreeting(msg, sayHello = true) {
  const text = sayHello
    ? `Приветствую, ${msg.from.first_name}\nЧто вы хотите сделать?`
    : 'Что вы хотите сделать?';
  bot.sendMessage(msg.chat.id, text, {
    reply_markup: {
      keyboard: [[KB.curency, KB.picture]],
    },
  });
}

function sendPictureByName(chatId, picName) {
  const srcs = PicScrs[picName];
  const src = srcs[_.random(0, srcs.length - 1)];
  bot.sendMessage(chatId, `Загружаю...`);
  fs.readFile(`${__dirname}/pictures/${src}`, (error, picture) => {
    if (error) {
      throw error;
    }
    bot.sendPhoto(chatId, picture).then(() => {
      bot.sendMessage(chatId, `Отправлено`);
    });
  });
}

function sendCurrenceScreen(chatId) {
  bot.sendMessage(chatId, `Выберите тип валюты:`, {
    reply_markup: {
      inline_keyboard: [
        [
          {
            text: 'Доллар',
            callback_data: 'USD',
          },
        ],
        [
          {
            text: 'Евро',
            callback_data: 'EUR',
          },
        ],
      ],
    },
  });
}

function parsePikabu(chatId) {
  console.log('Start parsing pikabu.ru...');

  countPages();
}

function countPages() {
  const postsCount = 0;

  rp(urlPikabu)
    .then(function (html) {
      console.log(`Counting pages...`);
      $ = cheerio.load(html);
      const postsCount = parseInt(
        $('div.stories-search__feed-panel > span', html).text().split(' ')[0]
      );
      //console.log('sdsd', postsCount);
      const pages = Math.ceil(postsCount / 10);
      getImages(pages);
    })
    .catch(function (err) {
      throw err;
      _;
    });
}

function getImages(pages) {
  console.log('Downloading files...');

  for (j = 1; j <= 1; j++) {
    const q = tress(function (url, callback) {
      //тут мы обрабатываем страницу с адресом url
      needle.get(url, function (err, res) {
        if (err) throw err;

        // здесь делаем парсинг страницы из res.body
        // делаем results.push для данных о новости
        // делаем q.push для ссылок на обработку

        callback(); //вызываем callback в конце
      });
    });

    // эта функция выполнится, когда в очереди закончатся ссылки
    q.drain = function () {
      require('fs').writeFileSync(
        './data.json',
        JSON.stringify(results, null, 4)
      );
    };

    // добавляем в очередь ссылку на первую страницу списка
    q.push(URL);

    //console.log('=================================================/nj=', j);
    //console.log(rp(urlPikabu + `&page=${j}`));
    /* ORIGIN
    rp(urlPikabu + `&page=${j}`).then((html) => {
      console.log('***********');
      $ = cheerio.load(html);
      for (let i = 0; i < 2; i++) {
        // bot.sendMessage(
        //   chatId,
        //   $('img.story-image__image', html)[i].attribs['data-large-image']
        // );
        const urlPicture = $('img.story-image__image', html)[i].attribs[
          'data-large-image'
        ];
        console.log(urlPicture);
        //console.log(urlPikabu + `&page=${j}`);
        downLoadFile(urlPicture);
      }
    });
    END ORIGIN*/

    /*START ORIGIN 2
    let xhr = new XMLHttpRequest();
    xhr.open('GET', urlPikabu + `&page=${j}`);
    xhr.send();

    xhr.onreadystatechange = function () {
      if (xhr.readyState != 4) {
        return;
      }
      if (xhr.status != 200) {
        console.error(`Ошибка ${xhr.status}: ${xhr.statusText}`);
      } else {
        console.log(urlPikabu + `&page=${j}`);
        $ = cheerio.load(xhr.responseText);
        for (let i = 0; i < 2; i++) {
          const urlPicture = $('img.story-image__image', xhr.responseText)[i]
            .attribs['data-large-image'];
          console.log(urlPicture);
          downLoadFile(urlPicture);
        }
      }
    };

    xhr.onprogress = function (event) {
      console.log('onProgress');
      if (event.lengthComputable) {
        console.info(`Получено ${event.loaded} из ${event.total} байт`);
      } else {
        console.info(`Получено ${event.loaded} байт`); // если в ответе нет заголовка Content-Length
      }
    };

    xhr.onerror = function () {
      console.log('onError');
      console.info('Запрос не удался');
    };
    END ORIGIN 2*/
  }
}

function downLoadFile(urlPicture) {
  var request1 = request.get(
    {
      url: urlPicture,
      encoding: 'binary',
    },
    (err, response, body) => {
      if (err) return console.log('Ошибка', err);
      fs.writeFile(
        `src\/pictures\/${Date.now()}.png`,
        body,
        'binary',
        (err) => {
          if (err) return console.log('Ошибка2', err);
        }
      );
    }
  );
}
