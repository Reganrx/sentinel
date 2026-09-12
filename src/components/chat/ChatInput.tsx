import "./ChatInput.css";

import { useEffect, useRef, useState } from "react";

import {
  Mic,
  AudioLines,
  Paperclip,
  Brain,
  SendHorizontal,
  Square,
  X,
} from "../../shared/icons";

import IconButton from "../ui/IconButton";
import { useMemory } from "../../memory/MemoryContext";
import { API_URL } from "../../services/api";

type Props = {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  onVoiceSend?: (text: string) => void;

  streaming?: boolean;
  onStop?: () => void;

  attachment: File | null;
  onAttachment: (file: File | null) => void;
};

export default function ChatInput({
  value,
  onChange,
  onSend,
  onVoiceSend,
  streaming = false,
  onStop,
  attachment,
  onAttachment,
}: Props) {

  const textareaRef =
    useRef<HTMLTextAreaElement>(null);

  const fileInputRef =
    useRef<HTMLInputElement>(null);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const microphoneRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const cancelVoiceRef = useRef(false);
  const voiceTimerRef = useRef<number | null>(null);
  const silenceFrameRef = useRef<number | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const [voiceState, setVoiceState] = useState<"idle" | "recording" | "transcribing">("idle");
  const [voiceError, setVoiceError] = useState("");
  const [voiceSeconds, setVoiceSeconds] = useState(0);

  const {
    toggleMemory,
  } = useMemory();

  const [
    dragging,
    setDragging,
  ] = useState(false);

  useEffect(() => {

    resizeTextarea();

  }, [value]);

  useEffect(() => () => {
    recorderRef.current?.stop();
    microphoneRef.current?.getTracks().forEach(track => track.stop());
    if (voiceTimerRef.current) window.clearInterval(voiceTimerRef.current);
    if (silenceFrameRef.current) window.cancelAnimationFrame(silenceFrameRef.current);
    void audioContextRef.current?.close();
  }, []);

  function stopVoice(cancel = false) {
    cancelVoiceRef.current = cancel;
    recorderRef.current?.stop();
  }

  function resizeTextarea() {

    if (!textareaRef.current) return;

    textareaRef.current.style.height = "0px";

    textareaRef.current.style.height =
      Math.min(
        textareaRef.current.scrollHeight,
        220
      ) + "px";

  }

  function handleSend() {

    if (
      !value.trim() &&
      !attachment
    ) {
      return;
    }

    if (streaming) {

      onStop?.();

      return;

    }

    onSend();

  }

  function handleAttachmentClick() {

    fileInputRef.current?.click();

  }

  function handleAttachmentSelected(
    event: React.ChangeEvent<HTMLInputElement>
  ) {

    const file =
      event.target.files?.[0];

    if (!file) return;

    onAttachment(file);

    event.target.value = "";

  }

  function removeAttachment() {

    onAttachment(null);

  }

  async function handleVoice() {
    if (voiceState === "transcribing") return;
    if (voiceState === "recording") {
      stopVoice();
      return;
    }

    setVoiceError("");
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setVoiceError("Microphone recording is not supported on this device.");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
      microphoneRef.current = stream;
      chunksRef.current = [];
      const preferredType = ["audio/webm;codecs=opus", "audio/webm", "audio/ogg;codecs=opus"].find(type => MediaRecorder.isTypeSupported(type));
      const recorder = new MediaRecorder(stream, preferredType ? { mimeType: preferredType } : undefined);
      recorderRef.current = recorder;
      const audioContext = new AudioContext();
      audioContextRef.current = audioContext;
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 1024;
      audioContext.createMediaStreamSource(stream).connect(analyser);
      const samples = new Uint8Array(analyser.fftSize);
      let speechStarted = false;
      let speechStartedAt = 0;
      let quietSince = 0;
      let noiseFloor = .008;
      const monitorSilence = () => {
        if (recorder.state !== "recording") return;
        analyser.getByteTimeDomainData(samples);
        let energy = 0;
        for (const sample of samples) {
          const normalised = (sample - 128) / 128;
          energy += normalised * normalised;
        }
        const level = Math.sqrt(energy / samples.length);
        if (!speechStarted) {
          noiseFloor = noiseFloor * .94 + level * .06;
          if (level > Math.max(.018, noiseFloor * 2.5)) {
            speechStarted = true;
            speechStartedAt = performance.now();
            quietSince = 0;
          }
        } else if (level > Math.max(.012, noiseFloor * 1.7)) {
          quietSince = 0;
        } else {
          if (!quietSince) quietSince = performance.now();
          if (performance.now() - quietSince >= 1250 && performance.now() - speechStartedAt >= 500) {
            recorder.stop();
            return;
          }
        }
        silenceFrameRef.current = window.requestAnimationFrame(monitorSilence);
      };
      recorder.ondataavailable = event => { if (event.data.size > 0) chunksRef.current.push(event.data); };
      recorder.onerror = () => setVoiceError("The microphone recording failed. Please try again.");
      recorder.onstop = async () => {
        if (voiceTimerRef.current) window.clearInterval(voiceTimerRef.current);
        if (silenceFrameRef.current) window.cancelAnimationFrame(silenceFrameRef.current);
        silenceFrameRef.current = null;
        void audioContext.close();
        audioContextRef.current = null;
        stream.getTracks().forEach(track => track.stop());
        microphoneRef.current = null;
        recorderRef.current = null;
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" });
        if (cancelVoiceRef.current) { cancelVoiceRef.current = false; setVoiceState("idle"); setVoiceSeconds(0); return; }
        if (blob.size < 100) { setVoiceState("idle"); setVoiceError("No speech was captured."); return; }
        setVoiceState("transcribing");
        try {
          const response = await fetch(`${API_URL}/audio/transcribe`, { method: "POST", headers: { "Content-Type": blob.type || "audio/webm" }, body: blob });
          const result = await response.json() as { text?: string; error?: string };
          if (!response.ok) throw new Error(result.error || "Transcription failed.");
          if (!result.text) throw new Error("No speech was recognised.");
          const transcript = result.text.trim();
          if (onVoiceSend) onVoiceSend(transcript);
          else {
            onChange(value.trim() ? `${value.trim()} ${transcript}` : transcript);
            textareaRef.current?.focus();
          }
        } catch (error) {
          setVoiceError(error instanceof Error ? error.message : "Unable to transcribe the recording.");
        } finally { setVoiceState("idle"); setVoiceSeconds(0); }
      };
      cancelVoiceRef.current = false;
      recorder.start(250);
      silenceFrameRef.current = window.requestAnimationFrame(monitorSilence);
      setVoiceSeconds(0);
      voiceTimerRef.current = window.setInterval(() => setVoiceSeconds(seconds => {
        if (seconds >= 29) { stopVoice(); return 30; }
        return seconds + 1;
      }), 1000);
      setVoiceState("recording");
    } catch (error) {
      setVoiceState("idle");
      setVoiceError(error instanceof DOMException && error.name === "NotAllowedError" ? "Microphone access was denied. Enable it in Windows privacy settings and try again." : "Sentinel could not access the microphone.");
    }
  }

  function handleDragOver(
    event: React.DragEvent<HTMLDivElement>
  ) {

    event.preventDefault();

    if (!dragging) {

      setDragging(true);

    }

  }

  function handleDragLeave(
    event: React.DragEvent<HTMLDivElement>
  ) {

    event.preventDefault();

    const rect =
      event.currentTarget.getBoundingClientRect();

    if (

      event.clientX < rect.left ||

      event.clientX > rect.right ||

      event.clientY < rect.top ||

      event.clientY > rect.bottom

    ) {

      setDragging(false);

    }

  }

  function handleDrop(
    event: React.DragEvent<HTMLDivElement>
  ) {

    event.preventDefault();

    setDragging(false);

    const file =
      event.dataTransfer.files?.[0];

    if (!file) return;

    onAttachment(file);

  }

  return (

    <div
      className={
        dragging
          ? "composer dragging"
          : "composer"
      }
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >

      <div className="composer-shell">

        {attachment && (

          <div className="attachment-preview">

            <div className="attachment-icon">

              {attachment.type.startsWith("image/")
                ? "🖼️"
                : attachment.type === "application/pdf"
                ? "📕"
                : attachment.name.endsWith(".zip")
                ? "🗜️"
                : attachment.name.endsWith(".doc") ||
                  attachment.name.endsWith(".docx")
                ? "📘"
                : attachment.name.endsWith(".xls") ||
                  attachment.name.endsWith(".xlsx")
                ? "📗"
                : "📄"}

            </div>

            <div className="attachment-details">

              <div className="attachment-name">

                {attachment.name}

              </div>

              <div className="attachment-meta">

                {(attachment.size / 1024).toFixed(1)}
                {" "}
                KB

              </div>

            </div>

            <button
              className="attachment-remove"
              type="button"
              onClick={removeAttachment}
            >

              <X />

            </button>

          </div>

        )}

        {dragging && (

          <div className="drop-overlay">

            <div className="drop-overlay-icon">

              📎

            </div>

            <h3>

              Drop files here

            </h3>

            <p>

              Release to attach your file

            </p>

          </div>

        )}

        <textarea
          ref={textareaRef}
          className="composer-input"
          placeholder="Message Sentinel..."
          rows={1}
          value={value}
          onChange={(e)=>
            onChange(e.target.value)
          }
          onKeyDown={(e)=>{

            if(
              e.key==="Enter" &&
              !e.shiftKey
            ){

              e.preventDefault();

              handleSend();

            }

          }}
        />

        <div className="composer-divider"/>

        <div className="composer-toolbar">

          <div className="toolbar-left">

            <IconButton
              icon={<Paperclip />}
              title="Attach File"
              onClick={handleAttachmentClick}
            />

            <IconButton
              icon={<Mic />}
              title={voiceState === "recording" ? "Stop recording" : voiceState === "transcribing" ? "Transcribing speech" : "Voice input"}
              onClick={handleVoice}
              active={voiceState === "recording"}
            />

            <IconButton
              icon={<Brain />}
              title="Memory"
              onClick={toggleMemory}
            />

            <IconButton
              icon={<AudioLines />}
              title="Start or show live conversation"
              onClick={() => window.dispatchEvent(new Event("sentinel:live-conversation-toggle"))}
            />

          </div>

          <div className="toolbar-right">

            {streaming ? (

              <IconButton
                icon={<Square />}
                title="Stop"
                danger
                onClick={onStop}
              />

            ) : (

              <IconButton
                icon={<SendHorizontal />}
                title="Send"
                active
                onClick={handleSend}
              />

            )}

          </div>

        </div>

        {(voiceState !== "idle" || voiceError) && <div className={`voice-status ${voiceError ? "voice-status--error" : ""}`} role="status">
          {voiceState === "recording" && !voiceError && <span className="voice-pulse" />}
          {voiceError || (voiceState === "recording" ? `Listening · ${String(Math.floor(voiceSeconds / 60)).padStart(2, "0")}:${String(voiceSeconds % 60).padStart(2, "0")} · sends when you stop talking` : "Transcribing and sending your message…")}
          {voiceState === "recording" && <button className="voice-cancel" type="button" onClick={() => stopVoice(true)}><X /> Cancel</button>}
          {voiceError && <button type="button" onClick={() => setVoiceError("")} aria-label="Dismiss voice error"><X /></button>}
        </div>}

      </div>

      <input
        ref={fileInputRef}
        type="file"
        hidden
        onChange={handleAttachmentSelected}
      />

    </div>

  );

}
