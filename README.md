# Interview Agen AI

Produk **Interview Agen AI** untuk hackathon **Sprout Digital Employee**: agen wawancara suara **multipurpose** yang **terintegrasi dengan website Jobseeker** — perusahaan mengatur lowongan dan rubrik pertanyaan di platform, kandidat masuk ke sesi audio lewat alur yang sama.

## Ringkasan

Agen berjalan sebagai worker [LiveKit Agents](https://docs.livekit.io/agents/) yang bergabung ke room LiveKit, mendengarkan ucapan pengguna, memproses respons dengan LLM, dan membalas dengan suara sintetis. Integrasi Jobseeker biasanya menyalurkan **konteks lowongan** (judul posisi, perusahaan, bahasa, daftar pertanyaan) ke sesi agen (misalnya lewat metadata room atau API pendamping) sehingga satu codebase dapat mewawancarai banyak jenis role dan locale.

## Prasyarat

- [Node.js](https://nodejs.org/) ≥ 22
- [pnpm](https://pnpm.io/) ≥ 10
- Akun/proyek [LiveKit Cloud](https://cloud.livekit.io/) (atau server LiveKit kompatibel) dan kredensial API
- Akses inference yang dikonfigurasi di LiveKit (Deepgram, OpenAI, Cartesia sesuai proyek Anda)
- Situs atau backend **Jobseeker** yang membuat room / token dan (disarankan) mengirim konteks lowongan ke agen

## Konfigurasi

Variabel lingkungan umum (misalnya di `.env.local`):

- `LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET` — koneksi ke LiveKit
- `STT_LANGUAGE` — opsional, kode bahasa untuk STT (default `multi` untuk banyak bahasa). Contoh: `en`, `id`, `multi`
- Opsional: `TRANSCRIPT_API_URL`, `TRANSCRIPT_API_TOKEN` — kirim transkrip ke API eksternal (misalnya untuk rekap di dashboard Jobseeker)

Detail lebih lanjut ada di [AGENTS.md](./AGENTS.md) dan dokumentasi LiveKit.

## Perintah

```bash
pnpm install
pnpm build
pnpm dev      # build + jalankan mode dev
pnpm start    # jalankan dari dist (setelah build)
pnpm test
pnpm lint
pnpm format
```

## Struktur kode

- `src/main.ts` — definisi agen, sesi suara, STT/LLM/TTS, dan logika room
- `src/agent.ts` — instruksi pewawancara multipurpose (mengikuti konteks lowongan dari integrasi Jobseeker bila tersedia)
- File pendukung: pengaturan giliran bicara, akhir percakapan, transkrip, dll.

## Lisensi / hackathon

Dibuat dalam konteks hackathon Sprout Digital Employee; sesuaikan lisensi dan branding dengan kebutuhan tim Anda.
