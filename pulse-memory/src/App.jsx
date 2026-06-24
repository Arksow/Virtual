import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ChevronRight, Delete, Sparkles, TimerReset } from 'lucide-react';

const TOKENS = [
  { id: 'circle', label: '●', name: 'circle', kind: 'shape' },
  { id: 'square', label: '■', name: 'square', kind: 'shape' },
  { id: 'triangle', label: '▲', name: 'triangle', kind: 'shape' },
  { id: 'diamond', label: '◆', name: 'diamond', kind: 'shape' },
  { id: 'star', label: '★', name: 'star', kind: 'shape' },
  { id: 'plus', label: '+', name: 'plus', kind: 'symbol' },
  { id: 'multiply', label: '×', name: 'multiply', kind: 'symbol' },
  { id: 'wave', label: '≈', name: 'wave', kind: 'symbol' },
  { id: 'one', label: '1', name: 'one', kind: 'number' },
  { id: 'two', label: '2', name: 'two', kind: 'number' },
  { id: 'three', label: '3', name: 'three', kind: 'number' },
  { id: 'four', label: '4', name: 'four', kind: 'number' },
];

const makeSequence = (wave) => Array.from({ length: wave + 2 }, () => TOKENS[Math.floor(Math.random() * TOKENS.length)]);
const formatTime = (seconds) => `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;

export function App() {
  const [wave, setWave] = useState(1);
  const [sequence, setSequence] = useState(() => makeSequence(1));
  const [input, setInput] = useState([]);
  const [phase, setPhase] = useState('intro');
  const [visibleIndex, setVisibleIndex] = useState(-1);
  const [seconds, setSeconds] = useState(0);
  const [message, setMessage] = useState('Ready when you are.');
  const inputRef = useRef([]);

  const resetWave = useCallback((nextWave = wave) => {
    setSequence(makeSequence(nextWave));
    setInput([]);
    inputRef.current = [];
    setVisibleIndex(-1);
    setPhase('intro');
    setMessage('Ready when you are.');
  }, [wave]);

  const playSequence = useCallback(() => {
    setInput([]);
    inputRef.current = [];
    setPhase('showing');
    setMessage('Watch closely…');
    setVisibleIndex(-1);
    sequence.forEach((_, index) => {
      window.setTimeout(() => setVisibleIndex(index), 450 + index * 750);
    });
    window.setTimeout(() => {
      setVisibleIndex(-1);
      setPhase('input');
      setMessage('Your turn — repeat the sequence.');
    }, 450 + sequence.length * 750 + 240);
  }, [sequence]);

  useEffect(() => {
    if (phase !== 'showing' && phase !== 'input') return undefined;
    const timer = window.setInterval(() => setSeconds((value) => value + 1), 1000);
    return () => window.clearInterval(timer);
  }, [phase]);

  const chooseToken = (token) => {
    if (phase !== 'input' || input.length >= sequence.length) return;
    const next = [...input, token];
    inputRef.current = next;
    setInput(next);
    if (next.length === sequence.length) setMessage('Sequence complete — check your answer.');
  };

  const submit = () => {
    if (phase !== 'input' || input.length !== sequence.length) {
      setMessage(`Choose all ${sequence.length} prompts first.`);
      return;
    }
    const correct = input.every((token, index) => token.id === sequence[index].id);
    if (!correct) {
      setPhase('mistake');
      setMessage('Not quite. The pattern is replaying — you’ve got this.');
      window.setTimeout(playSequence, 1100);
      return;
    }
    if (wave === 8) {
      setPhase('complete');
      setMessage('All eight waves cleared.');
      return;
    }
    const nextWave = wave + 1;
    setPhase('success');
    setMessage(`Wave ${wave} cleared. Get ready for ${sequence.length + 1} prompts.`);
    window.setTimeout(() => {
      setWave(nextWave);
      setSequence(makeSequence(nextWave));
      setInput([]);
      inputRef.current = [];
      setVisibleIndex(-1);
      setPhase('intro');
      setMessage(`Wave ${nextWave} is ready.`);
    }, 1200);
  };

  const restart = () => {
    setWave(1);
    setSeconds(0);
    setSequence(makeSequence(1));
    setInput([]);
    inputRef.current = [];
    setVisibleIndex(-1);
    setPhase('intro');
    setMessage('Fresh run. Ready when you are.');
  };

  const progress = useMemo(() => `${((wave - 1) / 8) * 100}%`, [wave]);
  const actionLabel = phase === 'intro' ? 'Start' : phase === 'complete' ? 'Play again' : 'Check answer';
  const action = phase === 'intro' ? playSequence : phase === 'complete' ? restart : submit;

  if (phase === 'complete') {
    return (
      <main className="completion-screen">
        <div className="ambient ambient-cyan" />
        <div className="ambient ambient-pink" />
        <section className="completion-content" aria-live="polite">
          <p className="completion-label">TIME TAKEN</p>
          <p className="completion-result">{formatTime(seconds)}</p>
          <p className="completion-hint">To find your location, follow the sound.<br />Go where voices are recorded and stories are shared.</p>
        </section>
      </main>
    );
  }

  return (
    <main className="app-shell">
      <div className="ambient ambient-cyan" />
      <div className="ambient ambient-pink" />
      <header className="topbar">
        <div className="brand"><span className="brand-mark"><Sparkles size={16} /></span><span>Pulse <b>Memory</b></span></div>
        <div className="wave-label">WAVE <span>{wave}</span> OF 8</div>
      </header>

      <section className="game-stage" aria-live="polite">
        <div className="timer-orbit" style={{ '--progress': progress }}>
          <div className="timer-core">
            <span className="timer-caption"><TimerReset size={15} /> ELAPSED TIME</span>
            <strong>{formatTime(seconds)}</strong>
            <span className="timer-wave">WAVE {wave} / 8</span>
          </div>
        </div>

        <div className="title-block">
          <p className={`status ${phase}`}>{phase === 'showing' ? 'WATCH NOW' : 'YOUR TURN'}</p>
          <p>{message}</p>
        </div>

        <div className={`sequence-slots ${phase}`} aria-label="Sequence answer slots">
          {sequence.map((token, index) => {
            const showPrompt = phase === 'showing' && visibleIndex === index;
            const answer = input[index];
            return <div className={`slot ${showPrompt ? 'is-visible' : ''} ${answer ? 'is-filled' : ''}`} key={`${token.id}-${index}`}>
              {showPrompt && <span>{token.label}</span>}
              {!showPrompt && answer && <span>{answer.label}</span>}
              {!showPrompt && !answer && <i>{index + 1}</i>}
            </div>;
          })}
        </div>

        <div className="input-panel">
          <div className="panel-heading"><span>SELECT PROMPTS</span><span>{input.length} / {sequence.length}</span></div>
          <div className="token-grid">
            {TOKENS.map((token, index) => <button className={`token token-${index % 4}`} onClick={() => chooseToken(token)} disabled={phase !== 'input'} key={token.id} aria-label={token.name}>
              {token.label}
            </button>)}
          </div>
          <div className="panel-actions">
            <button className="undo" onClick={() => { if (phase === 'input') setInput((value) => value.slice(0, -1)); }} disabled={phase !== 'input' || !input.length}><Delete size={18} /> Undo</button>
            <button className="primary-action" onClick={action} disabled={phase === 'showing' || phase === 'success'}>{actionLabel}{phase !== 'complete' && <ChevronRight size={21} />}</button>
          </div>
        </div>
      </section>
    </main>
  );
}
