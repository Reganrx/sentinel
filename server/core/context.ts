import { getConversation } from "../memory/conversation.js";
import { getLongTermMemory } from "../memory/longTermMemory.js";
import { getUserProfile } from "../memory/profile.js";

export type SentinelContext = {

    profile: ReturnType<typeof getUserProfile>;

    memories: ReturnType<typeof getLongTermMemory>;

    conversation: ReturnType<typeof getConversation>;

};

export function buildContext(): SentinelContext {

    return {

        profile: getUserProfile(),

        memories: getLongTermMemory(),

        conversation: getConversation(),

    };

}