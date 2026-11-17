import { spawn } from "node:child_process";
import { existsSync } from "node:fs";

/** Resolve ffmpeg: explicit env, system binary, or Playwright's bundled build (VP8/WebM capable). */
export function ffmpegPath(): string {
  if (process.env.FFMPEG_PATH) return process.env.FFMPEG_PATH;
  for (const p of ["/usr/bin/ffmpeg", "/usr/local/bin/ffmpeg", "/opt/pw-browsers/ffmpeg-1011/ffmpeg-linux"]) if (existsSync(p)) return p;
  return "ffmpeg";
}

/** Argument vector only — never a shell string (no interpolation of user data). */
export function encoderArgs(fps: number): string[] {
  if (![24, 25, 30, 60].includes(fps)) throw new Error("Unsupported fps");
  return [
    "-hide_banner", "-loglevel", "error",
    "-f", "image2pipe", "-c:v", "mjpeg", "-framerate", String(fps), "-i", "pipe:0",
    "-c:v", "libvpx", "-b:v", "2M", "-crf", "10", "-deadline", "realtime", "-cpu-used", "8",
    "-pix_fmt", "yuv420p", "-an", "-f", "webm", "pipe:1",
  ];
}

export interface Encoder { write(jpeg: Buffer): Promise<void>; finish(): Promise<Buffer>; kill(): void }

export function startEncoder(fps: number, timeoutMs: number): Encoder {
  const proc = spawn(ffmpegPath(), encoderArgs(fps), { stdio: ["pipe", "pipe", "pipe"], shell: false });
  const out: Buffer[] = [];
  let err = "";
  proc.stdout.on("data", (d: Buffer) => out.push(d));
  proc.stderr.on("data", (d: Buffer) => { err = (err + d.toString()).slice(-2000); });
  const timer = setTimeout(() => proc.kill("SIGKILL"), timeoutMs);
  const done = new Promise<Buffer>((resolve, reject) => {
    proc.on("error", reject);
    proc.on("close", (code) => { clearTimeout(timer); code === 0 ? resolve(Buffer.concat(out)) : reject(new Error(`encoder exited ${code}: ${err.trim().slice(0, 200)}`)); });
  });
  done.catch(() => undefined); // killed encoders reject; callers that need the result await finish()
  return {
    write: (jpeg) => new Promise((res, rej) => proc.stdin.write(jpeg, (e) => (e ? rej(e) : res()))),
    finish: () => { proc.stdin.end(); return done; },
    kill: () => { clearTimeout(timer); proc.kill("SIGKILL"); },
  };
}
