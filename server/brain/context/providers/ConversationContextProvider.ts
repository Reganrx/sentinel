import type {
  ContextProvider,
} from "../ContextProvider.js";

import {
  ContextSource,
} from "../contextTypes.js";

import type {
  ConversationMessage,
} from "../../../memory/conversation.js";

import {
  getConversation,
} from "../../../memory/conversation.js";

export class ConversationContextProvider
  implements ContextProvider<ConversationMessage[]> {

  readonly name =
    "conversation";

  readonly sources = [

    ContextSource.Conversation,

  ];

  load(): ConversationMessage[] {

    return getConversation();

  }

}