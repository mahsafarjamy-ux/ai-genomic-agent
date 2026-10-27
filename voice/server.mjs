import { createServer } from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import twilio from "twilio";
import WebSocket, { WebSocketServer } from "ws";
import { isPhoneNumber } from "./support.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..");

function loadEnvFile(file) {
  try {
    if (!fs.existsSync(file)) return;
    for (const raw of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
      const line = raw.trim();
      if (!line || line.startsWith("#")) continue;
      const idx = line.indexOf("=");
      if (idx < 1) continue;
      const key = line.slice(0, idx).trim();
      let value = line.slice(idx + 1).trim();
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
      if (!process.env[key]) process.env[key] = value;
    }
  } catch {
    // Optional local env files must never crash the voice bridge.
  }
}

[
  path.join(ROOT, "api/.env.local"),
  path.join(ROOT, "api/.env"),
  path.join(ROOT, ".env.local"),
  path.join(ROOT, ".env")
].forEach(loadEnvFile);

const PORT = Number(process.env.VOICE_SERVER_PORT || 8081);
const MODEL = String(process.env.OPENAI_REALTIME_MODEL || "gpt-realtime").trim();
const VOICE = String(process.env.OPENAI_REALTIME_VOICE || "marin").trim();
const APP_URL = String(process.env.COUNSELLING_API_URL || "http://127.0.0.1:8000").replace(/\/$/, "");

const TWILIO_AUTH_TOKEN = String(process.env.TWILIO_AUTH_TOKEN || "").trim();
const VALIDATE_TWILIO = String(process.env.VOICE_VALIDATE_TWILIO || "1") !== "0";

function xmlEscape(value = "") {
  return String(value).replace(/[<>&'\"]/g, (char) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" }[char] || char));
}

function publicBaseUrl(request) {
  const configured = String(process.env.VOICE_PUBLIC_BASE_URL || "").trim().replace(/\/$/, "");
  if (configured) return configured;
  const forwardedProto = String(request?.headers?.["x-forwarded-proto"] || "").split(",")[0].trim();
  const proto = forwardedProto || "http";
  const host = String(request?.headers?.host || `127.0.0.1:${PORT}`);
  return `${proto}://${host}`;
}

function streamUrl(request) {
  const configured = String(process.env.VOICE_STREAM_URL || "").trim();
  if (configured) return configured;
  return `${publicBaseUrl(request).replace(/^http:/, "ws:").replace(/^https:/, "wss:")}/media`;
}

function readBody(request) {
  return new Promise((resolve, reject) => {
    let body = "";
    request.setEncoding("utf8");
    request.on("data", (chunk) => {
      body += chunk;
      if (body.length > 200_000) {
        reject(new Error("Request too large"));
        request.destroy();
      }
    });
    request.on("end", () => resolve(body));
    request.on("error", reject);
  });
}

function formObject(body) {
  const params = new URLSearchParams(body);
  return Object.fromEntries(params.entries());
}

function validateTwilioRequest(request, url, params = {}) {
  if (!VALIDATE_TWILIO) return true;
  if (!TWILIO_AUTH_TOKEN) return false;
  const signature = String(request.headers["x-twilio-signature"] || "");
  if (!signature) return false;
  try {
    return twilio.validateRequest(TWILIO_AUTH_TOKEN, signature, url, params);
  } catch {
    return false;
  }
}

function readyState() {
  return {
    service: "bioverse-counselling-support",
    ready: Boolean(process.env.OPENAI_API_KEY && (!VALIDATE_TWILIO || TWILIO_AUTH_TOKEN)),
    openai: Boolean(process.env.OPENAI_API_KEY),
    twilioValidation: VALIDATE_TWILIO ? Boolean(TWILIO_AUTH_TOKEN) : "disabled-for-testing",
    humanTransfer: Boolean(process.env.TWILIO_ACCOUNT_SID && process.env.COUNSELLING_STAFF_PHONE),
    model: MODEL,
    voice: VOICE
  };
}

const server = createServer(async (request, response) => {
  const url = new URL(request.url || "/", `http://${request.headers.host || `127.0.0.1:${PORT}`}`);

  if (request.method === "GET" && url.pathname === "/health") {
    response.writeHead(200, { "Content-Type": "application/json", "Cache-Control": "no-store" });
    response.end(JSON.stringify(readyState()));
    return;
  }

  if (request.method === "POST" && url.pathname === "/incoming") {
    const body = await readBody(request).catch(() => "");
    const params = formObject(body);
    const validationUrl = `${publicBaseUrl(request)}/incoming`;

    if (!validateTwilioRequest(request, validationUrl, params)) {
      response.writeHead(403, { "Content-Type": "text/plain", "Cache-Control": "no-store" });
      response.end("Forbidden");
      return;
    }

    if (!process.env.OPENAI_API_KEY) {
      response.writeHead(200, { "Content-Type": "text/xml; charset=utf-8", "Cache-Control": "no-store" });
      response.end("<?xml version=\"1.0\" encoding=\"UTF-8\"?><Response><Say>The BioVerse assistant is not configured yet. Please call the office again shortly.</Say></Response>");
      return;
    }

    const media = streamUrl(request);
    if (!/^wss:\/\//i.test(media) && String(process.env.VOICE_ALLOW_INSECURE_WS || "0") !== "1") {
      response.writeHead(503, { "Content-Type": "text/plain", "Cache-Control": "no-store" });
      response.end("VOICE_STREAM_URL must use wss://");
      return;
    }

    const caller = String(params.From || params.Caller || "").slice(0, 32);
    const twiml = `<?xml version="1.0" encoding="UTF-8"?><Response><Connect><Stream url="${xmlEscape(media)}"><Parameter name="direction" value="inbound" />${caller ? `<Parameter name="caller" value="${xmlEscape(caller)}" />` : ""}</Stream></Connect></Response>`;
    response.writeHead(200, { "Content-Type": "text/xml; charset=utf-8", "Cache-Control": "no-store" });
    response.end(twiml);
    return;
  }

  response.writeHead(404, { "Content-Type": "text/plain", "Cache-Control": "no-store" });
  response.end("Not found");
});

const wss = new WebSocketServer({ noServer: true, perMessageDeflate: false });

server.on("upgrade", (request, socket, head) => {
  const url = new URL(request.url || "/", `http://${request.headers.host || `127.0.0.1:${PORT}`}`);
  if (url.pathname !== "/media") {
    socket.destroy();
    return;
  }

  if (VALIDATE_TWILIO) {
    const validationUrl = `${publicBaseUrl(request).replace(/^http:/, "ws:").replace(/^https:/, "wss:")}/media`;
    if (!validateTwilioRequest(request, validationUrl, {})) {
      socket.write("HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n");
      socket.destroy();
      return;
    }
  }

  wss.handleUpgrade(request, socket, head, (ws) => wss.emit("connection", ws, request));
});

function realtimeInstructions() {
  return [
    "You are BioVerse's AI administrative support assistant for virtual genetic counselling.",
    "Clearly identify yourself as an AI assistant at the start. Be warm, concise and ask one question at a time.",
    "Help with registration, email verification, consent, consultant selection, payments and joining sessions.",
    "The booking flow is register, confirm email using the emailed eight-digit code, review data consent, choose a consultant and time, then pay on the secure website.",
    "Use get_service_information for actual consultants, fees and service status. Never invent availability, fees or booked status.",
    "You cannot read patient records, confirm a booking, change appointments, collect payment or issue refunds. Direct callers to their signed-in BioVerse counselling page.",
    "Never collect passwords, verification codes, card numbers, DNA data or medical history. Do not give clinical advice or interpret genetic results.",
    "Clinical questions must go to the genetic counsellor. For medical emergencies tell the caller to contact local emergency services.",
    "If asked for a human or unable to help, use transfer_to_staff. Never claim transfer succeeded unless the tool succeeds.",
    "If transfer is unavailable, ask the caller to try staff again later. Do not promise a callback: no callback request is saved."
  ].join("\n");
}

const tools = [
  {type:"function", name:"get_service_information", description:"Read current public BioVerse counselling information and consultant fees.", parameters:{type:"object",properties:{},additionalProperties:false}},
  {type:"function", name:"transfer_to_staff", description:"Transfer this call to the configured BioVerse support staff number.", parameters:{type:"object",properties:{},additionalProperties:false}}
];

async function executeTool(state, name) {
  if (name === "get_service_information") {
    try {
      const response = await fetch(APP_URL + "/api/counselling/config", {signal:AbortSignal.timeout(8000)});
      if (!response.ok) return {ok:false,error:"Service information is temporarily unavailable."};
      const data = await response.json();
      return {ok:true,bookings_open:data.enabled,consultants:data.consultants.map(c=>({name:c.name,credentials:c.credentials,duration_minutes:c.duration_minutes,fee:c.price_cents/100,currency:c.currency})),
        booking_page:process.env.COUNSELLING_SITE_URL || "", phone_support:"Administrative questions only"};
    } catch { return {ok:false,error:"Service information is temporarily unavailable."}; }
  }
  if (name === "transfer_to_staff") {
    const number = String(process.env.COUNSELLING_STAFF_PHONE || "");
    const account = String(process.env.TWILIO_ACCOUNT_SID || "");
    if (!state.callSid || !account || !TWILIO_AUTH_TOKEN || !isPhoneNumber(number)) return {ok:false,error:"Staff transfer is not configured."};
    try {
      await twilio(account,TWILIO_AUTH_TOKEN).calls(state.callSid).update({twiml:'<Response><Say>Connecting you to BioVerse support.</Say><Dial timeout="25">'+xmlEscape(number)+'</Dial><Say>Support is unavailable or the call has ended. Please try again later.</Say></Response>'});
      return {ok:true};
    } catch { return {ok:false,error:"The transfer could not be completed. Please try again later."}; }
  }
  return {ok:false,error:"Unknown support tool."};
}

function sendJson(socket, value) {
  if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify(value));
}

function connectOpenAI(state) {
  const key = String(process.env.OPENAI_API_KEY || "").trim();
  if (!key || state.openai) return;

  const socket = new WebSocket(`wss://api.openai.com/v1/realtime?model=${encodeURIComponent(MODEL)}`, {
    headers: {
      Authorization: `Bearer ${key}`,
      "OpenAI-Beta": "realtime=v1"
    },
    perMessageDeflate: false
  });
  state.openai = socket;

  socket.on("open", () => {
    sendJson(socket, {
      type: "session.update",
      session: {
        type: "realtime",
        model: MODEL,
        instructions: realtimeInstructions(state),
        output_modalities: ["audio"],
        audio: {
          input: {
            format: { type: "audio/pcmu" },
            transcription: { model: process.env.OPENAI_TRANSCRIBE_MODEL || "gpt-4o-mini-transcribe" },
            turn_detection: {
              type: "server_vad",
              threshold: 0.5,
              prefix_padding_ms: 300,
              silence_duration_ms: 450,
              create_response: true,
              interrupt_response: true
            }
          },
          output: {
            format: { type: "audio/pcmu" },
            voice: VOICE,
            speed: 1
          }
        },
        tools,
        tool_choice: "auto",
        max_output_tokens: 700
      }
    });
  });

  socket.on("message", async (raw) => {
    let event;
    try { event = JSON.parse(raw.toString()); } catch { return; }

    if (event.type === "session.updated") {
      state.openAIReady = true;
      for (const audio of state.pendingAudio.splice(0)) sendJson(socket, { type: "input_audio_buffer.append", audio });
      sendJson(socket, {
        type: "response.create",
        response: {
          instructions: state.direction === "outbound"
            ? `Begin the outbound call now. Say you are the BioVerse AI support assistant and briefly explain the approved purpose: ${state.purpose || "BioVerse support"}. Ask whether now is a good time to talk.`
            : "Greet the caller now. Say you are the BioVerse AI support assistant and ask how you can help. Keep the greeting short."
        }
      });
      return;
    }

    if (event.type === "response.output_audio.delta" && event.delta && state.streamSid) {
      sendJson(state.twilio, { event: "media", streamSid: state.streamSid, media: { payload: event.delta } });
      return;
    }

    if (event.type === "input_audio_buffer.speech_started" && state.streamSid) {
      sendJson(state.twilio, { event: "clear", streamSid: state.streamSid });
      return;
    }

    if (event.type === "response.function_call_arguments.done") {
      let args = {};
      try { args = JSON.parse(event.arguments || "{}"); } catch { args = {}; }
      const result = await executeTool(state, String(event.name || ""), args);
      sendJson(socket, {
        type: "conversation.item.create",
        item: {
          type: "function_call_output",
          call_id: event.call_id,
          output: JSON.stringify(result)
        }
      });
      sendJson(socket, { type: "response.create" });
      return;
    }

    if (event.type === "error") {
      console.error("OpenAI realtime error:", event.error?.code || event.error?.type || "unknown", event.error?.message || "");
    }
  });

  socket.on("close", () => {
    state.openAIReady = false;
    if (!state.closed && state.twilio?.readyState === WebSocket.OPEN) state.twilio.close(1011, "AI session ended");
  });

  socket.on("error", () => {
    if (!state.closed && state.twilio?.readyState === WebSocket.OPEN) state.twilio.close(1011, "AI connection error");
  });
}

wss.on("connection", (twilioSocket) => {
  const state = {
    twilio: twilioSocket,
    openai: null,
    openAIReady: false,
    pendingAudio: [],
    streamSid: "",
    callSid: "",
    direction: "inbound",
    purpose: "",
    caller: "",
    closed: false
  };

  twilioSocket.on("message", (raw) => {
    let event;
    try { event = JSON.parse(raw.toString()); } catch { return; }

    if (event.event === "start") {
      state.streamSid = String(event.start?.streamSid || event.streamSid || "");
      state.callSid = String(event.start?.callSid || "");
      state.direction = String(event.start?.customParameters?.direction || "inbound");
      state.purpose = String(event.start?.customParameters?.purpose || "").slice(0, 350);
      state.caller = String(event.start?.customParameters?.caller || "").slice(0, 32);
      connectOpenAI(state);
      return;
    }

    if (event.event === "media" && event.media?.payload) {
      const audio = String(event.media.payload);
      if (state.openAIReady) sendJson(state.openai, { type: "input_audio_buffer.append", audio });
      else if (state.pendingAudio.length < 100) state.pendingAudio.push(audio);
      return;
    }

    if (event.event === "stop") {
      state.closed = true;
      if (state.openai?.readyState === WebSocket.OPEN) state.openai.close(1000, "Twilio stream ended");
    }
  });

  twilioSocket.on("close", () => {
    state.closed = true;
    if (state.openai?.readyState === WebSocket.OPEN) state.openai.close(1000, "Twilio disconnected");
  });

  twilioSocket.on("error", () => {
    state.closed = true;
    if (state.openai?.readyState === WebSocket.OPEN) state.openai.close(1011, "Twilio connection error");
  });
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`BioVerse support voice bridge listening on port ${PORT}.`);
  if (!process.env.OPENAI_API_KEY) console.log("OPENAI_API_KEY is not configured; /health will report not ready.");
  if (VALIDATE_TWILIO && !TWILIO_AUTH_TOKEN) console.log("TWILIO_AUTH_TOKEN is not configured; signed Twilio requests will be rejected.");
});
