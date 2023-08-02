import { Configuration, OpenAIApi } from "openai";

const OPENAI_API_KEY = "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";

const configuration = new Configuration({
  apiKey: OPENAI_API_KEY,
});
const openai = new OpenAIApi(configuration);

const generateQuery = async ({ channelList }) => {
  let contentString = "";
  channelList.forEach((element) => {
    element.videos.forEach((title) => {
      contentString += title;
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
};
