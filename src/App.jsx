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
const DEADLINE_TIME = new Date('2026-05-29T18:00:00+07:00').getTime();

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
    desc: 'ย้อนยุค ผู้ใหญ่ลี (พ.ศ.2504) และทองกวาวมนต์รักลูกทุ่ง (พ.ศ.2513) ผสมผสานสไตล์ไทบ้านอีสานมักม่วน',
    image:
      'https://i.postimg.cc/qB5Rprzk/Gemini-Generated-Image-s7czx9s7czx9s7cz.png',
    video:
      'https://drive.google.com/file/d/1wZgTttqHH-8eeEK3nkAcxQDHU5wtLhOl/view?usp=sharing',
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
      'https://drive.google.com/file/d/1B57yzVeNdudXJc4RfnVxuG2oGy8ay7T_/view?usp=sharing',
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
  const [timeLeft, setTimeLeft] = useState(''); // เก็บเวลาที่เหลืออยู่นับถอยหลัง

  useEffect(() => {
    const localVote = localStorage.getItem(LOCAL_VOTE_KEY);

    const handleHashChange = () => {
      const hash = window.location.hash.replace('#', '');
      if (hash === RESULTS_SECRET) {
        setPage('results');
      } else if (new Date().getTime() >= DEADLINE_TIME) {
        setPage('expired'); // สั่งเข้าหน้าปิดโหวตทันทีถ้าหมดเวลา
      } else if (localVote) {
        setVotedFor(localVote);
        setPage('thanks');
      } else {
        setPage('vote');
      }
    };

    // ระบบจับเวลาและนับถอยหลัง (อัปเดตทุก 1 วินาที)
    const timerInterval = setInterval(() => {
      const now = new Date().getTime();
      const difference = DEADLINE_TIME - now;

      if (difference <= 0) {
        clearInterval(timerInterval);
        setTimeLeft('🚨 หมดเวลาโหวตแล้ว');
        // ถ้าคนใช้งานเปิดหน้าเว็บค้างอยู่พอดี ให้เด้งไปหน้าปิดโหวตทันที
        const hash = window.location.hash.replace('#', '');
        if (hash !== RESULTS_SECRET) setPage('expired');
      } else {
        const days = Math.floor(difference / (1000 * 60 * 60 * 24));
        const hours = Math.floor(
          (difference % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)
        );
        const minutes = Math.floor(
          (difference % (1000 * 60 * 60)) / (1000 * 60)
        );
        const seconds = Math.floor((difference % (1000 * 60)) / 1000);

        let timeString = '';
        if (days > 0) timeString += `${days} วัน `;
        timeString += `${hours} ชั่วโมง ${minutes} นาที ${seconds} วินาที`;
        setTimeLeft(timeString);
      }
    }, 1000);

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

    // ดักฟังคะแนนแบบ Real-time
    const unsubscribe = onValue(votesRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val();
        setCounts({ A: data.A || 0, B: data.B || 0 });
      }
    });

    window.addEventListener('hashchange', handleHashChange);
    return () => {
      window.removeEventListener('hashchange', handleHashChange);
      clearInterval(timerInterval);
      unsubscribe();
    };
  }, []);

  const handleVote = async (id) => {
    // ดักจับอีกชั้นนึง ตอนกดปุ่มโหวต ถ้าหมดเวลาแล้วจะไม่ยอมให้ส่งข้อมูลขึ้น Firebase
    if (new Date().getTime() >= DEADLINE_TIME) {
      alert('ไม่สามารถโหวตได้ เนื่องจากหมดเวลาลงคะแนนแล้วครับ');
      setPage('expired');
      return;
    }

    if (submitting) return;
    setSubmitting(id);

    const choiceRef = ref(db, `votes/${id}`);
    try {
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
    return (
      <VotePage
        onVote={handleVote}
        submitting={submitting}
        timeLeft={timeLeft}
      />
    );
  if (page === 'thanks')
    return (
      <ThanksPage
        choice={CHOICES.find((c) => c.id === votedFor)}
        counts={counts}
      />
    );
  if (page === 'results') return <ResultsPage counts={counts} />;
  if (page === 'expired') return <ExpiredPage counts={counts} />; // หน้าปิดโหวตตัวใหม่
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
// ── Vote Page (เวอร์ชันแสดงกล่องนับถอยหลัง) ───────────────────────
function VotePage({ onVote, submitting, timeLeft }) {
  return (
    <div style={S.page}>
      <h1 style={S.heading}>{VOTE_HEADING}</h1>
      <p style={S.sub}>ดูรูปและคลิปสั้นๆ แล้วกดปุ่มโหวตด้านล่างได้เลยครับ</p>

      {/* กล่องแสดงเวลานับถอยหลัง */}
      <div
        style={{
          background: '#FFFBEB',
          border: '1px solid #FDE68A',
          borderRadius: 16,
          padding: '12px 20px',
          marginBottom: 24,
          textAlign: 'center',
        }}
      >
        <p
          style={{
            margin: 0,
            fontSize: 14,
            color: '#92400E',
            fontWeight: 'bold',
          }}
        >
          ⏳ เวลาที่เหลือในการโหวต
        </p>
        <p
          style={{
            margin: '4px 0 0',
            fontSize: 18,
            color: '#B45309',
            fontWeight: 700,
            letterSpacing: 0.5,
          }}
        >
          {timeLeft || 'กำลังคำนวณ...'}
        </p>
      </div>

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

// ── Expired Page (หน้าตาปิดโหวตเมื่อถึงเวลาที่ตั้งไว้) ─────────────────────
function ExpiredPage({ counts }) {
  const total = counts.A + counts.B;
  return (
    <div style={S.center}>
      <div
        style={{
          borderRadius: 24,
          border: '3px solid #EF4444',
          background: '#FEF2F2',
          padding: '40px 24px',
          textAlign: 'center',
          maxWidth: 450,
          width: '100%',
        }}
      >
        <div style={{ fontSize: 64, marginBottom: 12 }}>🔒</div>
        <h2 style={{ ...S.heading, color: '#DC2626', margin: '0 0 12px' }}>
          ปิดระบบลงคะแนนแล้ว
        </h2>
        <p
          style={{
            fontSize: 16,
            color: '#7F1D1D',
            margin: '0 0 8px',
            fontWeight: 'bold',
          }}
        >
          สิ้นสุดระยะเวลาการโหวต:
        </p>
        <p
          style={{
            fontSize: 15,
            color: '#991B1B',
            margin: '0 0 24px',
            background: '#fff',
            padding: '8px 12px',
            borderRadius: 8,
            display: 'inline-block',
            border: '1px solid #FCA5A5',
          }}
        >
          📅 วันศุกร์ที่ 29 พ.ค. 2569 เวลา 18:00 น.
        </p>
        <p style={{ fontSize: 16, color: '#4B5563', margin: 0 }}>
          จำนวนผู้ร่วมลงคะแนนทั้งหมดสรุปที่:{' '}
          <strong>{total.toLocaleString()}</strong> คน
        </p>
        <p style={{ fontSize: 13, color: '#9CA3AF', marginTop: 8 }}>
          ขอบคุณทุกท่านที่ร่วมแสดงความคิดเห็น
        </p>
      </div>
    </div>
  );
}

// ── ตัวเล่นวิดีโออัจฉริยะ (อัปเดตแก้จอแบนบนมือถือ) ──
function VideoPlayer({ url }) {
  if (!url) return null;

  // สไตล์สำหรับกรอบวิดีโอให้ได้สัดส่วน 16:9 บนทุกหน้าจอ
  const responsiveWrapper = {
    position: 'relative',
    paddingTop: '56.25%', // บังคับสัดส่วน 16:9 (ไม่ให้จอแบน)
    width: '100%',
    marginBottom: '20px',
    borderRadius: '12px',
    overflow: 'hidden', // ทำให้ขอบวิดีโอโค้งมนสวยงาม
    background: '#000',
    boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
  };

  const responsiveIframe = {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    border: 0,
  };

  // 1. กรณีเป็นลิงก์วิดีโอจาก VdoCipher
  if (url.includes('vdocipher.com')) {
    return (
      <div style={responsiveWrapper}>
        <iframe
          src={url}
          style={responsiveIframe}
          allowFullScreen={true}
          allow="encrypted-media"
        />
      </div>
    );
  }

  // 2. กรณีเป็นลิงก์ YouTube
  if (url.includes('youtube.com') || url.includes('youtu.be')) {
    let videoId = '';
    if (url.includes('youtu.be/')) {
      videoId = url.split('youtu.be/')[1]?.split(/[?#]/)[0];
    } else if (url.includes('v=')) {
      videoId = url.split('v=')[1]?.split(/[&#]/)[0];
    }
    return (
      <div style={responsiveWrapper}>
        <iframe
          src={`https://www.youtube.com/embed/${videoId}`}
          style={responsiveIframe}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      </div>
    );
  }

  // 3. กรณีเป็นลิงก์ Google Drive (แก้ให้เต็มจอพอดีที่นี่ครับ)
  if (url.includes('drive.google.com')) {
    let fileId = '';
    if (url.includes('/d/')) {
      fileId = url.split('/d/')[1]?.split('/')[0];
    }
    return (
      <div style={responsiveWrapper}>
        <iframe
          src={`https://drive.google.com/file/d/${fileId}/preview`}
          style={responsiveIframe}
          allow="autoplay"
          allowFullScreen
        />
      </div>
    );
  }

  // 4. กรณีเป็นไฟล์วิดีโอตรงปกติ (.mp4)
  return (
    <video
      src={url}
      controls
      style={{
        width: '100%',
        borderRadius: '12px',
        marginBottom: '20px',
        background: '#000',
      }}
      preload="metadata"
    />
  );
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
