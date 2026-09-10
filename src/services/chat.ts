export async function sendMessage(message: string): Promise<string> {
  try {
    const response = await fetch("http://localhost:3001/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        message,
      }),
    });

    const data = await response.json();

    return data.reply;
  } catch (error) {
    console.error(error);

    return "❌ Unable to connect to the Sentinel AI server.";
  }
}