import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Trophy, ChevronRight, LogOut, Star, PartyPopper,
  Rocket, Download, Upload, RotateCcw,
  UserCheck, Trash2, Plus, FileSpreadsheet, Monitor,
  MousePointer2
} from 'lucide-react';
import confetti from 'canvas-confetti';
import * as XLSX from 'xlsx';

// --- SHARED CHANNEL ---
const channel = new BroadcastChannel('quiz_projection');
const isProjection = new URLSearchParams(window.location.search).get('projection') === 'true';

// --- TYPES ---
interface Question {
  id: string; text: string; answers: string[]; correctIndex: number; points: number;
}
interface Group {
  id: string; name: string; score: number;
}
type View = 'welcome' | 'config' | 'playing' | 'ranking';

const COLORS = ['#8B5CF6', '#EC4899', '#10B981', '#FBBF24', '#F87171', '#6366F1'];

const pageVariants = {
  initial: { opacity: 0, x: 20 },
  enter: { opacity: 1, x: 0, transition: { duration: 0.4 } },
  exit: { opacity: 0, x: -20, transition: { duration: 0.2 } }
};

const staticMotion = { initial: false, animate: false, exit: false };
const dynamicMotion = { initial: "initial", animate: "enter", exit: "exit", variants: pageVariants };

function StageViewport({ children, fitMode }: { children: React.ReactNode, fitMode: 'contain' | 'cover' | 'stretch' }) {
  const [dimensions, setDimensions] = useState({ width: window.innerWidth, height: window.innerHeight });

  useEffect(() => {
    const handleResize = () => setDimensions({ width: window.innerWidth, height: window.innerHeight });
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const baseW = 1920;
  const baseH = 1080;
  const vw = dimensions.width;
  const vh = dimensions.height;

  let scaleX = 1;
  let scaleY = 1;

  if (fitMode === 'contain') {
    const s = Math.min(vw / baseW, vh / baseH);
    scaleX = scaleY = s;
  } else if (fitMode === 'cover') {
    const s = Math.max(vw / baseW, vh / baseH);
    scaleX = scaleY = s;
  } else if (fitMode === 'stretch') {
    scaleX = vw / baseW;
    scaleY = vh / baseH;
  }

  return (
    <div style={{
      width: '100vw',
      height: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
      background: 'black'
    }}>
      <div style={{
        width: baseW,
        height: baseH,
        transform: `scale(${scaleX}, ${scaleY})`,
        transformOrigin: 'center',
        flexShrink: 0,
        position: 'relative'
      }}>
        {children}
      </div>
    </div>
  );
}

export default function App() {
  const [view, setView] = useState<View>('welcome');
  const [gameTitle, setGameTitle] = useState('ACERTE A RESPOSTA');
  const [questions, setQuestions] = useState<Question[]>([]);
  const [groups, setGroups] = useState<Group[]>([
    { id: '1', name: 'Time Foguete 🚀', score: 0 },
    { id: '2', name: 'Time Estrela ⭐', score: 0 }
  ]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);
  const [gamePoints, setGamePoints] = useState(1);
  const [rankingTitle, setRankingTitle] = useState('GRANDE FINAL MISSIONÁRIA');
  const [rankingSubtitle, setRankingSubtitle] = useState('Ranking dos Times');
  const [gameSubtitle, setGameSubtitle] = useState('The Missionary Experience');
  const [currentUser, setCurrentUser] = useState<string | null>(null);
  const [projectionActive, setProjectionActive] = useState(false);
  const [screenDetails, setScreenDetails] = useState<any>(null);
  const [showScreenModal, setShowScreenModal] = useState(false);
  const [showFullscreenOverlay, setShowFullscreenOverlay] = useState(false);

  const [activeGroupId, setActiveGroupId] = useState<string | null>(null);
  const [groupAnswers, setGroupAnswers] = useState<{ [groupId: string]: number }>({});
  const [fitMode, setFitMode] = useState<'contain' | 'cover' | 'stretch'>('contain');
  const [answersByQuestion, setAnswersByQuestion] = useState<Record<number, { activeGroupId: string | null, groupAnswers: Record<string, number> }>>({});
  const [awardsByQuestion, setAwardsByQuestion] = useState<Record<number, string[]>>({});
  const [revealedByQuestion, setRevealedByQuestion] = useState<Record<number, boolean>>({});

  const projectionWindowRef = useRef<Window | null>(null);
  const confettiCanvasRef = useRef<HTMLCanvasElement>(null);
  const confettiInstance = useRef<any>(null);
  const syncSeq = useRef(0); // Master sequence
  const lastSeqReceived = useRef(0); // Projection sequence

  const celebration = useCallback(() => {
    // Master sends trigger to projection
    if (!isProjection) channel.postMessage({ type: 'CELEBRATE' });

    if (confettiCanvasRef.current && !confettiInstance.current) {
      confettiInstance.current = confetti.create(confettiCanvasRef.current, { resize: true, useWorker: true });
    }

    const duration = 15 * 1000;
    const animationEnd = Date.now() + duration;
    const interval: any = setInterval(() => {
      const timeLeft = animationEnd - Date.now();
      if (timeLeft <= 0) return clearInterval(interval);
      if (confettiInstance.current) {
        confettiInstance.current({ particleCount: 150, spread: 360, origin: { x: Math.random(), y: Math.random() - 0.2 } });
      } else {
        confetti({ particleCount: 150, spread: 360, origin: { x: Math.random(), y: Math.random() - 0.2 } });
      }
    }, 250);
  }, [isProjection]);

  const actualOpen = (screen: any) => {
    const url = window.location.origin + window.location.pathname + '?projection=true';
    const features = 'popup=yes,menubar=no,toolbar=no,location=no,status=no,directories=no,resizable=yes,scrollbars=no';

    let specs = features;
    if (screen) {
      specs += `,left=${screen.availLeft},top=${screen.availTop},width=${screen.availWidth},height=${screen.availHeight}`;
    }

    const win = window.open(url, 'quiz_projection', specs);
    if (win) {
      projectionWindowRef.current = win;
      setProjectionActive(true);
      setShowScreenModal(false);

      // PROFESSIONAL DIRECT FULLSCREEN (Same execution stack)
      // Attempt multiple times in the same tick to ensure capture
      const trigger = () => {
        try {
          if (win && !win.closed && win.document && win.document.documentElement) {
            win.focus();
            // @ts-ignore
            win.document.documentElement.requestFullscreen({ screen }).catch(() => {
              win.document.documentElement.requestFullscreen().catch(() => { });
            });
          }
        } catch (e) { }
      };

      trigger();
      requestAnimationFrame(trigger);
      setTimeout(trigger, 50);

      // Positioning backup
      if (screen) {
        try { win.moveTo(screen.availLeft, screen.availTop); win.resizeTo(screen.availWidth, screen.availHeight); } catch (e) { }
      }
    } else {
      alert("O navegador bloqueou o popup! Permita janelas e tente novamente.");
    }
  };

  const handleStopProjection = () => {
    channel.postMessage({ type: 'CLOSE_PROJECTION' });
    if (projectionWindowRef.current && !projectionWindowRef.current.closed) {
      projectionWindowRef.current.close();
    }
    setProjectionActive(false);
  };

  const handleOpenProjection = async () => {
    try {
      // @ts-ignore
      if ('getScreenDetails' in window || window.getScreenDetails) {
        // @ts-ignore
        const details = await window.getScreenDetails();
        setScreenDetails(details);
        setShowScreenModal(true);
        return;
      }
    } catch (e) {
      console.warn("Window Management API denied", e);
    }

    // Fallback if API missing or denied
    actualOpen(null);
  };

  const testScreen = (screen: any) => {
    const specs = `left=${screen.availLeft + 100},top=${screen.availTop + 100},width=600,height=400,menubar=no,toolbar=no`;
    const win = window.open('', 'test_screen', specs);
    if (win) {
      win.document.body.style.background = "var(--primary, #8B5CF6)";
      win.document.body.style.display = "flex";
      win.document.body.style.alignItems = "center";
      win.document.body.style.justifyContent = "center";
      win.document.body.style.color = "white";
      win.document.body.style.fontFamily = "sans-serif";
      win.document.body.innerHTML = `
        <div style="text-align:center">
          <h1 style="font-size:3rem;margin:0">TELA DETECTADA! ✅</h1>
          <p style="font-size:1.5rem">A projeção será aberta neste monitor.</p>
        </div>
      `;
      setTimeout(() => win.close(), 3000);
    }
  };

  // LOAD state when changing questions (ONLY ONCE PER CHANGE)
  useEffect(() => {
    if (!isProjection) {
      const saved = answersByQuestion[currentQuestionIndex];
      if (saved) {
        setActiveGroupId(saved.activeGroupId);
        setGroupAnswers(saved.groupAnswers);
      } else {
        setActiveGroupId(null);
        setGroupAnswers({});
      }
      setShowAnswer(revealedByQuestion[currentQuestionIndex] || false);
    }
  }, [currentQuestionIndex, isProjection]); // Removed answersByQuestion/revealedByQuestion from deps to kill the loop

  useEffect(() => {
    const savedUser = localStorage.getItem('quiz_user');
    const savedGame = localStorage.getItem('quiz_save_data');
    if (savedUser) setCurrentUser(savedUser);
    if (savedGame) {
      try {
        const data = JSON.parse(savedGame);
        if (data.title) setGameTitle(data.title);
        if (data.subtitle) setGameSubtitle(data.subtitle);
        if (data.questions) setQuestions(data.questions);
        if (data.groups) setGroups(data.groups);
        if (data.points) setGamePoints(data.points);
        if (data.rankingTitle) setRankingTitle(data.rankingTitle);
        if (data.rankingSubtitle) setRankingSubtitle(data.rankingSubtitle);
      } catch (e) { console.error(e); }
    }
  }, []);

  const lastStateRef = useRef<any>(null); // Tracker for sync
  useEffect(() => {
    lastStateRef.current = {
      view, gameTitle, questions, groups, currentQuestionIndex,
      showAnswer, gamePoints, rankingTitle, rankingSubtitle,
      activeGroupId, groupAnswers, fitMode, answersByQuestion, awardsByQuestion, revealedByQuestion
    };
  }, [view, gameTitle, questions, groups, currentQuestionIndex, showAnswer, gamePoints, rankingTitle, rankingSubtitle, activeGroupId, groupAnswers, fitMode, answersByQuestion, awardsByQuestion, revealedByQuestion]);

  // 1. MASTER: Push state on changes (using sequence and deduplication for stability)
  const lastStateSentStr = useRef('');
  useEffect(() => {
    if (isProjection) return;
    const currentState = {
      view, gameTitle, questions, groups, currentQuestionIndex,
      showAnswer, gamePoints, rankingTitle, rankingSubtitle,
      activeGroupId, groupAnswers, fitMode, answersByQuestion,
      awardsByQuestion, revealedByQuestion
    };
    const s = JSON.stringify(currentState);
    if (s !== lastStateSentStr.current) {
      lastStateSentStr.current = s;
      syncSeq.current += 1;
      channel.postMessage({ type: 'SYNC_STATE', seq: syncSeq.current, payload: currentState });
    }
  }, [view, gameTitle, questions, groups, currentQuestionIndex, showAnswer, gamePoints, rankingTitle, rankingSubtitle, activeGroupId, groupAnswers, fitMode, answersByQuestion, awardsByQuestion, revealedByQuestion, isProjection]);

  // 2. REGISTRATION: Setup listeners once (STABLE)
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const { type, payload, seq } = event.data;

      if (isProjection) {
        if (type === 'SYNC_STATE') {
          if (!seq || seq <= lastSeqReceived.current) return;
          lastSeqReceived.current = seq;
          const s = payload;
          if (s.view !== undefined) setView(s.view);
          if (s.gameTitle !== undefined) setGameTitle(s.gameTitle);
          if (s.questions !== undefined) setQuestions(s.questions);
          if (s.groups !== undefined) setGroups(s.groups);
          if (s.currentQuestionIndex !== undefined) setCurrentQuestionIndex(s.currentQuestionIndex);
          if (s.showAnswer !== undefined) setShowAnswer(s.showAnswer);
          if (s.gamePoints !== undefined) setGamePoints(s.gamePoints);
          if (s.rankingTitle !== undefined) setRankingTitle(s.rankingTitle);
          if (s.rankingSubtitle !== undefined) setRankingSubtitle(s.rankingSubtitle);
          if (s.activeGroupId !== undefined) setActiveGroupId(s.activeGroupId);
          if (s.groupAnswers !== undefined) setGroupAnswers(s.groupAnswers);
          if (s.fitMode !== undefined) setFitMode(s.fitMode);
          if (s.answersByQuestion !== undefined) setAnswersByQuestion(s.answersByQuestion);
          if (s.awardsByQuestion !== undefined) setAwardsByQuestion(s.awardsByQuestion);
          if (s.revealedByQuestion !== undefined) setRevealedByQuestion(s.revealedByQuestion);
        } else if (type === 'CELEBRATE') {
          celebration();
        } else if (type === 'CLOSE_PROJECTION') {
          window.close();
        } else if (type === 'GO_FULLSCREEN') {
          setShowFullscreenOverlay(true);
        } else if (type === 'REQUEST_STATE' || type === 'PING_PROJECTION') {
          channel.postMessage({ type: 'PROJECTION_ALIVE' });
        }
      } else {
        if (type === 'REQUEST_STATE' || type === 'PROJECTION_ALIVE' || type === 'PING_PROJECTION') {
          setProjectionActive(true);
        }
      }
    };

    channel.addEventListener('message', handleMessage);

    if (isProjection) {
      channel.postMessage({ type: 'REQUEST_STATE' });

      const handleFSChange = () => {
        if (document.fullscreenElement) {
          setShowFullscreenOverlay(false);
        }
      };

      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key.toLowerCase() === 'enter' || e.key.toLowerCase() === 'f') {
          if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen()
              .then(() => setShowFullscreenOverlay(false))
              .catch(() => { });
          }
        }
      };

      window.addEventListener('keydown', handleKeyDown);
      document.addEventListener('fullscreenchange', handleFSChange);

      return () => {
        channel.removeEventListener('message', handleMessage);
        window.removeEventListener('keydown', handleKeyDown);
        document.removeEventListener('fullscreenchange', handleFSChange);
      };
    }

    return () => channel.removeEventListener('message', handleMessage);
  }, [isProjection, celebration]);

  const saveToLocal = (title?: string, qs?: Question[], gs?: Group[], pts?: number, rTitle?: string, rSub?: string, sub?: string) => {
    const data = {
      title: title ?? gameTitle,
      subtitle: sub ?? gameSubtitle,
      questions: qs ?? questions,
      groups: gs ?? groups,
      points: pts ?? gamePoints,
      rankingTitle: rTitle ?? rankingTitle,
      rankingSubtitle: rSub ?? rankingSubtitle
    };
    localStorage.setItem('quiz_save_data', JSON.stringify(data));
  };

  const resetAllPoints = () => {
    const resetGs = groups.map(g => ({ ...g, score: 0 }));
    setGroups(resetGs);
    saveToLocal(gameTitle, questions, resetGs, gamePoints);
    return resetGs;
  };

  const handleExport = () => {
    const data = { title: gameTitle, questions, groups: groups.map(g => ({ ...g, score: 0 })), points: gamePoints, rankingTitle, rankingSubtitle };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `quiz-${gameTitle.toLowerCase()}.json`;
    a.click();
  };

  const handleImport = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (e: any) => {
      const file = e.target.files[0];
      const reader = new FileReader();
      reader.onload = (event: any) => {
        try {
          const data = JSON.parse(event.target.result);
          setGameTitle(data.title);
          setGameSubtitle(data.subtitle || 'The Missionary Experience');
          setQuestions(data.questions); setGroups(data.groups); setGamePoints(data.points || 1);
          setRankingTitle(data.rankingTitle || 'GRANDE FINAL MISSIONÁRIA');
          setRankingSubtitle(data.rankingSubtitle || 'Ranking dos Times');
          saveToLocal(data.title, data.questions, data.groups, data.points, data.rankingTitle, data.rankingSubtitle, data.subtitle);
          alert("✓ Jogo Importado!");
        } catch (e) { alert("❌ Erro no arquivo!"); }
      };
      reader.readAsText(file);
    };
    input.click();
  };

  const handleDownloadExcelTemplate = () => {
    const template = [
      {
        "Pergunta": "Exemplo: Quem criou o mundo?",
        "Opcao_A": "Deus", "Opcao_B": "Homem", "Opcao_C": "Acaso", "Opcao_D": "Robôs",
        "Letra_Correta (A,B,C ou D)": "A", "Pontos": 5
      }
    ];
    const ws = XLSX.utils.json_to_sheet(template);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Modelo_Perguntas");
    XLSX.writeFile(wb, "modelo_perguntas_quiz.xlsx");
  };

  const handleImportExcel = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.xlsx, .xls';
    input.onchange = (e: any) => {
      const file = e.target.files[0];
      const reader = new FileReader();
      reader.onload = (event: any) => {
        try {
          const data = new Uint8Array(event.target.result);
          const workbook = XLSX.read(data, { type: 'array' });
          const worksheet = workbook.Sheets[workbook.SheetNames[0]];
          const jsonData = XLSX.utils.sheet_to_json(worksheet) as any[];

          const mappedQuestions = jsonData.map((row, idx) => ({
            id: `excel-${Date.now()}-${idx}`,
            text: String(row["Pergunta"] || ""),
            answers: [row["Opcao_A"], row["Opcao_B"], row["Opcao_C"], row["Opcao_D"]].filter(Boolean).map(String),
            correctIndex: (String(row["Letra_Correta (A,B,C ou D)"] || "A").toUpperCase().charCodeAt(0) - 65),
            points: Number(row["Pontos"] || gamePoints)
          }));

          setQuestions(mappedQuestions);
          saveToLocal(gameTitle, mappedQuestions, groups, gamePoints, rankingTitle, rankingSubtitle);
          alert(`✓ ${mappedQuestions.length} Perguntas importadas!`);
        } catch (e) { alert("❌ Erro no Excel!"); }
      };
      reader.readAsArrayBuffer(file);
    };
    input.click();
  };

  const renderView = () => {
    // If projection doesn't have a view yet, show welcome by default
    const activeView = (isProjection && !view) ? 'welcome' : view;

    // Disabling framer-motion props on projection to avoid flicker
    // Stable motion props to prevent flicker
    const motionProps: any = isProjection ? staticMotion : dynamicMotion;

    switch (activeView) {
      case 'welcome':
        return (
          <motion.div key="welcome" {...motionProps} className="flex-center">
            <div className="glass-card flex-center" style={{ maxWidth: '1000px' }}>
              <Rocket size={100} color="var(--primary)" style={{ marginBottom: '30px' }} />
              <h1 className="text-huge title-gradient uppercase italic mb-20">{gameTitle}</h1>
              <p style={{ letterSpacing: '8px', opacity: 0.4, fontWeight: 900 }} className="uppercase mb-40">{gameSubtitle}</p>
            </div>
            {!isProjection && (
              <button
                onClick={() => {
                  if (currentUser) setView('config');
                  else if (questions.length > 0) setView('playing');
                  else alert("Por favor, peça ao Mestre para carregar as perguntas!");
                }}
                className="btn-primary"
                style={{ fontSize: '3rem', padding: '40px 80px' }}
              >
                INICIAR JOGO 🚀
              </button>
            )}
          </motion.div>
        );
      case 'config':
        return (
          <motion.div key="config" {...motionProps} style={{ width: '100%' }}>
            <section className="glass-card">
              <h3 className="uppercase font-black italic mb-20">Configuração do Evento</h3>
              <input
                className="input-field" style={{ fontSize: '2.5rem', fontWeight: 900, padding: '20px' }}
                placeholder="Título do Jogo"
                value={gameTitle}
                onChange={(e) => { setGameTitle(e.target.value.toUpperCase()); saveToLocal(e.target.value.toUpperCase()); }}
              />
              <input
                className="input-field" style={{ fontSize: '1.2rem', fontWeight: 700, padding: '15px', marginTop: '10px', opacity: 0.8 }}
                placeholder="Subtítulo (Ex: The Missionary Experience)"
                value={gameSubtitle}
                onChange={(e) => { setGameSubtitle(e.target.value); saveToLocal(undefined, undefined, undefined, undefined, undefined, undefined, e.target.value); }}
              />
              <div style={{ display: 'flex', gap: '20px', marginTop: '30px' }}>
                {currentUser && <button onClick={() => { if (confirm("Limpar placar?")) { resetAllPoints(); setCurrentQuestionIndex(0); setShowAnswer(false); setAnswersByQuestion({}); setAwardsByQuestion({}); setRevealedByQuestion({}); setActiveGroupId(null); setGroupAnswers({}); } }} className="btn-secondary" style={{ fontSize: '1rem', flex: 1 }}><RotateCcw size={16} /> Zerar Placar</button>}
                <button onClick={() => (questions.length > 0 ? setView('playing') : alert("Crie perguntas!"))} className="btn-primary" style={{ padding: '20px', fontSize: '1.8rem', flex: 2 }}>INICIAR DESAFIO 🚀</button>
              </div>
            </section>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '30px' }}>
              <section className="glass-card">
                <h3 className="uppercase font-black italic mb-20"><UserCheck size={20} /> Equipes</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                  {groups.map((g, i) => (
                    <div key={g.id} style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
                      <div className="team-badge" style={{ backgroundColor: COLORS[i % COLORS.length] }}>{i + 1}</div>
                      <input className="input-field" style={{ margin: 0 }} value={g.name} onChange={(e) => {
                        const ns = [...groups]; ns[i].name = e.target.value; setGroups(ns); saveToLocal(gameTitle, questions, ns);
                      }} />
                      <button onClick={() => {
                        const ngs = groups.filter(gr => gr.id !== g.id);
                        setGroups(ngs);
                        saveToLocal(gameTitle, questions, ngs);
                      }} style={{ color: 'var(--danger)', background: 'none', border: 'none' }}><Trash2 size={24} /></button>
                    </div>
                  ))}
                  <button onClick={() => setGroups([...groups, { id: Date.now().toString(), name: `Equipe ${groups.length + 1}`, score: 0 }])} className="btn-secondary" style={{ width: '100%', border: '2px dashed rgba(255,255,255,0.1)' }}>+ Adicionar Equipe</button>
                </div>
              </section>

              <section className="glass-card">
                <h3 className="uppercase font-black italic mb-20"><Star size={20} /> Premiação</h3>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(0,0,0,0.3)', padding: '30px', borderRadius: '24px', marginBottom: '20px' }}>
                  <p className="font-black opacity-50 uppercase">Pontos por Acerto</p>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                    <input type="number" className="input-field" style={{ width: '100px', fontSize: '3rem', fontWeight: 900, color: 'var(--yellow)', border: 'none', background: 'none', textAlign: 'center' }} value={gamePoints} onChange={(e) => setGamePoints(Number(e.target.value))} />
                    <Star size={40} fill="var(--yellow)" color="var(--yellow)" />
                  </div>
                </div>
                <div>
                  <p className="font-black uppercase opacity-50 text-xs">Título Final</p>
                  <input className="input-field" style={{ margin: '5px 0' }} value={rankingTitle} onChange={(e) => { setRankingTitle(e.target.value.toUpperCase()); saveToLocal(undefined, undefined, undefined, undefined, e.target.value.toUpperCase()); }} />
                  <p className="font-black uppercase opacity-50 text-xs mt-10">Texto do Ranking</p>
                  <input className="input-field" style={{ margin: '5px 0' }} value={rankingSubtitle} onChange={(e) => { setRankingSubtitle(e.target.value); saveToLocal(undefined, undefined, undefined, undefined, undefined, e.target.value); }} />
                </div>
              </section>
            </div>

            <section style={{ marginTop: '40px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
                <h2 className="text-large uppercase italic shadow-text">Desafios ({questions.length})</h2>
                {currentUser && (
                  <div style={{ display: 'flex', gap: '15px' }}>
                    <button onClick={handleDownloadExcelTemplate} className="btn-secondary" style={{ color: '#22c55e' }}><FileSpreadsheet size={16} /> Modelo Excel</button>
                    <button onClick={handleImportExcel} className="btn-secondary" style={{ color: '#3b82f6' }}><Upload size={16} /> Carregar Excel</button>
                    <button onClick={() => {
                      const nq = { id: Date.now().toString(), text: '', answers: ['', ''], correctIndex: 0, points: gamePoints };
                      const nqs = [...questions, nq]; setQuestions(nqs); saveToLocal(gameTitle, nqs);
                    }} className="btn-primary" style={{ padding: '15px 30px' }}><Plus size={24} /> Novo Card</button>
                  </div>
                )}
              </div>

              {questions.map((q, idx) => (
                <div key={q.id} className="glass-card" style={{ borderLeft: '12px solid var(--primary)', padding: '30px' }}>
                  <div style={{ display: 'flex', gap: '20px', marginBottom: '30px' }}>
                    <div className="team-badge" style={{ background: 'var(--primary)', color: 'white', width: '80px', height: '80px', borderRadius: '20px' }}>#{idx + 1}</div>
                    <textarea
                      className="input-field" style={{ fontStyle: 'italic', fontWeight: 800, fontSize: '1.4rem' }}
                      placeholder="Digite a pergunta aqui..."
                      value={q.text} onChange={(e) => { const nqs = [...questions]; nqs[idx].text = e.target.value; setQuestions(nqs); saveToLocal(gameTitle, nqs); }}
                    />
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                    {q.answers.map((ans, aIdx) => (
                      <div key={aIdx} style={{ display: 'flex', gap: '10px', alignItems: 'center', background: 'rgba(255,255,255,0.03)', padding: '15px', borderRadius: '16px', border: q.correctIndex === aIdx ? '2px solid var(--success)' : '1px solid rgba(255,255,255,0.05)' }}>
                        <button
                          onClick={() => { const ns = [...questions]; ns[idx].correctIndex = aIdx; setQuestions(ns); saveToLocal(gameTitle, ns); }}
                          style={{
                            width: 'auto',
                            minWidth: '60px',
                            height: '45px',
                            borderRadius: '12px',
                            border: 'none',
                            background: q.correctIndex === aIdx ? 'var(--success)' : 'rgba(255,255,255,0.1)',
                            color: q.correctIndex === aIdx ? 'black' : 'white',
                            fontWeight: 900,
                            fontSize: '1rem',
                            padding: '0 15px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px'
                          }}
                        >
                          {String.fromCharCode(65 + aIdx)}
                          {q.correctIndex === aIdx && <span style={{ fontSize: '0.7rem' }}>CORRETA</span>}
                        </button>
                        <input className="input-field" style={{ margin: 0, border: 'none', background: 'none' }} value={ans} onChange={(e) => {
                          const ns = [...questions]; ns[idx].answers[aIdx] = e.target.value; setQuestions(ns); saveToLocal(gameTitle, ns);
                        }} />
                      </div>
                    ))}
                  </div>
                  <div style={{ marginTop: '30px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '20px' }}>
                    <button onClick={() => {
                      if (confirm("Excluir?")) {
                        const nqs = questions.filter(qu => qu.id !== q.id);
                        setQuestions(nqs);
                        saveToLocal(gameTitle, nqs);
                      }
                    }} style={{ color: 'var(--danger)', background: 'none', border: 'none', fontStyle: 'italic' }}>Remover este Desafio</button>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <span className="font-black opacity-30">PONTOS:</span>
                      <input type="number" className="input-field" style={{ width: '80px', background: 'rgba(139,92,246,0.1)', border: 'none', textAlign: 'center', fontSize: '1.5rem', fontWeight: 800, color: 'var(--primary)' }} value={q.points} onChange={(e) => { const ns = [...questions]; ns[idx].points = Number(e.target.value); setQuestions(ns); saveToLocal(gameTitle, ns); }} />
                      <Star size={20} color="var(--primary)" />
                    </div>
                  </div>
                </div>
              ))}
            </section>
          </motion.div>
        );
      case 'playing':
        return (
          <PlayingView
            key="playing"
            currentQuestionIndex={currentQuestionIndex} questions={questions} groups={groups} showAnswer={showAnswer}
            activeGroupId={activeGroupId} setActiveGroupId={setActiveGroupId}
            groupAnswers={groupAnswers} setGroupAnswers={setGroupAnswers}
            isProjection={isProjection}
            awardsByQuestion={awardsByQuestion}
            revealedByQuestion={revealedByQuestion}
            setAnswersByQuestion={setAnswersByQuestion}
            onFinishQuestion={(fgs: Group[], winners: string[]) => {
              setAwardsByQuestion(prev => ({ ...prev, [currentQuestionIndex]: winners }));
              setRevealedByQuestion(prev => ({ ...prev, [currentQuestionIndex]: true }));
              setGroups(fgs);
              setShowAnswer(true);
              saveToLocal(gameTitle, questions, fgs);
            }}
            onRollbackPoints={(idx: number, rbGroups: Group[]) => {
              setGroups(rbGroups);
              setAwardsByQuestion(prev => {
                const copy = { ...prev };
                delete copy[idx];
                return copy;
              });
              setRevealedByQuestion(prev => ({ ...prev, [idx]: false }));
              setShowAnswer(false);
              setGroupAnswers({}); // CLEAR OLD ANSWERS FOR RE-SELECTION
              setActiveGroupId(null);
              saveToLocal(gameTitle, questions, rbGroups);
            }}
            onNextQuestion={() => {
              if (currentQuestionIndex < questions.length - 1) {
                // CLEAR STATE FOR NEXT QUESTION
                setGroupAnswers({});
                setActiveGroupId(null);
                setShowAnswer(false);
                setCurrentQuestionIndex(prev => prev + 1);
              }
              else { setView('ranking'); celebration(); }
            }}
            onPrevQuestion={() => {
              if (currentQuestionIndex > 0) {
                setCurrentQuestionIndex(prev => prev - 1);
              }
            }}
          />
        );
      case 'ranking':
        return (
          <motion.div key="ranking" {...motionProps} className="flex-center">
            <Trophy size={isProjection ? 150 : 250} color="var(--yellow)" style={{ filter: 'drop-shadow(0 0 80px rgba(251,191,36,0.5))', marginBottom: isProjection ? '20px' : '40px' }} />
            <h1 className={`${isProjection ? 'text-giant' : 'text-huge'} title-gradient uppercase italic mb-40 text-center`}>{rankingTitle}</h1>
            <div className="scoreboard-box">
              <div className="scoreboard-header-cell">🏅 {rankingSubtitle} 🎖️</div>
              <div className="scoreboard-grid">
                {[...groups].sort((a, b) => b.score - a.score).map((g, i) => {
                  const groupIndex = groups.findIndex(gr => gr.id === g.id);
                  return (
                    <motion.div
                      key={g.id}
                      initial={isProjection ? false : { opacity: 0, y: 20 }}
                      animate={isProjection ? false : { opacity: 1, y: 0 }}
                      transition={{ delay: isProjection ? 0 : i * 0.1 }}
                      style={{ display: 'contents' }}
                    >
                      <div className="scoreboard-item italic font-black" style={{ borderLeft: `8px solid ${COLORS[groupIndex % COLORS.length]}` }}>{g.name}</div>
                      <div className="scoreboard-item pts">{g.score}</div>
                    </motion.div>
                  );
                })}
              </div>
            </div>
            {!isProjection && (
              <div style={{ display: 'flex', gap: '30px', marginTop: '60px' }}>
                <button onClick={() => setView('welcome')} className="btn-secondary" style={{ fontSize: '1.5rem', padding: '20px 40px' }}>Menu Início</button>
                <button onClick={() => {
                  if (confirm("ISSO APAGARÁ TUDO!")) {
                    resetAllPoints();
                    setCurrentQuestionIndex(0);
                    setShowAnswer(false);
                    setAnswersByQuestion({});
                    setAwardsByQuestion({});
                    setRevealedByQuestion({});
                    setView('welcome');
                  }
                }}
                  className="btn-primary"
                  style={{ fontSize: '3rem', padding: '40px 80px' }}
                >RECOMECAR TUDO 🔄</button>
              </div>
            )}
          </motion.div>
        );
      default:
        return null;
    }
  };

  return (
    <div className={`app-root ${isProjection ? 'projection-mode' : ''}`}>
      {!isProjection && (
        <nav>
          <div className="clickable" style={{ display: 'flex', alignItems: 'center', gap: '15px' }} onClick={() => setView('welcome')}>
            <Trophy size={32} color="var(--yellow)" fill="var(--yellow)" />
            <h1 className="nav-title">{gameTitle}</h1>
          </div>

          <div style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
            {/* 1. MESTRE LOGIN/LOGOUT */}
            {!currentUser ? (
              <button
                title="Entrar como Mestre"
                onClick={() => {
                  const storedMasterName = localStorage.getItem('quiz_master_name');
                  const name = prompt(storedMasterName
                    ? "PROJETO PROTEGIDO. Digite o nome do Mestre para editar:"
                    : "DEFINIR MESTRE: Digite seu nome para bloquear a edição (Apenas quem souber este nome poderá editar depois):");

                  if (!name) return;

                  if (!storedMasterName) {
                    // First time setting it - Save as the "password" name
                    localStorage.setItem('quiz_master_name', name);
                    setCurrentUser(name);
                    localStorage.setItem('quiz_user', name);
                    setView('config');
                    alert(`✓ Nome do Mestre definido: "${name}". Você precisará digitar exatamente este nome para editar novamente.`);
                  } else {
                    // Validating against the first name ever typed
                    if (name.toLowerCase() === storedMasterName.toLowerCase()) {
                      setCurrentUser(storedMasterName);
                      localStorage.setItem('quiz_user', storedMasterName);
                      // If already in config, stay. If not, maybe go to config if they want.
                      // Usually entering Master mode means they want to config.
                      if (view !== 'config' && view !== 'playing') setView('config');
                    } else {
                      alert("❌ ACESSO NEGADO: Nome incorreto.");
                    }
                  }
                }}
                className="btn-secondary"
                style={{ background: 'rgba(139,92,246,0.1)', color: 'var(--primary)', borderColor: 'var(--primary)', padding: '8px 15px' }}
              >
                <UserCheck size={18} /> CONFIG
              </button>
            ) : (
              <button
                title="Sair do Modo Mestre"
                onClick={() => { if (confirm("Deseja sair da sessão do Mestre?")) { setCurrentUser(null); localStorage.removeItem('quiz_user'); setView('welcome'); } }}
                className="btn-secondary"
                style={{ background: 'rgba(251,191,36,0.1)', color: 'var(--yellow)', borderColor: 'var(--yellow)', padding: '8px 15px' }}
              >
                <LogOut size={18} /> {currentUser}
              </button>
            )}

            {/* 2. PROJECTION CONTROLS - ALWAYS VISIBLE */}
            <div style={{ display: 'flex', gap: '8px', borderLeft: '1px solid rgba(255,255,255,0.1)', paddingLeft: '15px' }}>
              <button
                title="Abrir Projeção"
                onClick={handleOpenProjection}
                className="btn-projection"
                style={{ padding: '8px 15px', fontSize: '0.85rem', background: projectionActive ? 'rgba(255,255,255,0.05)' : '' }}
              >
                <Monitor size={18} /> PROJETAR
              </button>
              {projectionActive && (
                <button
                  title="Fechar Projeção"
                  onClick={handleStopProjection}
                  className="btn-secondary"
                  style={{ borderColor: 'var(--danger)', color: 'var(--danger)', background: 'rgba(239,68,68,0.1)', padding: '8px 15px' }}
                >
                  PARAR
                </button>
              )}
            </div>

            {/* 3. MASTER TOOLS - EXPORT/IMPORT */}
            {currentUser && (
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center', borderLeft: '1px solid rgba(255,255,255,0.1)', paddingLeft: '15px' }}>
                <button title="Exportar Projeto" onClick={handleExport} className="btn-secondary" style={{ padding: '8px' }}><Download size={18} /></button>
                <button title="Importar Projeto" onClick={handleImport} className="btn-secondary" style={{ padding: '8px' }}><Upload size={18} /></button>

                <select
                  className="btn-secondary"
                  style={{ background: 'rgba(255,255,255,0.01)', color: 'white', border: '1px solid rgba(255,255,255,0.2)', padding: '5px 10px', borderRadius: '8px', cursor: 'pointer', fontSize: '0.7rem' }}
                  value={fitMode}
                  onChange={(e) => setFitMode(e.target.value as any)}
                >
                  <option value="contain">AJUSTAR</option>
                  <option value="cover">PREENCHER</option>
                  <option value="stretch">ESTENDER</option>
                </select>
              </div>
            )}

            {/* 4. UTILITY CONTROLS */}
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              {projectionActive && (
                <button
                  onClick={() => channel.postMessage({ type: 'GO_FULLSCREEN' })}
                  className="btn-primary"
                  style={{ background: 'var(--yellow)', color: 'black', padding: '8px 15px', fontSize: '0.8rem', boxShadow: 'none' }}
                >
                  FS
                </button>
              )}

              {view !== 'welcome' && (
                <button
                  onClick={() => {
                    if (currentUser) {
                      setView(view === 'config' ? 'welcome' : 'config');
                    } else {
                      if (confirm("Deseja sair do jogo atual?")) setView('welcome');
                    }
                  }}
                  className="btn-secondary"
                  style={{ color: 'var(--danger)', border: 'none', padding: '8px' }}
                  title={currentUser ? (view === 'config' ? "Sair do Jogo" : "Voltar Config") : "Sair do Jogo"}
                >
                  <LogOut size={18} />
                </button>
              )}
            </div>
          </div>
        </nav>
      )}

      {/* PROJECTION OVERLAYS */}
      {isProjection && showFullscreenOverlay && (
        <div
          onClick={() => {
            if (!document.fullscreenElement) {
              document.documentElement.requestFullscreen()
                .then(() => setShowFullscreenOverlay(false))
                .catch(() => { });
            }
          }}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.95)', zIndex: 99999, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
        >
          <MousePointer2 size={120} color="var(--primary)" style={{ animation: 'bounce 2s infinite', filter: 'drop-shadow(0 0 30px var(--primary))', marginBottom: '40px' }} />
          <h1 className="text-huge title-gradient italic uppercase mb-20 text-center">Modo Projeção Fullscreen</h1>
          <p className="text-large mb-40 opacity-70">Aplicação web para entrar em tela cheia, clique aqui</p>
          <div className="btn-primary" style={{ padding: '30px 60px', fontSize: '2rem', animation: 'pulse 2s infinite' }}>
            PRESSIONE AQUI
          </div>
        </div>
      )}

      {/* GHOST OVERLAY: Silent catch-all for mouse interaction */}
      {isProjection && (
        <div
          onClick={() => {
            if (!document.fullscreenElement) {
              document.documentElement.requestFullscreen()
                .then(() => setShowFullscreenOverlay(false))
                .catch(() => { });
            }
          }}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 99998,
            background: 'transparent',
            cursor: 'none'
          }}
        />
      )}

      <main className="container">
        {isProjection ? (
          <StageViewport fitMode={fitMode}>
            {renderView()}
            <canvas ref={confettiCanvasRef} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 9999 }} />
          </StageViewport>
        ) : (
          <AnimatePresence mode="wait">
            {renderView()}
          </AnimatePresence>
        )}
      </main>

      {showScreenModal && screenDetails && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.9)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div className="glass-card" style={{ maxWidth: '600px', width: '100%', border: '2px solid var(--primary)', padding: '40px' }}>
            <h2 className="text-large title-gradient mb-20 italic">ONDE DESEJA PROJETAR?</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
              {screenDetails.screens.map((s: any, i: number) => (
                <div key={i} className="glass-card" style={{ background: 'rgba(255,255,255,0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px', margin: 0 }}>
                  <div style={{ textAlign: 'left' }}>
                    <p style={{ fontWeight: 900, fontSize: '1.2rem' }}>MONITOR {i + 1} {s.isPrimary ? '(PRINCIPAL)' : ''}</p>
                    <p style={{ opacity: 0.6, fontSize: '0.9rem' }}>{s.label || `Display ${i + 1}`} ({s.width}x{s.height})</p>
                  </div>
                  <div style={{ display: 'flex', gap: '10px' }}>
                    <button onClick={() => testScreen(s)} className="btn-secondary" style={{ padding: '4px 10px', fontSize: '0.7rem' }}>TESTAR</button>
                    <button onClick={() => actualOpen(s)} className="btn-primary" style={{ padding: '8px 25px' }}>USAR</button>
                  </div>
                </div>
              ))}
            </div>
            <button onClick={() => setShowScreenModal(false)} className="btn-secondary" style={{ marginTop: '30px', width: '100%' }}>CANCELAR</button>
          </div>
        </div>
      )}
    </div>
  );
}

function PlayingView({
  currentQuestionIndex, questions, groups, showAnswer,
  activeGroupId, setActiveGroupId,
  groupAnswers, setGroupAnswers,
  isProjection, onFinishQuestion, onNextQuestion,
  onPrevQuestion, onRollbackPoints, awardsByQuestion,
  setAnswersByQuestion // NEW PROP
}: any) {
  const q = questions[currentQuestionIndex];

  const handleFinish = () => {
    const pts = q.points || 1;

    // 1) Rollback: If points were already awarded for this question, remove them first
    const prevAwarded = awardsByQuestion[currentQuestionIndex] || [];
    let updatedGroups = groups.map((g: Group) => {
      if (prevAwarded.includes(g.id)) {
        return { ...g, score: Math.max(0, g.score - pts) };
      }
      return g;
    });

    // 2) Calculate Winners: Who actually got it right this time
    const winners = updatedGroups
      .filter((g: Group) => groupAnswers[g.id] === q.correctIndex)
      .map((g: Group) => g.id);

    // 3) Apply Points: Award to the current winners
    updatedGroups = updatedGroups.map((g: Group) => {
      if (winners.includes(g.id)) {
        return { ...g, score: g.score + pts };
      }
      return g;
    });

    // 4) Execute callbacks to update Master State
    onFinishQuestion(updatedGroups, winners);
  };

  const handleUnreveal = () => {
    const pts = q.points || 1;
    const prevAwarded = awardsByQuestion[currentQuestionIndex] || [];

    // 1) Rollback points
    const rolledBackGroups = groups.map((g: Group) => {
      if (prevAwarded.includes(g.id)) {
        return { ...g, score: Math.max(0, g.score - pts) };
      }
      return g;
    });

    // 2) Trigger rollback in Master
    onRollbackPoints(currentQuestionIndex, rolledBackGroups);
  };

  // Stable motion props to prevent flicker
  const motionProps: any = isProjection ? staticMotion : dynamicMotion;

  return (
    <motion.div {...motionProps} className="playing-container">
      <div className="playing-header" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px', marginBottom: '30px', width: '100%' }}>
        <div className="teams-list" style={{ display: 'flex', justifyContent: 'center', gap: '15px', flexWrap: 'nowrap', width: '100%', overflowX: 'auto', paddingBottom: '10px' }}>
          <div className="text-giant title-gradient shrink-0 italic" style={{ fontSize: '3rem', marginRight: '40px' }}>{currentQuestionIndex + 1}/{questions.length}</div>
          {groups.map((g: any, i: number) => {
            const isActive = activeGroupId === g.id;
            return (
              <div
                key={g.id} onClick={() => {
                  if (showAnswer || isProjection) return;
                  setActiveGroupId(g.id);
                  // Explicit save to history to avoid loop
                  setAnswersByQuestion((prev: any) => ({
                    ...prev,
                    [currentQuestionIndex]: {
                      activeGroupId: g.id,
                      groupAnswers: prev[currentQuestionIndex]?.groupAnswers || {}
                    }
                  }));
                }}
                className={`glass-card team-card ${!isProjection ? 'clickable' : ''}`}
                style={{ margin: 0, padding: '15px', minWidth: '220px', borderBottom: `8px solid ${isActive ? 'var(--success)' : COLORS[i % COLORS.length]}`, background: isActive ? 'rgba(34,197,94,0.1)' : 'var(--card-bg)' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div className="team-badge" style={{ backgroundColor: COLORS[i % COLORS.length], width: '45px', height: '45px', fontSize: '1.2rem' }}>{g.name[0]}</div>
                  <div style={{ textAlign: 'left' }}>
                    <p className="font-black uppercase opacity-40" style={{ fontSize: '0.7rem' }}>{g.name}</p>
                    <p className="text-large" style={{ fontSize: '2.2rem', lineHeight: 1 }}>{g.score} <span className="text-xs italic">PTS</span></p>
                  </div>
                  {groupAnswers[g.id] !== undefined && <div style={{ background: 'var(--success)', borderRadius: '50%', padding: '5px', marginLeft: 'auto' }}><UserCheck size={14} color="black" /></div>}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="question-box flex-center">
        <h2 className="text-huge uppercase italic title-gradient mb-10">{q.text}</h2>
        <div className="btn-primary" style={{ background: 'var(--yellow)', color: 'black', fontSize: '1.2rem', padding: '10px 30px', cursor: 'default' }}>✦ VALE {q.points || 1} PONTOS ✦</div>
      </div>

      <div className="answer-grid">
        {q.answers.map((ans: any, i: number) => {
          const isCorrect = i === q.correctIndex;
          const isSelected = Object.values(groupAnswers).includes(i);
          return (
            <button
              key={i}
              onClick={() => {
                if (showAnswer || isProjection || !activeGroupId) return;
                const newGroupAnswers = { ...groupAnswers, [activeGroupId]: i };
                setGroupAnswers(newGroupAnswers);
                setAnswersByQuestion((prev: any) => ({
                  ...prev,
                  [currentQuestionIndex]: { activeGroupId, groupAnswers: newGroupAnswers }
                }));
              }}
              className={`answer-btn ${showAnswer ? (isCorrect ? 'correct' : 'opacity-20') : (isSelected ? 'border-primary' : '')} ${isProjection ? 'no-hover' : ''}`}
              style={{
                position: 'relative',
                overflow: 'hidden',
                height: isProjection ? 'auto' : '120px', // FIXED HEIGHT ON OPERATOR SCREEN
                minHeight: isProjection ? '12vh' : 'auto'
              }}
            >
              <div className="team-badge" style={{
                background: (showAnswer && isCorrect) ? 'var(--success)' : (isSelected ? 'var(--primary)' : 'rgba(255,255,255,0.05)'),
                color: 'white', width: isProjection ? '60px' : '50px', height: isProjection ? '60px' : '50px', fontSize: isProjection ? '2rem' : '1.5rem', flexShrink: 0
              }}>
                {String.fromCharCode(65 + i)}
              </div>

              <div style={{ flex: 1, paddingRight: '15px' }}>
                <p className="text-large uppercase italic" style={{
                  fontSize: isProjection ? '2.2rem' : '1.5rem', // SLIGHTLY SMALLER ON OPERATOR SCREEN
                  color: 'white',
                  margin: 0,
                  display: '-webkit-box',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical',
                  overflow: 'hidden',
                  lineHeight: 1.2
                }}>{ans}</p>
              </div>

              {/* TEAM SELECTION INDICATORS - ABSOLUTE TO PREVENT GROWTH */}
              <div style={{ position: 'absolute', bottom: '8px', right: '10px', display: 'flex', gap: '5px' }}>
                {Object.entries(groupAnswers).filter(([_, a]) => a === i).map(([gid]) => {
                  const groupIndex = groups.findIndex((gr: any) => gr.id === gid);
                  return (
                    <motion.div
                      key={gid}
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      style={{
                        background: COLORS[groupIndex % COLORS.length],
                        color: 'black',
                        width: isProjection ? '36px' : '28px',
                        height: isProjection ? '36px' : '28px',
                        borderRadius: '50%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 900,
                        fontSize: '0.7rem',
                        boxShadow: '0 4px 10px rgba(0,0,0,0.4)',
                        border: '2px solid white'
                      }}
                    >
                      {groups[groupIndex]?.name[0]}
                    </motion.div>
                  );
                })}
              </div>

              {showAnswer && isCorrect && (
                <div style={{ position: 'absolute', right: '8px', top: '10px' }}>
                  <PartyPopper size={isProjection ? 50 : 35} color="var(--success)" style={{ opacity: 0.8 }} />
                </div>
              )}
            </button>
          );
        })}
      </div>

      <div className="flex-center" style={{ marginTop: '15px', gap: '15px' }}>
        <div style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
          {!isProjection && (
            <button onClick={onPrevQuestion} className="btn-secondary" style={{ padding: '12px 25px', fontWeight: 900, fontSize: '0.9rem' }}>ANTERIOR</button>
          )}

          {!showAnswer ? (
            <button
              onClick={() => !isProjection && (Object.keys(groupAnswers).length > 0 ? handleFinish() : alert("Escolha uma resposta!"))}
              className={`btn-primary ${isProjection ? 'no-hover' : ''}`}
              style={{ fontSize: isProjection ? '1.8rem' : '1.8rem', padding: '12px 50px', cursor: isProjection ? 'default' : 'pointer', minWidth: '300px' }}
            >
              REVELAR RESPOSTA
            </button>
          ) : (
            <div style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
              {!isProjection && (
                <button
                  onClick={handleUnreveal}
                  className="btn-secondary"
                  style={{ padding: '12px 25px', borderColor: 'var(--yellow)', color: 'var(--yellow)', fontWeight: 900, fontSize: '0.9rem' }}
                >
                  CORRIGIR
                </button>
              )}
              <button
                onClick={() => !isProjection && onNextQuestion()}
                className={`btn-primary ${isProjection ? 'no-hover' : ''}`}
                style={{ fontSize: isProjection ? '1.2rem' : '1.4rem', padding: '12px 40px', cursor: isProjection ? 'default' : 'pointer' }}
              >
                {currentQuestionIndex === questions.length - 1 ? 'RESULTADO FINAL 🏁' : 'PRÓXIMO DESAFIO'} {!isProjection && <ChevronRight size={25} />}
              </button>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}
