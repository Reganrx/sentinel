import SENTINEL_PROMPT from "../prompts/sentinel.js";

export type ConversationMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

const MAX_MESSAGES = 30;

const conversation: ConversationMessage[] = [
  {
    role: "system",
    content: SENTINEL_PROMPT,
  },
];

export function getConversation(): ConversationMessage[] {
  return conversation;
}

export function addUserMessage(
  message: string
): void {

  conversation.push({

    role: "user",

    content: message,

  });

  trimConversation();

}

export function addAssistantMessage(
  message: string
): void {

  conversation.push({

    role: "assistant",

    content: message,

  });

  trimConversation();

}

export function clearConversation(): void {

  conversation.splice(1);

}

export function replaceConversation(
  messages: ConversationMessage[]
): void {

  conversation.splice(
    1,
    conversation.length - 1,
    ...messages.slice(-MAX_MESSAGES)
  );

}

function trimConversation(): void {

  const history =
    conversation.slice(1);

  if (
    history.length <=
    MAX_MESSAGES
  ) {
    return;
  }

  conversation.splice(
    1,
    history.length -
      MAX_MESSAGES
  );

}
