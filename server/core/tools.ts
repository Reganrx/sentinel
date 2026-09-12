export type SentinelTool = {

    name: string;

    description: string;

};

export const TOOLS: SentinelTool[] = [

    {

        name: "memory",

        description:
            "Read and write long-term memories.",

    },

    {

        name: "conversation",

        description:
            "Access previous conversation history.",

    },

    {

        name: "filesystem",

        description:
            "Read project files.",

    },

    {
        

        name: "search",

        description:
            "Search project content.",

    },

];