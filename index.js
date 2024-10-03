import { Telegraf } from "telegraf";
import axios from "axios";
import dotenv from "dotenv";
import stream from "stream"; // Import the stream module
import { promisify } from "util"; // Import util to promisify the pipeline function

dotenv.config();

const bot = new Telegraf(process.env.BOT_TOKEN);
const group = process.env.GROUPS;
const channel = process.env.CHANNEL;
const groups = group.split(",").map(Number);

// Promisify the pipeline method for better error handling
const pipeline = promisify(stream.pipeline);

bot.on("message", async (ctx) => {
  const message = ctx.message.text;
  if (message.startsWith("https://")) {
    const id = message.split("/").pop();
    const api = `${process.env.API_URL}${id}`;

    try {
      const response = await axios.get(api);
      const videoUrl = response.data.response[0].resolutions[`Fast Download`];

      // Fetch the video stream from the URL
      const videoResponse = await axios.get(videoUrl, {
        responseType: "stream",
        maxContentLength: Infinity,
        headers: { "Content-Type": "video/mp4" },
        timeout: 220000,
      });

      // Create a buffer to store the video
      const buffer = [];
      await pipeline(
        videoResponse.data,
        stream.Writable({
          write(chunk, encoding, callback) {
            buffer.push(chunk); // Push each chunk to the buffer
            callback(); // Call the callback to continue
          },
        })
      );

      // Send the buffered video to Telegram
      await ctx.replyWithVideo({
        source: Buffer.concat(buffer), // Concatenate the buffer to create a single Buffer
        filename: "video.mp4",
        timeout: 220000,
      });
      console.log("Video sent successfully!");

      // Send video to the groups
      for (const group of groups) {
        await bot.telegram.sendVideo(group, {
          source: Buffer.concat(buffer),
          filename: "video.mp4",
          timeout: 220000,
        });
        console.log(`Video sent to group ${group}`);
      }

      // Send video to the channel
      await bot.telegram.sendVideo(channel, {
        source: Buffer.concat(buffer),
        filename: "video.mp4",
      });
      console.log("Video sent to channel!");

      // Reply to the user
      await ctx.reply("Message sent to the group and channel!");
    } catch (error) {
      console.error("Error fetching video:", error);
      ctx.reply("Failed to fetch the video.");
    }
  }
});

bot.launch();
