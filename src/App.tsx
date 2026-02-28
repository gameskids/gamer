import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Trophy, ChevronRight, LogOut, Star, PartyPopper,
  Rocket, Download, Upload, RotateCcw,
  UserCheck, Trash2, Plus, FileSpreadsheet
} from 'lucide-react';
import confetti from 'canvas-confetti';
import * as XLSX from 'xlsx';

// --- TYPES ---
interface Question {
  id: string; text: string; answers: string[]; correctIndex: number; points: number;
}
interface Group {
  id: string; name: string; score: number;
}
type View = 'welcome' | 'config' | 'playing' | 'ranking';

const COLORS = ['#8B5CF6', '#EC4899', '#10B981', '#FBBF24', '#F87171', '#6366F1'];

const pageVariants: any = {
  initial: { opacity: 0, x: 20 },
  enter: { opacity: 1, x: 0, transition: { duration: 0.4 } },
  exit: { opacity: 0, x: -20, transition: { duration: 0.2 } }
};

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
  const [currentUser, setCurrentUser] = useState<string | null>(null);

  useEffect(() => {
    const savedUser = localStorage.getItem('quiz_user');
    const savedGame = localStorage.getItem('quiz_save_data');
    if (savedUser) setCurrentUser(savedUser);
    if (savedGame) {
      try {
        const data = JSON.parse(savedGame);
        setGameTitle(data.title || 'ACERTE A RESPOSTA');
        setQuestions(data.questions || []);
        setGroups(data.groups || []);
        setGamePoints(data.points || 1);
        setRankingTitle(data.rankingTitle || 'GRANDE FINAL MISSIONÁRIA');
        setRankingSubtitle(data.rankingSubtitle || 'Ranking dos Times');
      } catch (e) { console.error(e); }
    }
  }, []);

  const saveToLocal = (title?: string, qs?: Question[], gs?: Group[], pts?: number, rTitle?: string, rSub?: string) => {
    const data = {
      title: title ?? gameTitle,
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
          setGameTitle(data.title); setQuestions(data.questions); setGroups(data.groups); setGamePoints(data.points || 1);
          setRankingTitle(data.rankingTitle || 'GRANDE FINAL MISSIONÁRIA');
          setRankingSubtitle(data.rankingSubtitle || 'Ranking dos Times');
          saveToLocal(data.title, data.questions, data.groups, data.points, data.rankingTitle, data.rankingSubtitle);
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

  const celebration = () => {
    const duration = 15 * 1000;
    const animationEnd = Date.now() + duration;
    const interval: any = setInterval(() => {
      const timeLeft = animationEnd - Date.now();
      if (timeLeft <= 0) return clearInterval(interval);
      confetti({ particleCount: 150, spread: 360, origin: { x: Math.random(), y: Math.random() - 0.2 } });
    }, 250);
  };

  return (
    <div className="app-root">
      <nav>
        <div className="clickable" style={{ display: 'flex', alignItems: 'center', gap: '15px' }} onClick={() => setView('welcome')}>
          <Trophy size={32} color="var(--yellow)" fill="var(--yellow)" />
          <h1 className="nav-title">{gameTitle}</h1>
        </div>

        <div style={{ display: 'flex', gap: '30px', alignItems: 'center' }}>
          {currentUser && (
            <div style={{ display: 'flex', gap: '10px' }}>
              <button title="Exportar" onClick={handleExport} className="btn-secondary"><Download size={18} /></button>
              <button title="Importar" onClick={handleImport} className="btn-secondary"><Upload size={18} /></button>
            </div>
          )}
          <button
            className="btn-secondary"
            style={{ borderColor: 'var(--primary)', color: 'white' }}
            onClick={() => {
              const name = prompt("Nome do Mestre:");
              if (name) { setCurrentUser(name); localStorage.setItem('quiz_user', name); }
              else { setCurrentUser(null); localStorage.removeItem('quiz_user'); }
            }}
          >
            {currentUser ? `MESTRE: ${currentUser}` : 'ATIVAR MESTRE'}
          </button>
          {view !== 'welcome' && (
            <button onClick={() => setView('welcome')} className="btn-secondary" style={{ color: 'var(--danger)', border: 'none' }}>
              <LogOut size={18} /> SAIR
            </button>
          )}
        </div>
      </nav>

      <main className="container">
        <AnimatePresence mode="wait">
          {view === 'welcome' && (
            <motion.div key="welcome" initial="initial" animate="enter" exit="exit" variants={pageVariants} className="flex-center">
              <div className="glass-card flex-center" style={{ maxWidth: '1000px' }}>
                <Rocket size={100} color="var(--primary)" style={{ marginBottom: '30px' }} />
                <h1 className="text-huge title-gradient uppercase italic mb-20">{gameTitle}</h1>
                <p style={{ letterSpacing: '8px', opacity: 0.4, fontWeight: 900 }} className="uppercase mb-40">The Missionary Experience</p>
              </div>
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
            </motion.div>
          )}

          {view === 'config' && (
            <motion.div key="config" initial="initial" animate="enter" exit="exit" variants={pageVariants} style={{ width: '100%' }}>
              <section className="glass-card">
                <h3 className="uppercase font-black italic mb-20">Configuração do Evento</h3>
                <input
                  className="input-field" style={{ fontSize: '2.5rem', fontWeight: 900, padding: '20px' }}
                  value={gameTitle}
                  onChange={(e) => { setGameTitle(e.target.value.toUpperCase()); saveToLocal(e.target.value.toUpperCase()); }}
                />
                <div style={{ display: 'flex', gap: '20px', marginTop: '30px' }}>
                  {currentUser && <button onClick={() => { if (confirm("Limpar placar?")) resetAllPoints(); }} className="btn-secondary" style={{ fontSize: '1rem', flex: 1 }}><RotateCcw size={16} /> Zerar Placar</button>}
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
          )}

          {view === 'playing' && (
            <PlayingView
              key="playing"
              currentQuestionIndex={currentQuestionIndex} questions={questions} groups={groups} showAnswer={showAnswer}
              onFinishQuestion={(fgs: Group[]) => { setGroups(fgs); saveToLocal(gameTitle, questions, fgs); setShowAnswer(true); }}
              onNextQuestion={() => {
                if (currentQuestionIndex < questions.length - 1) { setCurrentQuestionIndex(prev => prev + 1); setShowAnswer(false); }
                else { setView('ranking'); celebration(); }
              }}
            />
          )}

          {view === 'ranking' && (
            <motion.div key="ranking" initial="initial" animate="enter" exit="exit" variants={pageVariants} className="flex-center">
              <Trophy size={250} color="var(--yellow)" style={{ filter: 'drop-shadow(0 0 80px rgba(251,191,36,0.5))', marginBottom: '40px' }} />
              <h1 className="text-huge title-gradient uppercase italic mb-40">{rankingTitle}</h1>
              <div className="scoreboard-box">
                <div className="scoreboard-header-cell">🏅 {rankingSubtitle} 🎖️</div>
                <div className="scoreboard-grid">
                  {[...groups].sort((a, b) => b.score - a.score).map((g) => (
                    <div key={g.id} style={{ display: 'contents' }}>
                      <div className="scoreboard-item italic font-black">{g.name}</div>
                      <div className="scoreboard-item pts">{g.score}</div>
                    </div>
                  ))}
                </div>
              </div>
              <div style={{ display: 'flex', gap: '30px', marginTop: '60px' }}>
                <button onClick={() => setView('welcome')} className="btn-secondary" style={{ fontSize: '1.5rem', padding: '20px 40px' }}>Menu Início</button>
                <button onClick={() => {
                  if (confirm("ISSO APAGARÁ TUDO!")) {
                    resetAllPoints();
                    setCurrentQuestionIndex(0);
                    setShowAnswer(false);
                    setView('welcome');
                  }
                }}
                  className="btn-primary"
                  style={{ fontSize: '3rem', padding: '40px 80px' }}
                >RECOMECAR TUDO 🔄</button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}

function PlayingView({ currentQuestionIndex, questions, groups, showAnswer, onFinishQuestion, onNextQuestion }: any) {
  const q = questions[currentQuestionIndex];
  const [activeGroupId, setActiveGroupId] = useState<string | null>(null);
  const [groupAnswers, setGroupAnswers] = useState<{ [groupId: string]: number }>({});

  useEffect(() => {
    setGroupAnswers({});
    setActiveGroupId(null);
  }, [currentQuestionIndex]);

  const handleFinish = () => {
    const finalGroups = groups.map((g: Group) => (groupAnswers[g.id] === q.correctIndex ? { ...g, score: g.score + (q.points || 1) } : g));
    onFinishQuestion(finalGroups);
  };

  return (
    <motion.div initial="initial" animate="enter" exit="exit" variants={pageVariants} className="playing-container">
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px', marginBottom: '30px', width: '100%' }}>
        <div style={{ display: 'flex', justifyContent: 'center', gap: '15px', flexWrap: 'nowrap', width: '100%', overflowX: 'auto', paddingBottom: '10px' }}>
          <div className="text-giant title-gradient shrink-0 italic" style={{ fontSize: '3rem', marginRight: '40px' }}>{currentQuestionIndex + 1}/{questions.length}</div>
          {groups.map((g: any, i: number) => {
            const isActive = activeGroupId === g.id;
            return (
              <div
                key={g.id} onClick={() => !showAnswer && setActiveGroupId(g.id)}
                className="glass-card clickable"
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
              key={i} onClick={() => !showAnswer && activeGroupId && setGroupAnswers({ ...groupAnswers, [activeGroupId]: i })}
              className={`answer-btn ${showAnswer ? (isCorrect ? 'correct' : 'opacity-20') : (isSelected ? 'border-primary' : '')}`}
            >
              <div className="team-badge" style={{ background: showAnswer && isCorrect ? 'var(--success)' : (isSelected ? 'var(--primary)' : 'rgba(255,255,255,0.05)'), color: 'white', width: '45px', height: '45px', fontSize: '1.5rem' }}>{String.fromCharCode(65 + i)}</div>
              <div style={{ flex: 1 }}>
                <p className="text-large uppercase italic" style={{ fontSize: '2.2rem', color: 'white' }}>{ans}</p>
                <div style={{ display: 'flex', gap: '8px', marginTop: '5px' }}>
                  {Object.entries(groupAnswers).filter(([_, a]) => a === i).map(([gid]) => {
                    const groupIndex = groups.findIndex((gr: any) => gr.id === gid);
                    return (
                      <div
                        key={gid}
                        style={{
                          background: COLORS[groupIndex % COLORS.length],
                          color: 'black',
                          padding: '6px 14px',
                          borderRadius: '10px',
                          fontWeight: 900,
                          fontSize: '0.8rem',
                          boxShadow: '0 4px 10px rgba(0,0,0,0.3)',
                          border: '2px solid white'
                        }}
                      >
                        {groups[groupIndex]?.name[0]}
                      </div>
                    );
                  })}
                </div>
              </div>
              {showAnswer && isCorrect && <PartyPopper size={50} color="var(--success)" />}
            </button>
          );
        })}
      </div>

      <div className="flex-center" style={{ marginBottom: '10px' }}>
        {!showAnswer ? (
          <button onClick={() => Object.keys(groupAnswers).length > 0 ? handleFinish() : alert("Escolha uma resposta!")} className="btn-primary" style={{ fontSize: '2.5rem', padding: '15px 50px' }}>REVELAR RESPOSTA</button>
        ) : (
          <button onClick={onNextQuestion} className="btn-primary" style={{ fontSize: '1.5rem', padding: '15px 40px' }}>
            {currentQuestionIndex === questions.length - 1 ? 'RESULTADO FINAL 🏁' : 'PRÓXIMO DESAFIO'} <ChevronRight size={30} />
          </button>
        )}
      </div>
    </motion.div>
  );
}
