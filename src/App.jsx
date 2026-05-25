import { useState, useEffect } from 'react';
// นำเข้าฐานข้อมูล Firebase
import { initializeApp } from 'firebase/app';
import {
  getDatabase,
  ref,
  get,
  runTransaction,
  onValue,
} from 'firebase/database';

// ══════════════════════════════════════════════
// 🔧 1. แก้ไขข้อมูลและใส่รหัส Firebase ตรงนี้
// ══════════════════════════════════════════════
const RESULTS_SECRET = 'results-2569'; // ตัวเลขท้ายลิ้งค์สำหรับดูผล เช่น .vercel.app/#results-2569
const VOTE_HEADING = 'กีฬาสีปีนี้...คุณเลือกอะไร?'; // หัวข้อโหวต

// นำข้อความคัดลอกจาก Firebase Console มาวางแทนที่ตรงนี้ (ดูวิธีทำด้านล่าง)
const firebaseConfig = {
  apiKey: 'AIzaSyCtlPaUxSdnvHr2dBX3y9qyvxivC7G3OTo',
  authDomain: 'vote2569-f2f20.firebaseapp.com',
  databaseURL:
    'https://vote2569-f2f20-default-rtdb.asia-southeast1.firebasedatabase.app',
  projectId: 'vote2569-f2f20',
  storageBucket: 'vote2569-f2f20.firebasestorage.app',
  messagingSenderId: '1085343594021',
  appId: '1:1085343594021:web:3c9490c6c139ef350771cc',
  measurementId: 'G-LZ4NED8E3W',
};

const CHOICES = [
  {
    id: 'A',
    label: 'มนต์รักไทบ้าน',
    desc: 'ย้อนยุค ผู้ใหญ่ลี (พ.ศ.2504) และทองกวาวมนต์รักลูกทุ่ง (พ.ศ.2570) ผสมผสานสไตล์ไทบ้านอีสานมักม่วน',
    image:
      'https://i.postimg.cc/qB5Rprzk/Gemini-Generated-Image-s7czx9s7czx9s7cz.png',
    video:
      'https://player.vdocipher.com/v2/?otp=20160313versASE3232KGuNVgdgNLykFjcK3FrPkqHC89IFXYSsNH8p09fNPBKYp&playbackInfo=eyJ2aWRlb0lkIjoiNWU4NWQ3M2EyNmRmNDIyNWFlZTdhMmU1MzhmOGRlN2QifQ==',
    primary: '#E8315B',
    light: '#FFF0F3',
    dark: '#A0122E',
  },
  {
    id: 'B',
    label: 'ชุดประจำชาติ',
    desc: 'จำลอง Final walk รอบชุดประจำชาติ อยากแต่งเป็นชาติใดในโลก ก็เอาให้สุด',
    image:
      'https://i.postimg.cc/JhrDGqmJ/Chat-GPT-Image-22-ph-kh-2569-16-11-35.png',
    video:
      'https://player.vdocipher.com/v2/?otp=20160313versASE3232mOKt1BFFbW5UeXdK5sc1slavxEpbg3iR9zBfCukHY8nKv&playbackInfo=eyJ2aWRlb0lkIjoiZTM1YzFmMDYzOTc3NGVmMmE1NTkwNGI4ZDUyODNlOGMifQ==',
    primary: '#2563EB',
    light: '#EFF6FF',
    dark: '#1E40AF',
  },
];
// ══════════════════════════════════════════════

// เริ่มการทำงานของ Firebase
const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const LOCAL_VOTE_KEY = 'user_has_voted_locally';

export default function VoteApp() {
  const [page, setPage] = useState('loading');
  const [counts, setCounts] = useState({ A: 0, B: 0 });
  const [votedFor, setVotedFor] = useState(null);
  const [submitting, setSubmitting] = useState(null);

  useEffect(() => {
    // เช็คว่าเคยโหวตไปหรือยังจากเครื่องนี้
    const localVote = localStorage.getItem(LOCAL_VOTE_KEY);

    // จัดการเส้นทางหน้าเว็บจาก Hash (#)
    const handleHashChange = () => {
      const hash = window.location.hash.replace('#', '');
      if (hash === RESULTS_SECRET) {
        setPage('results');
      } else if (localVote) {
        setVotedFor(localVote);
        setPage('thanks');
      } else {
        setPage('vote');
      }
    };

    // โหลดคะแนนครั้งแรก
    const votesRef = ref(db, 'votes');
    get(votesRef)
      .then((snapshot) => {
        if (snapshot.exists()) {
          const data = snapshot.val();
          setCounts({ A: data.A || 0, B: data.B || 0 });
        }
        handleHashChange();
      })
      .catch(() => {
        handleHashChange();
      });

    // ดักฟังคะแนนแบบ Real-time (ถ้าอยู่หน้าผลลัพธ์ คะแนนจะอัปเดตอัตโนมัติ)
    const unsubscribe = onValue(votesRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val();
        setCounts({ A: data.A || 0, B: data.B || 0 });
      }
    });

    window.addEventListener('hashchange', handleHashChange);
    return () => {
      window.removeEventListener('hashchange', handleHashChange);
      unsubscribe();
    };
  }, []);

  const handleVote = async (id) => {
    if (submitting) return;
    setSubmitting(id);

    const choiceRef = ref(db, `votes/${id}`);
    try {
      // ใช้ Transaction เพื่อป้องกันปัญหาคนกดพร้อมกันแล้วคะแนนไม่ขึ้น
      await runTransaction(choiceRef, (currentValue) => {
        return (currentValue || 0) + 1;
      });

      localStorage.setItem(LOCAL_VOTE_KEY, id);
      setVotedFor(id);
      setPage('thanks');
    } catch (error) {
      alert('เกิดข้อผิดพลาดในการส่งคะแนน กรุณาลองใหม่อีกครั้ง');
    }
    setSubmitting(null);
  };

  if (page === 'loading') return <LoadingScreen />;
  if (page === 'vote')
    return <VotePage onVote={handleVote} submitting={submitting} />;
  if (page === 'thanks')
    return (
      <ThanksPage
        choice={CHOICES.find((c) => c.id === votedFor)}
        counts={counts}
      />
    );
  if (page === 'results') return <ResultsPage counts={counts} />;
  return null;
}

// ── Loading ───────────────────────────────────
function LoadingScreen() {
  return (
    <div style={S.center}>
      <p style={{ fontSize: 24, color: '#666' }}>⏳ กำลังเข้าสู่ระบบโหวต...</p>
    </div>
  );
}

// ── Vote Page ─────────────────────────────────
function VotePage({ onVote, submitting }) {
  return (
    <div style={S.page}>
      <h1 style={S.heading}>{VOTE_HEADING}</h1>
      <p style={S.sub}>ดูรูปและคลิปสั้นๆ แล้วกดปุ่มโหวตด้านล่างได้เลยครับ</p>
      <div style={S.grid}>
        {CHOICES.map((c) => (
          <ChoiceCard
            key={c.id}
            choice={c}
            onVote={() => onVote(c.id)}
            loading={submitting === c.id}
            disabled={!!submitting}
          />
        ))}
      </div>
    </div>
  );
}

// ✅ 1. เอาฟังก์ชัน VideoPlayer มาแทรกตรงนี้ได้เลยครับ!
function VideoPlayer({ url }) {
  if (!url) return null;

  if (url.includes('vdocipher.com')) {
    return (
      <div
        style={{
          paddingTop: '56.25%',
          position: 'relative',
          width: '100%',
          marginBottom: 20,
        }}
      >
        <iframe
          src={url}
          style={{
            border: 0,
            maxWidth: '100%',
            position: 'absolute',
            top: 0,
            left: 0,
            height: '100%',
            width: '100%',
            borderRadius: 12,
          }}
          allowFullScreen={true}
          allow="encrypted-media"
        />
      </div>
    );
  }

  if (url.includes('youtube.com') || url.includes('youtu.be')) {
    let videoId = '';
    if (url.includes('youtu.be/')) {
      videoId = url.split('youtu.be/')[1]?.split(/[?#]/)[0];
    } else if (url.includes('v=')) {
      videoId = url.split('v=')[1]?.split(/[&#]/)[0];
    }
    return (
      <iframe
        src={`https://www.youtube.com/embed/${videoId}`}
        style={S.video}
        frameBorder="0"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
      />
    );
  }

  if (url.includes('drive.google.com')) {
    let fileId = '';
    if (url.includes('/d/')) {
      fileId = url.split('/d/')[1]?.split('/')[0];
    }
    return (
      <iframe
        src={`https://drive.google.com/file/d/${fileId}/preview`}
        style={S.video}
        frameBorder="0"
        allow="autoplay"
        allowFullScreen
      />
    );
  }

  return <video src={url} controls style={S.video} preload="metadata" />;
}

// ✅ 2. และนี่คือ ChoiceCard ตัวที่ปรับปรุงแล้ว (เอามาวางต่อท้าย VideoPlayer ได้เลย)
function ChoiceCard({ choice: c, onVote, loading, disabled }) {
  return (
    <div style={{ ...S.card, borderColor: c.primary, background: c.light }}>
      <div style={{ ...S.badge, background: c.primary }}>{c.label}</div>
      <img
        src={c.image}
        alt={c.label}
        style={S.img}
        onError={(e) => {
          e.target.style.display = 'none';
        }}
      />
      <p style={{ ...S.cardDesc, color: c.dark }}>{c.desc}</p>

      {/* เรียกใช้งานตัวเล่นวิดีโอ */}
      {c.video && <VideoPlayer url={c.video} />}

      <button
        onClick={onVote}
        disabled={disabled}
        style={{
          ...S.voteBtn,
          background: loading ? '#ccc' : c.primary,
          cursor: disabled ? 'not-allowed' : 'pointer',
        }}
      >
        {loading ? '⏳ กำลังบันทึกโหวต...' : `✅ กดโหวตที่นี่`}
      </button>
    </div>
  );
}

// ... (ด้านล่างต่อจากนี้จะเป็นฟังก์ชัน ThanksPage, ResultsPage และ Styles ตามเดิมครับ) ...

// ── Thanks Page ───────────────────────────────
function ThanksPage({ choice: c, counts }) {
  const total = counts.A + counts.B;
  return (
    <div style={S.center}>
      <div
        style={{ ...S.thanksBox, borderColor: c.primary, background: c.light }}
      >
        <div style={{ fontSize: 64, marginBottom: 12 }}>🎉</div>
        <h2 style={{ ...S.heading, color: c.primary }}>บันทึกโหวตเรียบร้อย!</h2>
        <p style={{ fontSize: 18, color: '#444' }}>
          ระบบได้นับคะแนนของคุณแล้ว ขอบคุณครับ
        </p>
        <div
          style={{
            margin: '20px 0',
            padding: '10px',
            background: '#fff',
            borderRadius: 12,
            border: `1px dashed ${c.primary}`,
          }}
        >
          <p style={{ fontSize: 16, margin: 0, color: '#666' }}>
            คุณได้โหวตให้:{' '}
            <strong style={{ color: c.primary }}>{c.label}</strong>
          </p>
        </div>
        <p style={{ fontSize: 14, color: '#888' }}>
          จำนวนผู้ร่วมโหวตทั้งหมดในขณะนี้: {total} คน
        </p>
      </div>
    </div>
  );
}

// ── Results Page ──────────────────────────────
function ResultsPage({ counts }) {
  const total = counts.A + counts.B || 1;
  const pctA = Math.round((counts.A / total) * 100);
  const pctB = Math.round((counts.B / total) * 100);

  return (
    <div style={S.page}>
      <h1 style={S.heading}>📊 ผลการโหวตปัจจุบัน</h1>
      <p
        style={{
          textAlign: 'center',
          fontSize: 18,
          color: '#555',
          marginBottom: 32,
        }}
      >
        คะแนนรวมทั้งหมด <strong>{counts.A + counts.B}</strong> โหวต
        (อัปเดตแบบเรียลไทม์)
      </p>
      {CHOICES.map((c) => {
        const count = counts[c.id];
        const pct = c.id === 'A' ? pctA : pctB;
        const isWin = c.id === 'A' ? counts.A >= counts.B : counts.B > counts.A;
        return (
          <div
            key={c.id}
            style={{
              ...S.resultRow,
              background: c.light,
              borderColor: c.primary,
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                marginBottom: 10,
              }}
            >
              <span
                style={{ ...S.badge, background: c.primary, marginBottom: 0 }}
              >
                {c.label}
              </span>
              {isWin && counts.A !== counts.B && (
                <span
                  style={{
                    fontSize: 14,
                    background: '#FFFBEB',
                    color: '#92400E',
                    border: '1px solid #FDE68A',
                    borderRadius: 20,
                    padding: '2px 12px',
                    fontWeight: 'bold',
                  }}
                >
                  🏆 คะแนนนำ
                </span>
              )}
              <span
                style={{
                  marginLeft: 'auto',
                  fontWeight: 700,
                  fontSize: 26,
                  color: c.primary,
                }}
              >
                {pct}%
              </span>
            </div>
            <div style={S.barBg}>
              <div
                style={{
                  ...S.barFill,
                  width: `${pct}%`,
                  background: c.primary,
                }}
              />
            </div>
            <p
              style={{
                marginTop: 8,
                fontSize: 16,
                color: c.dark,
                fontWeight: 'bold',
                margin: '8px 0 0',
              }}
            >
              {count.toLocaleString()} คะแนน
            </p>
          </div>
        );
      })}
    </div>
  );
}

// ── Styles (คงเดิมเพื่อความสวยงามและใช้งานง่าย) ────────────────
const S = {
  page: {
    maxWidth: 850,
    margin: '0 auto',
    padding: '20px 16px 40px',
    fontFamily: "'Sarabun', 'Prompt', sans-serif",
  },
  center: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '80vh',
    padding: '20px 16px',
    fontFamily: "'Sarabun', 'Prompt', sans-serif",
  },
  heading: {
    textAlign: 'center',
    fontSize: 'clamp(24px, 5vw, 34px)',
    fontWeight: 700,
    color: '#111',
    margin: '0 0 8px',
  },
  sub: { textAlign: 'center', fontSize: 16, color: '#666', margin: '0 0 24px' },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
    gap: 24,
  },
  card: {
    borderRadius: 20,
    border: '3px solid',
    padding: '20px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
  },
  badge: {
    color: '#fff',
    fontWeight: 700,
    fontSize: 18,
    borderRadius: 30,
    padding: '6px 24px',
    marginBottom: 14,
  },
  img: {
    width: '100%',
    borderRadius: 12,
    objectFit: 'cover',
    maxHeight: 200,
    marginBottom: 12,
  },
  cardDesc: {
    fontSize: 16,
    fontWeight: 600,
    textAlign: 'center',
    margin: '0 0 14px',
  },
  video: {
    width: '100%',
    borderRadius: 12,
    marginBottom: 20,
    maxHeight: 180,
    background: '#000',
  },
  voteBtn: {
    width: '100%',
    padding: '16px 0',
    borderRadius: 50,
    border: 'none',
    color: '#fff',
    fontSize: 18,
    fontWeight: 700,
    fontFamily: 'inherit',
  },
  thanksBox: {
    borderRadius: 24,
    border: '3px solid',
    padding: '40px 24px',
    textAlign: 'center',
    maxWidth: 450,
    width: '100%',
  },
  resultRow: {
    borderRadius: 16,
    border: '2px solid',
    padding: '18px 20px',
    marginBottom: 16,
  },
  barBg: {
    background: '#E5E7EB',
    borderRadius: 99,
    height: 20,
    overflow: 'hidden',
  },
  barFill: { height: '100%', borderRadius: 99, transition: 'width 0.6s ease' },
};
