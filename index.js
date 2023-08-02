const { PrismaClient } = require("@prisma/client");
const puppeteer = require("puppeteer");
const { Configuration, OpenAIApi } = require("openai");

const OPENAI_API_KEY = "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";

const configuration = new Configuration({
  apiKey: OPENAI_API_KEY,
});
const openai = new OpenAIApi(configuration);

const prismadb = new PrismaClient();

var runningJob = false;

async function generateQuery({ channelList }) {
  let contentString = "";
  channelList.forEach((element) => {
    element.videos.forEach((title) => {
      contentString += title + "\n";
    });
  });

  const completion = await openai.createChatCompletion({
    model: "gpt-3.5-turbo",
    messages: [
      {
        role: "system",
        content:
          "You are a reverse search engine. Respond only with a query between 50 and 100 characters that would likely result in all of the given videos being found in a single search.",
      },
      {
        role: "user",
        content: contentString,
      },
    ],
  });
  console.log(completion.data);
  console.log(completion.data.choices[0].message);

  return completion.data.choices[0].message;
}

async function getSearchResultChannels({ searchQuery }) {
  const browser = await puppeteer.launch({
    headless: false,
    defaultViewport: null,
  });

  // Open a new page
  const page = await browser.newPage();

  console.log("https://youtube.com/results?search_query=" + searchQuery);

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
}

async function getChannelVideos({ channelLink }) {
  const browser = await puppeteer.launch({
    headless: "new",
    defaultViewport: null,
  });

  // Open a new page
  const page = await browser.newPage();

  console.log(channelLink + "/videos");

  await page.goto(channelLink + "/videos", {
    waitUntil: "domcontentloaded",
  });

  const videos = await page.$x('//*[@id="video-title"]');

  const video_titles = [];

  for (let i = 0; i < 5; i++) {
    video_titles.push(await page.evaluate((el) => el.textContent, videos[i]));
  }

  await browser.close();

  console.log(video_titles);

  return video_titles;
}

async function getMultipleChannelsVideos({ channels }) {
  const promises = channels.map((element) => {
    return getChannelVideos({ channelLink: element.link })
      .then((video_titles) => {
        element.videos = video_titles;
        console.log("Item Processed!");
        return element;
      })
      .catch((error) => {
        console.error("Error processing item:", error);
        return null; // Optionally handle errors by returning a default value or null.
      });
  });

  try {
    const processedChannels = await Promise.all(promises);
    console.log("***--- DONE ---***");
    console.log(processedChannels);
    return processedChannels;
  } catch (error) {
    console.error("An error occurred while processing channels:", error);
    throw error;
  }
}

async function getSimilarChannels({ channels, nextJob }) {
  await prismadb.job.update({
    where: {
      id: nextJob.id,
      status: "Starting",
      userId: nextJob.userId,
    },
    data: {
      status: "Scraping",
    },
  });

  console.log("getMultipleChannelVideos");
  const populatedChannels = await getMultipleChannelsVideos({
    channels: channels,
  });

  console.log("generateQuery");
  const query = await generateQuery({ channelList: populatedChannels });

  console.log("update db");
  await prismadb.job.update({
    where: {
      id: nextJob.id,
      status: "Scraping",
      userId: nextJob.userId,
    },
    data: {
      status: "Generating",
    },
  });

  console.log("getSearchResultChannels");
  const results = await getSearchResultChannels({ searchQuery: query.content });

  console.log(results);

  console.log("Storing Results");
  const jobResults = await prismadb.jobResults.create({
    data: {
      jobId: nextJob.id,
      channel1: results[0],
      channel2: results[1],
      channel3: results[2],
      channel4: results[3],
      channel5: results[4],
      userId: nextJob.userId,
    },
  });

  console.log("update db");
  await prismadb.job.update({
    where: {
      id: nextJob.id,
      status: "Generating",
      userId: nextJob.userId,
    },
    data: {
      status: "Complete",
    },
  });

  runningJob = false;
}

async function getNextJob() {
  const jobs = await prismadb.job.findMany({
    where: {
      status: "Queued",
    },
  });

  if (!jobs) {
    return null;
  }

  jobs.sort((a, b) => {
    return a.createdAt - b.createdAt;
  });

  console.log(jobs);

  return jobs[0];
}

async function checkJobs() {
  if (runningJob) return;

  const nextJob = await getNextJob();

  if (!nextJob) return;

  runningJob = true;

  await prismadb.job.update({
    where: {
      id: nextJob.id,
      status: nextJob.status,
      userId: nextJob.userId,
    },
    data: {
      status: "Starting",
    },
  });

  channels = [
    {
      link: nextJob.channel1,
      videos: [],
    },
    {
      link: nextJob.channel2,
      videos: [],
    },
    {
      link: nextJob.channel3,
      videos: [],
    },
    {
      link: nextJob.channel4,
      videos: [],
    },
    {
      link: nextJob.channel5,
      videos: [],
    },
  ];

  getSimilarChannels({ channels, nextJob });
}

setInterval(checkJobs, 1000);
