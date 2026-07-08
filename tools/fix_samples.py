import re, base64, io, math, struct, pathlib

def build_wav(samples, rate=22050, bits=16):
    # samples: list of floats in [-1, 1]
    max_val = (1 << (bits - 1)) - 1
    data = b"".join(struct.pack("<h", int(max( -1, min(1, s)) * max_val)) for s in samples)
    byte_rate = rate * bits // 8
    block_align = bits // 8
    chunk_size = 36 + len(data)
    header = b"RIFF" + struct.pack("<I", chunk_size) + b"WAVEfmt "
    header += struct.pack("<IHHIIHH", 16, 1, 1, rate, byte_rate, block_align, bits)
    header += b"data" + struct.pack("<I", len(data)) + data
    return header

def make_kick():
    rate = 22050
    duration = 0.18
    n = int(rate * duration)
    out = []
    for i in range(n):
        t = i / rate
        freq = 150 * math.exp(-t / 0.08)
        env = math.exp(-t / 0.12)
        out.append(math.sin(2 * math.pi * freq * t) * env * 0.9)
    return build_wav(out, rate)

def make_snare():
    rate = 22050
    duration = 0.15
    n = int(rate * duration)
    out = []
    for i in range(n):
        t = i / rate
        noise = (hash(str(i)) % 1000) / 500.0 - 1.0
        env = math.exp(-t / 0.05)
        tone = math.sin(2 * math.pi * 180 * t) * env * 0.3
        out.append((noise * env * 0.5 + tone) * 0.9)
    return build_wav(out, rate)

def make_hihat():
    rate = 22050
    duration = 0.05
    n = int(rate * duration)
    out = []
    for i in range(n):
        t = i / rate
        noise = (hash(str(i * 3 + 1)) % 1000) / 500.0 - 1.0
        env = math.exp(-t / 0.015)
        # high-pass-ish by attenuating low frequencies via simple difference (approx)
        val = (noise - (0 if i == 0 else noise)) * env
        out.append(noise * env * 0.6)
    return build_wav(out, rate)

def to_data_url(data):
    return "data:audio/wav;base64," + base64.b64encode(data).decode("ascii")

samples = {
    "kick": make_kick(),
    "snare": make_snare(),
    "hihat": make_hihat(),
}

src = pathlib.Path("src/audio.ts").read_text(encoding="utf-8")
# Replace the whole EMBEDDED_SAMPLES object body
pattern = re.compile(r"export const EMBEDDED_SAMPLES: Record<string, string> = \{[\s\S]*?\};", re.MULTILINE)
replacement = "export const EMBEDDED_SAMPLES: Record<string, string> = {\n" + ",\n".join(
    f"  {k}: '{to_data_url(v)}'" for k, v in samples.items()
) + "\n};"
if not pattern.search(src):
    raise SystemExit("Could not find EMBEDDED_SAMPLES object")
new_src = pattern.sub(replacement, src)
pathlib.Path("src/audio.ts").write_text(new_src, encoding="utf-8")
print("Replaced embedded samples")
