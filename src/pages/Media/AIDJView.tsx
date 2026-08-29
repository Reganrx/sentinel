import { useEffect, useMemo, useRef, useState } from "react";
import { AudioWaveform, CheckCircle2, Clock3, Disc3, Download, FolderOpen, Gauge, ListMusic, Music2, Pause, Play, Radio, RefreshCw, Shuffle, SkipForward, Sparkles, Square, WandSparkles, Waves, Zap } from "lucide-react";
import "./TidalSetup.css";

type DJTrack = { id: string; name: string; file: File; url: string };
type DeckName = "A" | "B";
type VirtualDJDeck = { deck: string; title: string; artist: string; bpm: string; key: string; playing: string; elapsed?: string; duration?: string };
type VirtualDJState = { installed: boolean; running: boolean; tidalConfigured: boolean; bridge: string; bridgeConfigured: boolean; bridgePort: number; bridgeError: string; decks: VirtualDJDeck[]; sampledAt?: string; crossfader?: string };
type DJCommand = "playPause" | "automix" | "mixNext" | "skip" | "mixNow" | "stop" | "sync" | "loop4" | "echo" | "filter" | "prepareShow" | "startShow" | "pauseShow" | "cueNext" | "transitionFx" | "energyBoost" | "endShow";
const AUDIO_TYPES = /\.(mp3|wav|flac|m4a|aac|ogg|opus)$/i;

function cleanTrackName(name: string) {
  return name.replace(AUDIO_TYPES, "").replace(/[_-]+/g, " ").trim();
}

function numericValue(value?: string) {
  const parsed = Number.parseFloat(String(value ?? "").replace(/[^\d.-]/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

function deckProgress(deck?: VirtualDJDeck) {
  const elapsedMs = numericValue(deck?.elapsed);
  const durationSeconds = numericValue(deck?.duration);
  return durationSeconds > 0 ? Math.max(0, Math.min(100, elapsedMs / (durationSeconds * 10))) : 0;
}

function timeLabel(milliseconds: number) {
  const seconds = Math.max(0, Math.floor(milliseconds / 1000));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

function LiveDeck({ number, deck, busy, onCommand }: { number: number; deck?: VirtualDJDeck; busy: boolean; onCommand: (command: DJCommand, deck: number) => void }) {
  const isPlaying = /^(yes|true|on|1)$/i.test(deck?.playing || "");
  const progress = deckProgress(deck);
  const elapsed = numericValue(deck?.elapsed);
  const duration = numericValue(deck?.duration) * 1000;
  return <article className={`performance-deck ${isPlaying ? "is-playing" : ""}`}>
    <header><span>DECK {number === 1 ? "A" : "B"}</span><i>{isPlaying ? "ON AIR" : deck?.title ? "CUED" : "EMPTY"}</i></header>
    <div className="deck-performance">
      <div className={`deck-platter ${isPlaying ? "spinning" : ""}`}><div className="deck-vinyl"><Disc3 /><b>{number === 1 ? "A" : "B"}</b></div><span /></div>
      <div className="deck-track"><small>NOW {isPlaying ? "PLAYING" : "LOADED"}</small><h4>{deck?.title || "Ready for a track"}</h4><p>{deck?.artist || "Load a track in VirtualDJ"}</p><div className="deck-metadata"><span><Gauge />{deck?.bpm || "--"} BPM</span><span><Music2 />{deck?.key || "--"}</span></div></div>
    </div>
    <div className="deck-waveform" aria-label={`${Math.round(progress)} percent complete`}><div className={isPlaying ? "moving" : ""}>{Array.from({ length: 56 }, (_, index) => <i key={index} style={{ height: `${20 + ((index * 17 + number * 11) % 72)}%` }} />)}</div><span style={{ left: `${progress}%` }} /></div>
    <div className="deck-time"><b>{timeLabel(elapsed)}</b><div><i style={{ width: `${progress}%` }} /></div><b>-{timeLabel(Math.max(0, duration - elapsed))}</b></div>
    <div className="deck-transport"><button className="deck-cue" disabled={busy} onClick={() => onCommand("sync", number)}><RefreshCw />SYNC</button><button className="deck-play" disabled={busy} onClick={() => onCommand("playPause", number)}>{isPlaying ? <Pause /> : <Play />}</button><button disabled={busy} onClick={() => onCommand("loop4", number)}><Waves />LOOP 4</button></div>
    <div className="deck-pads"><button disabled={busy} onClick={() => onCommand("echo", number)}><AudioWaveform />ECHO OUT</button><button disabled={busy} onClick={() => onCommand("filter", number)}><WandSparkles />FILTER</button><button disabled={busy} onClick={() => onCommand("sync", number)}><Zap />BEAT SYNC</button></div>
  </article>;
}

export default function AIDJView() {
  const [source, setSource] = useState<"local" | "tidal" | "spotify">("local");
  const [virtualDJ, setVirtualDJ] = useState<VirtualDJState | null>(null);
  const [bridgePort, setBridgePort] = useState(8080);
  const [bridgePassword, setBridgePassword] = useState("");
  const [bridgeBusy, setBridgeBusy] = useState(false);
  const [commandBusy, setCommandBusy] = useState(() => new Set<string>());
  const [bridgeMessage, setBridgeMessage] = useState("");
  const [showState, setShowState] = useState<"idle" | "prepared" | "live" | "paused">("idle");
  const [tidalConfirmed, setTidalConfirmed] = useState(() => localStorage.getItem("sentinel.ai-dj.tidal-confirmed") === "true");
  const [tracks, setTracks] = useState<DJTrack[]>([]);
  const [queueIndex, setQueueIndex] = useState(0);
  const [activeDeck, setActiveDeck] = useState<DeckName>("A");
  const [autoDJ, setAutoDJ] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [crossfade, setCrossfade] = useState(0);
  const [filter, setFilter] = useState(100);
  const [echo, setEcho] = useState(0);
  const [status, setStatus] = useState("Choose a music folder to build the local DJ queue.");
  const deckA = useRef<HTMLAudioElement>(null);
  const deckB = useRef<HTMLAudioElement>(null);
  const transitionTimer = useRef<number>();
  const audioContext = useRef<AudioContext>();
  const filterNodes = useRef<BiquadFilterNode[]>([]);
  const wetNodes = useRef<GainNode[]>([]);
  const bridgePollActive = useRef(false);
  const currentTrack = tracks[queueIndex];
  const nextTrack = tracks[(queueIndex + 1) % Math.max(tracks.length, 1)];

  async function refreshVirtualDJ(silent = false) {
    if (!window.sentinelDesktop || bridgePollActive.current) return;
    bridgePollActive.current = true;
    try {
      const next = await window.sentinelDesktop.virtualDJStatus() as VirtualDJState;
      setVirtualDJ(next);
      if (next.bridgePort) setBridgePort(next.bridgePort);
    } catch (error) {
      if (!silent) setBridgeMessage(error instanceof Error ? error.message : "VirtualDJ status could not be read.");
    } finally {
      bridgePollActive.current = false;
    }
  }

  async function configureBridge() {
    if (!window.sentinelDesktop) return;
    setBridgeBusy(true); setBridgeMessage("Testing the local VirtualDJ bridge...");
    try {
      const result = await window.sentinelDesktop.configureVirtualDJBridge(bridgePort, bridgePassword);
      setBridgeMessage(result.connected ? "Bridge connected. Sentinel can now read and control VirtualDJ." : result.error || "Network Control did not respond. Check its port and password in VirtualDJ.");
      setBridgePassword(""); await refreshVirtualDJ();
    } catch (error) { setBridgeMessage(error instanceof Error ? error.message : "Bridge setup failed."); }
    finally { setBridgeBusy(false); }
  }

  async function runVirtualDJCommand(command: DJCommand, deck = 0) {
    if (!window.sentinelDesktop) return;
    const commandKey = `${command}:${deck}`;
    setCommandBusy((current) => new Set(current).add(commandKey));
    try {
      await window.sentinelDesktop.virtualDJCommand(command, deck);
      setBridgeMessage("Command accepted by VirtualDJ · synchronising live deck state.");
      [120, 500, 1200].forEach((delay) => window.setTimeout(() => void refreshVirtualDJ(true), delay));
    }
    catch (error) { setBridgeMessage(error instanceof Error ? error.message : "VirtualDJ command failed."); }
    finally { setCommandBusy((current) => { const next = new Set(current); next.delete(commandKey); return next; }); }
  }

  async function runShowAction(action: "prepareShow" | "startShow" | "pauseShow" | "cueNext" | "transitionFx" | "energyBoost" | "endShow") {
    await runVirtualDJCommand(action);
    if (action === "prepareShow") { setShowState("prepared"); setBridgeMessage("Automix is open in VirtualDJ. Add your TIDAL playlist, then press Start AI show."); }
    if (action === "startShow") { setShowState("live"); setBridgeMessage("AI show is live. VirtualDJ is cueing and blending the Automix playlist automatically."); }
    if (action === "pauseShow") { setShowState("paused"); setBridgeMessage("Show paused safely. Press Resume AI show when ready."); }
    if (action === "endShow") { setShowState("idle"); setBridgeMessage("Show ended and both decks stopped."); }
  }

  useEffect(() => { void refreshVirtualDJ(); }, []);

  useEffect(() => {
    if (source !== "tidal" || virtualDJ?.bridge !== "connected") return;
    const timer = window.setInterval(() => void refreshVirtualDJ(true), 1000);
    return () => window.clearInterval(timer);
  }, [source, virtualDJ?.bridge]);

  useEffect(() => () => {
    tracks.forEach((track) => URL.revokeObjectURL(track.url));
    if (transitionTimer.current) window.clearInterval(transitionTimer.current);
  }, [tracks]);

  useEffect(() => {
    const a = deckA.current, b = deckB.current;
    if (!a || !b) return;
    const amount = crossfade / 100;
    a.volume = Math.cos(amount * Math.PI * 0.5);
    b.volume = Math.sin(amount * Math.PI * 0.5);
  }, [crossfade]);

  useEffect(() => {
    const frequency = 180 + (filter / 100) * 19820;
    filterNodes.current.forEach((node) => node.frequency.setTargetAtTime(frequency, node.context.currentTime, 0.03));
  }, [filter]);

  useEffect(() => {
    wetNodes.current.forEach((node) => node.gain.setTargetAtTime(echo / 100 * 0.55, node.context.currentTime, 0.03));
  }, [echo]);

  useEffect(() => {
    if (!autoDJ || !playing || tracks.length < 2) return;
    transitionTimer.current = window.setInterval(() => {
      const audio = activeDeck === "A" ? deckA.current : deckB.current;
      if (audio && Number.isFinite(audio.duration) && audio.duration - audio.currentTime <= 9 && audio.duration - audio.currentTime > 0) void transitionToNext();
    }, 500);
    return () => { if (transitionTimer.current) window.clearInterval(transitionTimer.current); };
    // The timer is rebuilt for every queue/deck state change and must use that
    // render's transition function rather than restarting on unrelated renders.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoDJ, playing, activeDeck, tracks.length, queueIndex]);

  function importTracks(files: FileList | null) {
    if (!files) return;
    tracks.forEach((track) => URL.revokeObjectURL(track.url));
    const imported = Array.from(files)
      .filter((file) => file.type.startsWith("audio/") || AUDIO_TYPES.test(file.name))
      .map((file, index) => ({ id: `${file.name}-${file.size}-${file.lastModified}-${index}`, name: cleanTrackName(file.name), file, url: URL.createObjectURL(file) }));
    setTracks(imported); setQueueIndex(0); setActiveDeck("A"); setCrossfade(0); setPlaying(false);
    setStatus(imported.length ? `${imported.length} tracks analysed and ready for AI sequencing.` : "No supported audio tracks were found in that folder.");
  }

  async function togglePlayback() {
    if (!currentTrack) return;
    const audio = activeDeck === "A" ? deckA.current : deckB.current;
    if (!audio) return;
    if (playing) { deckA.current?.pause(); deckB.current?.pause(); setPlaying(false); setStatus("DJ session paused."); return; }
    await ensureAudioGraph(); await audio.play(); setPlaying(true); setStatus(`Now playing ${currentTrack.name}.`);
  }

  async function ensureAudioGraph() {
    if (!audioContext.current) {
      const context = new AudioContext();
      audioContext.current = context;
      for (const element of [deckA.current, deckB.current]) {
        if (!element) continue;
        const sourceNode = context.createMediaElementSource(element);
        const filterNode = context.createBiquadFilter();
        filterNode.type = "lowpass";
        filterNode.frequency.value = 180 + (filter / 100) * 19820;
        const delayNode = context.createDelay(1);
        delayNode.delayTime.value = 0.28;
        const feedbackNode = context.createGain();
        feedbackNode.gain.value = 0.32;
        const wetNode = context.createGain();
        wetNode.gain.value = echo / 100 * 0.55;
        sourceNode.connect(filterNode);
        filterNode.connect(context.destination);
        filterNode.connect(delayNode);
        delayNode.connect(feedbackNode).connect(delayNode);
        delayNode.connect(wetNode).connect(context.destination);
        filterNodes.current.push(filterNode);
        wetNodes.current.push(wetNode);
      }
    }
    await audioContext.current.resume();
  }

  async function transitionToNext() {
    if (tracks.length < 2) return;
    const outgoing = activeDeck === "A" ? deckA.current : deckB.current;
    const incoming = activeDeck === "A" ? deckB.current : deckA.current;
    if (!outgoing || !incoming) return;
    incoming.currentTime = 0; incoming.volume = 0; await ensureAudioGraph(); await incoming.play();
    const started = performance.now(), duration = 6000;
    const fade = window.setInterval(() => {
      const progress = Math.min(1, (performance.now() - started) / duration);
      outgoing.volume = Math.cos(progress * Math.PI * 0.5); incoming.volume = Math.sin(progress * Math.PI * 0.5);
      setCrossfade(activeDeck === "A" ? Math.round(progress * 100) : Math.round((1 - progress) * 100));
      if (progress >= 1) { window.clearInterval(fade); outgoing.pause(); outgoing.currentTime = 0; setQueueIndex((value) => (value + 1) % tracks.length); setActiveDeck((value) => value === "A" ? "B" : "A"); setStatus("AI DJ completed a smooth six-second transition."); }
    }, 80);
  }

  const queue = useMemo(() => tracks.slice(queueIndex, queueIndex + 6).concat(tracks.slice(0, Math.max(0, 6 - (tracks.length - queueIndex)))), [tracks, queueIndex]);

  return <div className="ai-dj">
    <section className="ai-dj-hero"><div><span><Sparkles /> SENTINEL AI DJ</span><h2>Intelligent mixing, without losing control.</h2><p>Build a continuous set, shape transitions and run effects from one performance deck.</p></div><div className="ai-dj-source"><button className={source === "local" ? "active" : ""} onClick={() => setSource("local")}><FolderOpen /> Local library</button><button className={source === "tidal" ? "active" : ""} onClick={() => setSource("tidal")}><AudioWaveform /> TIDAL DJ</button><button className={source === "spotify" ? "active" : ""} onClick={() => setSource("spotify")}><Radio /> Spotify</button></div></section>
    {source === "tidal" ? <section className="tidal-setup">
      <header><div className="spotify-mark"><Disc3 /></div><div><span>TIDAL DJ + VIRTUALDJ</span><h3>Streaming DJ setup</h3><p>Your TIDAL password remains inside VirtualDJ. Sentinel only detects and controls the approved DJ application.</p></div><button className="tidal-refresh" onClick={() => void refreshVirtualDJ()}><RefreshCw /> Recheck</button></header>
      <div className="tidal-steps">
        <article className={virtualDJ?.installed ? "complete" : ""}><b>{virtualDJ?.installed ? <CheckCircle2 /> : <Download />} 1. VirtualDJ</b><p>{virtualDJ?.installed ? "VirtualDJ detected on this computer." : "Install VirtualDJ to provide licensed decks, effects and TIDAL playback."}</p><button onClick={async () => { await window.sentinelDesktop?.launchVirtualDJ(); window.setTimeout(() => void refreshVirtualDJ(), 1800); }}>{virtualDJ?.installed ? "Open VirtualDJ" : "Download VirtualDJ"}</button></article>
        <article className={tidalConfirmed ? "complete" : ""}><b>{tidalConfirmed ? <CheckCircle2 /> : <Radio />} 2. Connect TIDAL</b><p>In VirtualDJ open Online Music, choose TIDAL and sign in to your TIDAL DJ account.</p><button disabled={!virtualDJ?.installed} onClick={() => { const next = !tidalConfirmed; setTidalConfirmed(next); localStorage.setItem("sentinel.ai-dj.tidal-confirmed", String(next)); }}>{tidalConfirmed ? "TIDAL sign-in confirmed" : "I have connected TIDAL"}</button></article>
        <article className={virtualDJ?.bridge === "connected" ? "complete" : ""}><b>{virtualDJ?.bridge === "connected" ? <CheckCircle2 /> : <Waves />} 3. Network Control</b><p>In VirtualDJ install <b>Network Control</b> from Config → Extensions → Effects → Other, enable it from Master Effects, then use the same local port and password below.</p><div className="tidal-bridge-fields"><input aria-label="VirtualDJ bridge port" type="number" min="1024" max="65535" value={bridgePort} onChange={(event) => setBridgePort(Number(event.target.value))} /><input aria-label="VirtualDJ bridge password" type="password" value={bridgePassword} placeholder={virtualDJ?.bridgeConfigured ? "Saved password (leave blank to keep)" : "Optional bridge password"} onChange={(event) => setBridgePassword(event.target.value)} /></div><button disabled={!virtualDJ?.installed || !tidalConfirmed || bridgeBusy} onClick={() => void configureBridge()}>{bridgeBusy ? "Testing..." : virtualDJ?.bridge === "connected" ? "Retest bridge" : "Save and test bridge"}</button></article>
      </div>
      {bridgeMessage && <p className={virtualDJ?.bridge === "connected" ? "tidal-bridge-message connected" : "tidal-bridge-message"}>{bridgeMessage}</p>}
      {virtualDJ?.bridge === "connected" && <div className="virtualdj-console">
        <header><div><span>LIVE VIRTUALDJ BRIDGE</span><h3>Sentinel performance deck</h3><p>Authoritative live state from VirtualDJ · controls remain local and licensed playback stays inside VirtualDJ.</p></div><div className="deck-sync-state"><i /><span>SYNCED LIVE<small>{virtualDJ.sampledAt ? `Updated ${new Date(virtualDJ.sampledAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}` : "Reading decks"}</small></span><button onClick={() => void refreshVirtualDJ()}><RefreshCw /> Sync now</button></div></header>
        <section className={`sentinel-show-director ${showState}`}>
          <div><span>SENTINEL SHOW DIRECTOR</span><h3>{showState === "live" ? "AI show running" : showState === "paused" ? "Show paused" : showState === "prepared" ? "Playlist preparation" : "One-button DJ operation"}</h3><p>Sentinel delegates beat analysis, cue points and licensed TIDAL playback to VirtualDJ, then gives you simple show-level controls.</p></div>
          <div className="show-director-primary"><button onClick={() => void runShowAction("prepareShow")}><ListMusic /> 1. Load playlist</button>{showState === "live" ? <button onClick={() => void runShowAction("pauseShow")}><Pause /> Pause show</button> : <button className="go-live" onClick={() => void runShowAction("startShow")}><Play /> {showState === "paused" ? "Resume AI show" : "2. Start AI show"}</button>}<button className="danger" onClick={() => void runShowAction("endShow")}><Square /> End show</button></div>
          <div className="show-director-live"><button disabled={showState !== "live"} onClick={() => void runShowAction("cueNext")}><SkipForward /> Cue next mix</button><button disabled={showState !== "live"} onClick={() => void runShowAction("transitionFx")}><AudioWaveform /> FX transition</button><button disabled={showState !== "live"} onClick={() => void runShowAction("energyBoost")}><Sparkles /> Energy boost</button></div>
          <small>For streamed music, first add tracks from TIDAL to VirtualDJ’s Automix list. Sentinel cannot bypass TIDAL’s licensed player.</small>
        </section>
        <div className="virtualdj-decks">{[1, 2].map((number) => <LiveDeck key={number} number={number} deck={virtualDJ.decks?.find((item) => item.deck === String(number))} busy={[...commandBusy].some((key) => key.endsWith(`:${number}`))} onCommand={(command, deck) => void runVirtualDJCommand(command, deck)} />)}</div>
        <section className="performance-mixer"><header><div><small>MASTER PERFORMANCE</small><strong>SENTINEL MIXER</strong></div><span><Clock3 />1 SECOND LIVE SYNC</span></header><div className="mixer-channel"><b>A</b><div className="vu-meter">{Array.from({ length: 14 }, (_, index) => <i key={index} className={index < (virtualDJ.decks?.[0]?.playing === "yes" ? 11 : 2) ? "on" : ""} />)}</div></div><div className="mixer-crossfader"><label><span>DECK A</span><b>CROSSFADER</b><span>DECK B</span></label><div><i style={{ left: `${Math.max(0, Math.min(100, numericValue(virtualDJ.crossfader) * (String(virtualDJ.crossfader).includes("%") ? 1 : 100)))}%` }} /></div><small>Position follows VirtualDJ</small></div><div className="mixer-channel"><b>B</b><div className="vu-meter">{Array.from({ length: 14 }, (_, index) => <i key={index} className={index < (virtualDJ.decks?.[1]?.playing === "yes" ? 11 : 2) ? "on" : ""} />)}</div></div></section>
        <div className="virtualdj-master-actions"><button disabled={commandBusy.size > 0} onClick={() => void runVirtualDJCommand("automix")}><Shuffle /> AutoMix</button><button disabled={commandBusy.size > 0} onClick={() => void runVirtualDJCommand("mixNext")}><SkipForward /> Cue next</button><button className="mix-now" disabled={commandBusy.size > 0} onClick={() => void runVirtualDJCommand("mixNow")}><Sparkles /> Mix now</button><button disabled={commandBusy.size > 0} onClick={() => void runVirtualDJCommand("skip")}><SkipForward /> Skip</button><button className="danger" disabled={commandBusy.size > 0} onClick={() => void runVirtualDJCommand("stop")}><Square /> Emergency stop</button></div>
      </div>}
    </section> : source === "spotify" ? <section className="spotify-dj-mode"><div className="spotify-mark"><Disc3 /></div><div><span>SPOTIFY PLAYBACK MODE</span><h3>Spotify remains available for listening.</h3><p>Sentinel opens Spotify and controls its active session. Full streamed mixing and effects use TIDAL DJ through VirtualDJ.</p></div><button onClick={() => void window.sentinelDesktop?.openMediaService("https://open.spotify.com/")}>Open Spotify</button></section> : <>
      <section className="dj-decks"><article className={activeDeck === "A" ? "active" : ""}><span>DECK A</span><Disc3 /><h3>{activeDeck === "A" ? currentTrack?.name ?? "No track loaded" : nextTrack?.name ?? "Standby"}</h3></article><div className="dj-centre-controls"><label className="dj-folder-button"><FolderOpen /> Choose music folder<input type="file" multiple accept="audio/*,.flac" onChange={(event) => importTracks(event.target.files)} {...({ webkitdirectory: "" } as React.InputHTMLAttributes<HTMLInputElement>)} /></label><button className="dj-play" disabled={!tracks.length} onClick={() => void togglePlayback()}>{playing ? <Pause /> : <Play />}{playing ? "Pause set" : "Start set"}</button><button disabled={tracks.length < 2} onClick={() => void transitionToNext()}><SkipForward /> Mix next</button></div><article className={activeDeck === "B" ? "active" : ""}><span>DECK B</span><Disc3 /><h3>{activeDeck === "B" ? currentTrack?.name ?? "No track loaded" : nextTrack?.name ?? "Standby"}</h3></article><audio ref={deckA} src={(activeDeck === "A" ? currentTrack : nextTrack)?.url} /><audio ref={deckB} src={(activeDeck === "B" ? currentTrack : nextTrack)?.url} /></section>
      <section className="dj-mixer"><div><label>Crossfader <b>{crossfade}%</b></label><input type="range" min="0" max="100" value={crossfade} onChange={(event) => setCrossfade(Number(event.target.value))} /></div><div><label>Filter <b>{filter}%</b></label><input type="range" min="0" max="100" value={filter} onChange={(event) => setFilter(Number(event.target.value))} /></div><div><label>Echo <b>{echo}%</b></label><input type="range" min="0" max="100" value={echo} onChange={(event) => setEcho(Number(event.target.value))} /></div><button className={autoDJ ? "active" : ""} onClick={() => setAutoDJ((value) => !value)}><Shuffle /> Auto DJ {autoDJ ? "on" : "off"}</button></section>
      <section className="dj-queue"><header><div><ListMusic /><span><b>Intelligent queue</b><small>{status}</small></span></div><strong>{tracks.length} tracks</strong></header><div>{queue.map((track, index) => <article key={track.id}><span>{index + 1}</span><AudioWaveform /><b>{track.name}</b><small>{index === 0 ? "Playing" : "Queued"}</small></article>)}</div></section>
    </>}
  </div>;
}
