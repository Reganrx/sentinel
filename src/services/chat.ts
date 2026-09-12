import { API_URL } from "./api";

export type ChatHistoryMessage = {
  role: "user" | "assistant";
  content: string;
};
export type ChatAction = { type: "open_page"; page: string } | { type: "open_camera"; deviceId: string; deviceName: string };
export type ChatResponse = { reply: string; action?: ChatAction };

/* =====================================================
   Abort Controller
===================================================== */

let controller: AbortController | null = null;

/* =====================================================
   Stop Streaming
===================================================== */

export function stopStreaming() {
  if (controller) {
    controller.abort();
    controller = null;
  }
}

/* =====================================================
   Standard Chat
===================================================== */

export async function sendMessage(
  message: string,
  history: ChatHistoryMessage[] = []
): Promise<ChatResponse> {

  const response = await fetch(`${API_URL}/chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      message,
      history,
    }),
  });

  if (!response.ok) {

    const text = await response.text();

    console.error(
      "Server Response:",
      response.status,
      text
    );

    throw new Error(
      `Server ${response.status}: ${text}`
    );

  }

  const data = await response.json();

  return data as ChatResponse;

}

/* =====================================================
   Streaming Chat
===================================================== */

export async function streamMessage(
  message: string,
  onChunk: (chunk: string) => void
): Promise<void> {

  controller = new AbortController();

  const response = await fetch(
    `${API_URL}/chat/stream`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "text/event-stream",
      },
      body: JSON.stringify({
        message,
      }),
      signal: controller.signal,
    }
  );

  if (!response.ok) {

    const text = await response.text();

    console.error(
      "Streaming Response:",
      response.status,
      text
    );

    throw new Error(
      `Server ${response.status}: ${text}`
    );

  }

  if (!response.body) {
    throw new Error("Streaming is not supported.");
  }

  const reader = response.body.getReader();

  const decoder = new TextDecoder();

  let buffer = "";

  try {

    for (;;) {

      const { done, value } = await reader.read();

      if (done) break;

      buffer += decoder.decode(value, {
        stream: true,
      });

      const events = buffer.split("\n\n");

      buffer = events.pop() || "";

      for (const event of events) {

        if (!event.startsWith("data: ")) {
          continue;
        }

        const data = JSON.parse(
          event.substring(6)
        );

        switch (data.type) {

          case "chunk":

            onChunk(data.content);

            break;

          case "done":

            controller = null;

            return;

          case "error":

            controller = null;

            throw new Error(
              data.content
            );

        }

      }

    }

  } catch (err: unknown) {

    if (err instanceof DOMException && err.name === "AbortError") {

      console.log(
        "🛑 Stream cancelled."
      );

      return;

    }

    throw err;

  } finally {

    controller = null;

  }

}
