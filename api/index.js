require("dotenv").config();
const express = require("express");
const cors = require("cors");
const axios = require("axios");
const cheerio = require("cheerio");
const { createClient } = require("@supabase/supabase-js");

const app = express();

// Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY,
);

async function groundingSearch(query) {
  try {
    const res = await axios.post(
      "https://google.serper.dev/search",
      { q: query, gl: "id", hl: "id", num: 3 },
      {
        headers: {
          "X-API-KEY": process.env.SERPER_API_KEY,
          "Content-Type": "application/json",
        },
        timeout: 5000,
      },
    );
    const results = res.data.organic || [];
    return results
      .map((r) => `- ${r.title}: ${r.snippet} (${r.link})`)
      .join("\n");
  } catch {
    return null;
  }
}

app.use(cors());
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ limit: "10mb", extended: true }));

const SYSTEM_PROMPT = `Kamu adalah AI asisten pendeteksi hoaks dan pemeriksa fakta yang ahli. Tugasmu adalah menganalisis konten berbahasa Indonesia (teks, judul berita, atau postingan media sosial) dan menentukan apakah konten tersebut kemungkinan merupakan hoaks, disinformasi, atau informasi yang kredibel.

## PRINSIP DASAR
- Berita terkini yang tidak bisa kamu verifikasi = PERLU_VERIFIKASI, BUKAN HOAKS
- Artikel dari media resmi dengan struktur jurnalistik = condong ke KEMUNGKINAN_BENAR
- HOAKS hanya jika ada indikator kuat disinformasi yang disengaja, BUKAN sekadar tidak familiar
- Jangan hukum konten hanya karena kamu tidak punya data real-time tentangnya

## KERANGKA ANALISISMU
Untuk setiap input, analisis berdasarkan dimensi berikut:

### 1. IDENTIFIKASI KLAIM
- Ekstrak klaim faktual utama yang disampaikan
- Identifikasi siapa/apa/kapan/di mana yang diklaim
- Catat angka, statistik, atau kutipan spesifik yang disebutkan

### 2. DETEKSI TANDA BAHAYA
Periksa indikator hoaks yang umum — hanya nilai sebagai tanda bahaya jika benar-benar mencurigakan:
- Bahasa yang memancing emosi ekstrem ("DARURAT!", "SEGERA SEBARKAN!", "VIRAL!!!")
- Sumber yang samar atau tidak bisa diverifikasi ("katanya", "menurut sumber terpercaya", "beredar kabar")
- Inkonsistensi logis atau klaim yang tidak masuk akal secara fisik/ilmiah
- Tidak ada tanggal, nama, atau referensi sama sekali
- Membangkitkan rasa takut berlebihan atau teori konspirasi tanpa bukti
- Format sangat tidak wajar: huruf kapital semua, tanda seru berlebihan, emoji berlebihan

### 3. SINYAL KREDIBILITAS
Nilai sinyal positif yang menunjukkan konten kredibel:
- Struktur penulisan jurnalistik yang baik (ada narasumber, tanggal, konteks)
- Menyebut nama pejabat, lembaga, atau institusi resmi yang spesifik
- Bahasa formal dan tidak sensasional
- Ada data, angka, atau kutipan yang bisa ditelusuri
- Berasal dari domain media yang dikenal (detik, kompas, cnbc, tribun, dll)
- Konten konsisten secara logis dan kronologis

### 4. KELAYAKAN KONTEKSTUAL
- Apakah klaim ini masuk akal secara logis dan ilmiah?
- Apakah linimasa atau geografinya konsisten?
- Apakah ada kontradiksi internal dalam konten?

## PANDUAN VERDICT (urutan prioritas)
1. TIDAK_DAPAT_DINILAI — input terlalu pendek, samar, atau bukan klaim faktual
2. HOAKS — fakta jelas salah + bahasa provokatif/manipulatif yang disengaja
3. DISINFORMASI — klaim yang MENYEBUT institusi resmi (WHO, BPOM, dll) namun isinya berlebihan, tidak akurat, atau keluar konteks. Contoh: "WHO buktikan X menyebabkan kanker" tanpa dasar ilmiah yang kuat
4. PERLU_VERIFIKASI — klaim spesifik dari sumber kredibel yang tidak bisa dikonfirmasi real-time (angka, statistik, kebijakan terkini)
5. KEMUNGKINAN_BENAR — struktur jurnalistik solid, narasumber jelas, klaim masuk akal, tidak ada keraguan

## FORMAT OUTPUT
Jawab HANYA dengan objek JSON berikut, tanpa teks lain:
{"verdict":"[HOAKS | DISINFORMASI | PERLU_VERIFIKASI | KEMUNGKINAN_BENAR | TIDAK_DAPAT_DINILAI]","confidence":<angka 0-100>,"ringkasan":"<ringkasan verdict 1-2 kalimat>","klaim_utama":"<klaim utama yang diekstrak dari input>","tanda_bahaya":["<tanda 1>","<tanda 2>"],"sinyal_positif":["<sinyal 1>","<sinyal 2>"],"penalaran":"<penalaran langkah demi langkah yang detail, 3-5 kalimat>","rekomendasi":"<apa yang harus dilakukan pengguna: cek di mana, verifikasi bagaimana>"}

## ATURAN PENTING
- Jangan pernah mengarang fakta atau mengklaim telah mengecek sumber eksternal secara real-time
- Ketidaktahuan AI tentang suatu berita BUKAN alasan untuk menilai HOAKS
- Selalu bersikap netral dan tidak berpihak secara politik
- Jawab HANYA dengan objek JSON — tanpa kalimat pembuka, tanpa markdown
- Jika konten menyebut angka, statistik, atau kebijakan spesifik yang tidak bisa dikonfirmasi secara real-time, WAJIB gunakan PERLU_VERIFIKASI
- Jika konten mengandung sebagian fakta benar dan sebagian tidak bisa diverifikasi, gunakan DISINFORMASI bukan HOAKS
- KEMUNGKINAN_BENAR hanya untuk konten yang benar-benar kredibel DAN tidak mengandung klaim yang perlu dicek lebih lanjut
- Jangan terlalu mudah memberi KEMUNGKINAN_BENAR — jika ada keraguan sekecil apapun, gunakan PERLU_VERIFIKASI
- Confidence di bawah 70% HARUS menghasilkan PERLU_VERIFIKASI, bukan KEMUNGKINAN_BENAR atau HOAKS
- Kamu mungkin tidak memiliki data training untuk peristiwa setelah Desember 2025. Jika diberikan "Konteks dari pencarian web terkini", PRIORITASKAN konteks tersebut
- JANGAN menyebut suatu peristiwa "belum terjadi" atau "masa depan" jika konteks web menunjukkan peristiwa tersebut sudah ada liputannya.

## CONTOH KLASIFIKASI
- "WHO buktikan mie instan sebabkan kanker dari studi 50 negara" → DISINFORMASI (klaim institusi resmi tapi tidak berdasar)
- "Sri Mulyani: defisit APBN 2,3% di Q1 2025" → PERLU_VERIFIKASI (klaim spesifik, tidak bisa dicek real-time)
- "SEBARKAN!! Rekening diblokir besok!!" → HOAKS (manipulatif, tidak masuk akal)`;

// POST /api/scrape
app.post("/api/scrape", async (req, res) => {
  const { url } = req.body;
  if (!url || !url.trim())
    return res.status(400).json({ error: "URL tidak boleh kosong" });

  try {
    const response = await axios.get(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "id-ID,id;q=0.9,en-US;q=0.8",
      },
      timeout: 10000,
    });
    const $ = cheerio.load(response.data);
    $("script, style, nav, footer, header, aside, iframe").remove();

    const title = $("title").text().trim();
    const paragraphs = $("p")
      .map((_, el) => $(el).text().trim())
      .get()
      .filter((p) => p.length > 50);
    const content = paragraphs.slice(0, 5).join("\n\n").slice(0, 3000);

    if (!content)
      return res
        .status(422)
        .json({ error: "Gagal mengekstrak konten dari URL ini." });

    res.json({ title, content: `${title}\n\n${content}` });
  } catch (err) {
    res
      .status(500)
      .json({ error: "Gagal mengambil konten dari URL. Coba URL lain." });
  }
});

// POST /api/analyze
app.post("/api/analyze", async (req, res) => {
  const { text, input_text } = req.body;
  if (!text || !text.trim()) {
    return res.status(400).json({ error: "Teks tidak boleh kosong" });
  }

  try {
    const searchQuery = (input_text || text).slice(0, 200);
    const groundingContext = await groundingSearch(searchQuery);

    const userMessage = groundingContext
      ? `Konteks dari pencarian web terkini:\n${groundingContext}\n\nKonten yang dianalisis:\n${text.trim()}`
      : text.trim();

    const response = await axios.post(
      "https://api.deepseek.com/chat/completions",
      {
        model: "deepseek-chat",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userMessage },
        ],
        max_tokens: 1000,
        temperature: 0.3,
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.DEEPSEEK_API_KEY}`,
          "Content-Type": "application/json",
        },
        timeout: 30000,
      },
    );

    const raw = response.data.choices[0].message.content;
    const clean = raw.replace(/```json|```/g, "").trim();
    const result = JSON.parse(clean);

    // Simpan ke Supabase
    const { error: dbError } = await supabase.from("detections").insert({
      input_text: (input_text || text).slice(0, 500),
      verdict: result.verdict,
      confidence: result.confidence,
      ringkasan: result.ringkasan,
      klaim_utama: result.klaim_utama,
      tanda_bahaya: result.tanda_bahaya,
      sinyal_positif: result.sinyal_positif,
      penalaran: result.penalaran,
      rekomendasi: result.rekomendasi,
    });

    if (dbError) console.error("Supabase insert error:", dbError.message);

    return res.json(result);
  } catch (err) {
    console.error("DeepSeek error:", err.response?.data || err.message);
    if (err.response?.status === 401) {
      return res
        .status(401)
        .json({ error: "API key tidak valid. Cek file .env kamu." });
    }
    return res
      .status(500)
      .json({ error: "Gagal menganalisis konten. Coba lagi." });
  }
});

// GET /api/history — ambil histori deteksi
app.get("/api/history", async (req, res) => {
  const { data, error } = await supabase
    .from("detections")
    .select("id, created_at, input_text, verdict, confidence")
    .order("created_at", { ascending: false })
    .limit(20);

  if (error) return res.status(500).json({ error: "Gagal mengambil histori." });
  res.json(data);
});

// GET /api/stats — statistik verdict
app.get("/api/stats", async (req, res) => {
  const { data, error } = await supabase.from("detections").select("verdict");

  if (error)
    return res.status(500).json({ error: "Gagal mengambil statistik." });

  const counts = {
    HOAKS: 0,
    DISINFORMASI: 0,
    PERLU_VERIFIKASI: 0,
    KEMUNGKINAN_BENAR: 0,
    TIDAK_DAPAT_DINILAI: 0,
    total: data.length,
  };

  data.forEach(({ verdict }) => {
    if (counts[verdict] !== undefined) counts[verdict]++;
  });

  res.json(counts);
});

app.get("/", (req, res) => {
  res.json({ message: "Server CekHoaks berjalan!" });
});

app.get("/api/health", (req, res) => {
  res.json({ status: "ok", deepseek_key: !!process.env.DEEPSEEK_API_KEY });
});

module.exports = app;
