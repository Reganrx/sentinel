import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import OpenAI from "openai";

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Health check
app.get("/", (req, res) => {
  res.send("🛡 Sentinel AI Server Online");
});

// Chat endpoint
app.post("/chat", async (req, res) => {
  try {
    console.log("Incoming request:", req.body);

    const { message } = req.body;

    if (!message) {
      return res.status(400).json({
        reply: "No message supplied."
      });
    }

    const response = await client.responses.create({
      model: "gpt-5.5",
      input: message
    });

    console.log("OpenAI replied successfully.");

    res.json({
      reply: response.output_text
    });

  } catch (error) {

    console.error("OpenAI Error:");
    console.error(error);

    res.status(500).json({
      reply: "Sentinel encountered an error."
    });

  }
});

const PORT = process.env.PORT || 3001;

app.listen(PORT, () => {
  console.log("");
  console.log("=====================================");
  console.log("🛡 SENTINEL AI SERVER RUNNING");
  console.log(`🌐 http://localhost:${PORT}`);
  console.log("=====================================");
  console.log("");
});