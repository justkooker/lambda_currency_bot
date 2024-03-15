const TelegramBot = require("node-telegram-bot-api");
const axios = require('axios');
const config = require('config');
const TOKEN = config.get("token");
const weatherApiKey = config.get('weatherApiKey');
const baseUrl = `http://api.openweathermap.org/data/2.5/forecast?appid=${weatherApiKey}&units=metric`;
const bot = new TelegramBot(TOKEN, { polling: true });

const cities = [{ btnText: 'Weather forecast in Dnipro', city: 'Dnipro' }];
const frequencies = [
    {
        text: 'Every 3 hours',
        num: 3
    },
    {
        text: 'Every 6 hours',
        num: 6
    }
]
let forecast;
let chosenCity;
let chatContext;
const buttonBack = [{ text: 'Back' }];
const currencyBtn = [{ btnText: 'USD' }, { btnText: 'EUR' }];
let isMono;
let currency = [];
bot.onText(/\/start/, (msg) => {
    makeMainMenu(msg);

});

bot.on('message', async (msg) => {
    const chatId = msg.chat.id;
    const msgText = (msg.text).toLowerCase();
    const weekDays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    const city = cities.find(city => (city.btnText).toLowerCase() === msgText);

    const frequency = frequencies.find(({ text }) => text.toLowerCase() === msgText);


    if (msgText === 'back') {
        if (chatContext?.step === 'mainMenu') {
            makeMainMenu(msg);
        } else if (chatContext?.step === 'cities') {
            makeCitiesMenu();
        } else if (chatContext?.step === 'currencyMenu') {
            makeMainMenu(msg);
        }
    }
    if (msgText === 'weather') {
        makeCitiesMenu();
    }
    if (city) {
        makeFrequencyMenu();
    }
    if (frequency) {
        forecast = await axios(`${baseUrl}&q=${chosenCity}`).then(res => res.data.list).catch(error => console.log(error.code));
        const filteredForecast = forecast.filter(el => +(el.dt_txt.split(' ')[1].split(':')[0]) % frequency.num === 0
            || +(el.dt_txt.split(' ')[1].split(':')[0]) === 0);
        let prevDay;
        let forecastMarkup = filteredForecast.reduce((acc, el) => {
            const date = new Date(el.dt * 1000);
            let isNewDay = true;
            if (prevDay?.getDay() === date.getDay()) {
                isNewDay = false;
            } else {
                isNewDay = true;
            }
            let weekDay = date.getDay();
            let day = date.getDate();
            let month = months[date.getMonth()];
            let time = el.dt_txt.split(' ')[1].split(':').slice(0, 2).join(':');
            let degree = Math.floor(el.main.temp);
            let feels = Math.floor(el.main.feels_like);
            let weather = el.weather[0].main;
            let line = `${isNewDay ? ` \n ${weekDays[weekDay]}, ${day} ${month} \n` : ``} ${time} ${degree}°C, feels like: ${feels}°C, ${weather}\n`;
            prevDay = date;
            return acc + line;
        }, `Weather forecast for 5 days: \n`);
        bot.sendMessage(chatId, forecastMarkup);

    }
    if (msgText === 'currency') {
        makeCurrencyMenu();
    }
    if (msgText === 'usd') {
        let usdCur;
        if (isMono) {
            usdCur = currency.find(el => el.currencyCodeA === 840 && el.currencyCodeB === 980);
        } else {
            usdCur = currency.find(el => el.ccy === 'USD' && el.base_ccy === 'UAH');
        }

        bot.sendMessage(chatId, `USD \n Buy: ${isMono ? usdCur?.rateBuy : usdCur?.buy} UAH    Sell: ${isMono ? usdCur?.rateSell : usdCur?.sale} UAH`);
    }

    if (msgText === 'eur') {
        let eurCur;

        if (isMono) {
            eurCur = currency.find(el => el.currencyCodeA === 978 && el.currencyCodeB === 980);


        } else {
            eurCur = currency.find(el => el.ccy === 'EUR' && el.base_ccy === 'UAH')
        }
        bot.sendMessage(chatId, `EUR \n Buy: ${isMono ? eurCur?.rateBuy : eurCur?.buy} UAH    Sell: ${isMono ? eurCur?.rateSell : eurCur?.sale} UAH`);
    }
    async function makeCurrencyMenu() {
        try {
            currency = await axios('https://api.monobank.ua/bank/currency')
                .then(res => {

                    if (res.status === 200) {
                        isMono = true;
                        return res.data.filter(el => el.currencyCodeA === 840 || el.currencyCodeA === 978);
                    }
                })
        } catch (error) {
            try {
                console.log('Monobank request error:', error.code);
                isMono = false;
                currency = await axios('https://api.privatbank.ua/p24api/pubinfo?json&exchange&coursid=5').then(res => res.data);
            } catch (error) {
                console.log(error);
            }
        }
        const keyboard = {
            reply_markup: {
                keyboard: [currencyBtn.map(({ btnText }) => ({ text: btnText })), buttonBack],
                resize_keyboard: true,
                one_time_keyboard: false,
            },
        };
        bot.sendMessage(chatId, 'Choose currency', keyboard);

        chatContext = { step: 'currencyMenu' }
    }
    function makeCitiesMenu() {
        const keyboard = {
            reply_markup: {
                keyboard: [cities.map(({ btnText }) => ({ text: btnText })), buttonBack],

                resize_keyboard: true,
                one_time_keyboard: false,
            },
        };
        bot.sendMessage(chatId, 'Choose your city', keyboard);
        chatContext = { step: 'mainMenu' }
    }
    function makeFrequencyMenu() {
        chosenCity = city.city;
        const keyboard = {
            reply_markup: {
                keyboard: [frequencies.map(({ text }) => ({ text })), buttonBack],
                resize_keyboard: true,
                one_time_keyboard: false,
            },
        };
        bot.sendMessage(chatId, 'Choose the update frequency:', keyboard);
        chatContext = { step: 'cities' }
    }
})
function makeMainMenu(msg) {
    const chatId = msg.chat.id;
    const message = 'Hi, choose your option';
    chatContext = msg.chat.context || {};
    const keyboard = {
        reply_markup: {
            keyboard:
                [[{ text: 'weather' }, { text: 'currency' }]],
            resize_keyboard: true,
            one_time_keyboard: false,
        },
    };
    bot.sendMessage(chatId, message, keyboard);
}