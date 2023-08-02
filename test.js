const puppeteer = require("puppeteer");

const getSearchResultChannels = async ({ searchQuery }) => {
  const browser = await puppeteer.launch({
    headless: false,
    defaultViewport: null,
  });

  // Open a new page
  const page = await browser.newPage();

  await page.goto("https://youtube.com/results?search_query=" + searchQuery, {
    waitUntil: "domcontentloaded",
  });

  const channelNameObjs = await page.$x('//*[@id="text"]/a');

  const channelNames = [];

  let i = 1;

  while (channelNames.length < 5) {
    nextChannel = await page.evaluate((el) => el.href, channelNameObjs[i]);
    if (!channelNames.find((element) => element == nextChannel)) {
      channelNames.push(nextChannel);
      console.log("Found channel!");
    }
    i++;
  }

  await browser.close();

  console.log(channelNames);

  return channelNames;
};

getSearchResultChannels({
  searchQuery:
    "DIY electronic projects and hacks: Gameboy Camera, RC car, Drone controller, Serial Communication, USB charger, Inverter, 3D Printer",
});
