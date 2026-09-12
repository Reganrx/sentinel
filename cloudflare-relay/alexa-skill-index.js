const Alexa = require("ask-sdk-core");
const https = require("https");

const RELAY_ORIGIN = "https://sentinel-relay.reganbelson.workers.dev";
// Alexa-hosted skills do not provide a normal custom environment-variable
// editor. Paste the same rotated secret used by Cloudflare and Sentinel here.
const RELAY_SECRET = "PASTE_YOUR_ROTATED_SECRET_HERE";

function postToRelay(path, payload, accessToken) {
  if (!RELAY_SECRET || RELAY_SECRET === "PASTE_YOUR_ROTATED_SECRET_HERE") {
    return Promise.reject(
      new Error("The relay secret has not been added to index.js."),
    );
  }

  const body = JSON.stringify(payload);
  const url = new URL(`${RELAY_ORIGIN}${path}`);

  return new Promise((resolve, reject) => {
    const request = https.request(
      {
        hostname: url.hostname,
        path: `${url.pathname}${url.search}`,
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(body),
          Authorization: `Bearer ${accessToken || RELAY_SECRET}`,
        },
        timeout: 8000,
      },
      (response) => {
        let responseBody = "";
        response.on("data", (chunk) => {
          responseBody += chunk;
        });
        response.on("end", () => {
          if (response.statusCode >= 200 && response.statusCode < 300) {
            resolve(responseBody ? JSON.parse(responseBody) : {});
          } else {
            reject(
              new Error(
                `Relay registration returned HTTP ${response.statusCode}: ${responseBody || "no response body"}`,
              ),
            );
          }
        });
      },
    );

    request.on("timeout", () =>
      request.destroy(new Error("Relay request timed out.")),
    );
    request.on("error", reject);
    request.write(body);
    request.end();
  });
}

async function registerInvokingEcho(handlerInput) {
  const system = handlerInput.requestEnvelope.context?.System;
  const device = system?.device;

  if (!device?.deviceId) {
    throw new Error("Alexa did not include a device ID in this request.");
  }

  const supportedInterfaces = Object.keys(device.supportedInterfaces || {});
  console.log("Registering invoking Echo", {
    deviceIdSuffix: device.deviceId.slice(-6),
    supportedInterfaces,
  });

  const accessToken = system?.user?.accessToken;
  if (!accessToken)
    throw new Error("Please link Sentinel AI in the Alexa app first.");
  const result = await postToRelay(
    "/alexa/devices/register",
    {
      deviceId: device.deviceId,
      supportedInterfaces,
      userId: handlerInput.requestEnvelope.session?.user?.userId ?? "unknown",
    },
    accessToken,
  );

  console.log("Echo registration succeeded", result);
  return result;
}

async function pairSentinel(handlerInput, pairingPhrase) {
  return postToRelay("/installations/pair-alexa", {
    pairingPhrase,
    userId: handlerInput.requestEnvelope.session?.user?.userId ?? "unknown",
  });
}

function pairingPhraseFrom(handlerInput) {
  const raw =
    Alexa.getSlotValue(handlerInput.requestEnvelope, "pairingPhrase") || "";
  return String(raw)
    .toLowerCase()
    .replace(/[^a-z\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const PairSentinelIntentHandler = {
  canHandle(handlerInput) {
    return (
      Alexa.getRequestType(handlerInput.requestEnvelope) === "IntentRequest" &&
      Alexa.getIntentName(handlerInput.requestEnvelope) === "PairSentinelIntent"
    );
  },
  async handle(handlerInput) {
    const pairingPhrase = pairingPhraseFrom(handlerInput);
    console.log("Pairing intent received", {
      pairingPhrase,
      dialogState: handlerInput.requestEnvelope.request?.dialogState,
    });
    if (!/^[a-z]+ [a-z]+$/.test(pairingPhrase))
      return handlerInput.responseBuilder
        .speak("Please say the two word pairing phrase shown in Sentinel.")
        .reprompt("What is the two word pairing phrase?")
        .getResponse();
    try {
      await pairSentinel(handlerInput, pairingPhrase);
      return handlerInput.responseBuilder
        .speak(
          "Sentinel is paired with this Alexa account. You can now send commands.",
        )
        .getResponse();
    } catch (error) {
      console.error("PAIRING FAILED", error);
      return handlerInput.responseBuilder
        .speak(
          "That pairing phrase was invalid or expired. Create a new phrase in Sentinel and try again.",
        )
        .getResponse();
    }
  },
};

const BeginPairingIntentHandler = {
  canHandle(handlerInput) {
    return (
      Alexa.getRequestType(handlerInput.requestEnvelope) === "IntentRequest" &&
      Alexa.getIntentName(handlerInput.requestEnvelope) === "BeginPairingIntent"
    );
  },
  handle(handlerInput) {
    return handlerInput.responseBuilder
      .speak("Ready to pair. Please say the two word phrase shown in Sentinel.")
      .reprompt("What is the two word pairing phrase?")
      .addElicitSlotDirective("pairingPhrase", {
        name: "PairSentinelIntent",
        confirmationStatus: "NONE",
        slots: {
          pairingPhrase: {
            name: "pairingPhrase",
            confirmationStatus: "NONE",
          },
        },
      })
      .getResponse();
  },
};

function sendToSentinel(command, userId, accessToken) {
  return postToRelay(
    "/dispatch",
    {
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      source: "alexa",
      type: "sentinel.command",
      payload: { command, userId },
    },
    accessToken,
  );
}

const LaunchRequestHandler = {
  canHandle(handlerInput) {
    return (
      Alexa.getRequestType(handlerInput.requestEnvelope) === "LaunchRequest"
    );
  },

  async handle(handlerInput) {
    try {
      await registerInvokingEcho(handlerInput);
      const speech =
        "Sentinel online. This Echo has been registered. What would you like me to control?";
      return handlerInput.responseBuilder
        .speak(speech)
        .reprompt("What would you like Sentinel to control?")
        .getResponse();
    } catch (error) {
      console.error("ECHO REGISTRATION FAILED", error);
      return handlerInput.responseBuilder
        .speak(
          `Sentinel opened, but Echo registration failed. ${error.message}`,
        )
        .reprompt("You can try opening Sentinel AI again.")
        .getResponse();
    }
  },
};

const SentinelCommandIntentHandler = {
  canHandle(handlerInput) {
    return (
      Alexa.getRequestType(handlerInput.requestEnvelope) === "IntentRequest" &&
      Alexa.getIntentName(handlerInput.requestEnvelope) ===
        "SentinelCommandIntent"
    );
  },

  async handle(handlerInput) {
    const command = Alexa.getSlotValue(handlerInput.requestEnvelope, "command");
    if (!command) {
      return handlerInput.responseBuilder
        .speak("Please tell me what you would like Sentinel to do.")
        .reprompt("For example, say please turn on all lights.")
        .getResponse();
    }

    try {
      const pairingMatch = command.match(
        /\bpair(?:ing)?(?:\s+phrase)?\s+(.+)$/i,
      );
      if (pairingMatch) {
        const pairingPhrase = pairingMatch[1]
          .toLowerCase()
          .replace(/[^a-z\s]/g, " ")
          .replace(/\s+/g, " ")
          .trim();
        if (!/^[a-z]+ [a-z]+$/.test(pairingPhrase))
          return handlerInput.responseBuilder
            .speak(
              "Please say pair followed by the two word phrase shown in Sentinel.",
            )
            .reprompt("Say pair, followed by the two word phrase.")
            .getResponse();
        await pairSentinel(handlerInput, pairingPhrase);
        return handlerInput.responseBuilder
          .speak(
            "Sentinel is paired with this Alexa account. You can now send commands.",
          )
          .getResponse();
      }
      await registerInvokingEcho(handlerInput);
      await sendToSentinel(
        command,
        handlerInput.requestEnvelope.session?.user?.userId ?? "unknown",
        handlerInput.requestEnvelope.context?.System?.user?.accessToken,
      );
      return handlerInput.responseBuilder
        .speak(`Understood. Sending Sentinel the command: ${command}.`)
        .getResponse();
    } catch (error) {
      console.error("SENTINEL COMMAND FAILED", error);
      return handlerInput.responseBuilder
        .speak(`I could not reach Sentinel. ${error.message}`)
        .getResponse();
    }
  },
};

const HelpIntentHandler = {
  canHandle(handlerInput) {
    return (
      Alexa.getRequestType(handlerInput.requestEnvelope) === "IntentRequest" &&
      Alexa.getIntentName(handlerInput.requestEnvelope) === "AMAZON.HelpIntent"
    );
  },
  handle(handlerInput) {
    return handlerInput.responseBuilder
      .speak("You can ask Sentinel to control your connected lights.")
      .reprompt("What would you like Sentinel to control?")
      .getResponse();
  },
};

const CancelAndStopIntentHandler = {
  canHandle(handlerInput) {
    return (
      Alexa.getRequestType(handlerInput.requestEnvelope) === "IntentRequest" &&
      ["AMAZON.CancelIntent", "AMAZON.StopIntent"].includes(
        Alexa.getIntentName(handlerInput.requestEnvelope),
      )
    );
  },
  handle(handlerInput) {
    return handlerInput.responseBuilder.speak("Standing by.").getResponse();
  },
};

const FallbackIntentHandler = {
  canHandle(handlerInput) {
    return (
      Alexa.getRequestType(handlerInput.requestEnvelope) === "IntentRequest" &&
      Alexa.getIntentName(handlerInput.requestEnvelope) ===
        "AMAZON.FallbackIntent"
    );
  },
  handle(handlerInput) {
    return handlerInput.responseBuilder
      .speak("I did not understand that command. Please try again.")
      .reprompt("What would you like Sentinel to control?")
      .getResponse();
  },
};

const SessionEndedRequestHandler = {
  canHandle(handlerInput) {
    return (
      Alexa.getRequestType(handlerInput.requestEnvelope) ===
      "SessionEndedRequest"
    );
  },
  handle(handlerInput) {
    console.log(
      "Alexa session ended",
      handlerInput.requestEnvelope.request?.reason,
    );
    return handlerInput.responseBuilder.getResponse();
  },
};

const ErrorHandler = {
  canHandle() {
    return true;
  },
  handle(handlerInput, error) {
    console.error("UNHANDLED SKILL ERROR", error);
    return handlerInput.responseBuilder
      .speak(`Sorry, Sentinel could not process that request. ${error.message}`)
      .reprompt("Please try again.")
      .getResponse();
  },
};

exports.handler = Alexa.SkillBuilders.custom()
  .addRequestHandlers(
    LaunchRequestHandler,
    BeginPairingIntentHandler,
    PairSentinelIntentHandler,
    SentinelCommandIntentHandler,
    HelpIntentHandler,
    CancelAndStopIntentHandler,
    FallbackIntentHandler,
    SessionEndedRequestHandler,
  )
  .addErrorHandlers(ErrorHandler)
  .lambda();
