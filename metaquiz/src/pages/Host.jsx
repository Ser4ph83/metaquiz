import { useState, useEffect } from 'react';
import { supabase } from '../supabase';

export default function Host() {
  const [pin, setPin] = useState('');
  const [quiz, setQuiz] = useState(null);
  const [players, setPlayers] = useState([]);
  const [questions, setQuestions] = useState([]);
  const [currentQIndex, setCurrentQIndex] = useState(-1);
  const [error, setError] = useState('');
  const [timeLeft, setTimeLeft] = useState(0);
  const [leaderboard, setLeaderboard] = useState([]); // Guarda o ranking final

  const showResults = timeLeft === 0 && currentQIndex >= 0;

  const openLobby = async (e) => {
    e.preventDefault();
    setError('');
    const { data, error } = await supabase.from('quizzes').select('*').eq('pin', pin).single();
    if (error || !data) return setError('PIN não encontrado.');
    setQuiz(data);
    const { data: existingPlayers } = await supabase.from('players').select('*').eq('quiz_id', data.id);
    if (existingPlayers) setPlayers(existingPlayers);
  };

  useEffect(() => {
    if (!quiz) return;
    const subscription = supabase
      .channel('jogadores')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'players', filter: `quiz_id=eq.${quiz.id}` }, 
      (payload) => setPlayers((prev) => [...prev, payload.new]))
      .subscribe();
    return () => supabase.removeChannel(subscription);
  }, [quiz]);

  const startGame = async () => {
    const { data } = await supabase.from('questions').select('*').eq('quiz_id', quiz.id).order('id', { ascending: true });
    if (data && data.length > 0) {
      setQuestions(data);
      setCurrentQIndex(0);
      setTimeLeft(data[0].time_limit);
      await supabase.from('quizzes').update({ current_step: 0 }).eq('id', quiz.id);
    } else {
      alert('Nenhuma pergunta cadastrada!');
    }
  };

  // Motor de Cálculo do Pódio
  const generateLeaderboard = async () => {
    const { data: allAnswers } = await supabase.from('answers').select('*').eq('quiz_id', quiz.id);
    
    let scores = {};
    players.forEach(p => scores[p.id] = { name: p.name, score: 0 });

    if (allAnswers) {
      allAnswers.forEach(ans => {
        const question = questions[ans.question_index];
        if (question && ans.selected_option === question.correct_answer) {
          // Fórmula: 500 pontos por acertar + bônus de velocidade (até 500)
          const timeRatio = Math.max(0, question.time_limit - ans.reaction_time) / question.time_limit;
          const points = Math.round(500 + (500 * timeRatio));
          if (scores[ans.player_id]) scores[ans.player_id].score += points;
        }
      });
    }

    // Ordena do maior para o menor
    const sorted = Object.values(scores).sort((a, b) => b.score - a.score);
    setLeaderboard(sorted);
  };

  const nextQuestion = async () => {
    if (currentQIndex + 1 < questions.length) {
      const nextIndex = currentQIndex + 1;
      setCurrentQIndex(nextIndex);
      setTimeLeft(questions[nextIndex].time_limit);
      await supabase.from('quizzes').update({ current_step: nextIndex }).eq('id', quiz.id);
    } else {
      await generateLeaderboard();
      await supabase.from('quizzes').update({ current_step: -2 }).eq('id', quiz.id);
      setCurrentQIndex(-2); // -2 é a tela do Pódio
    }
  };

  useEffect(() => {
    if (currentQIndex >= 0 && timeLeft > 0) {
      const timer = setTimeout(() => setTimeLeft(timeLeft - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [timeLeft, currentQIndex]);

  if (!quiz) {
    return (
      <div style={{ textAlign: 'center', marginTop: '100px', fontFamily: 'sans-serif' }}>
        <h1>🖥️ Telão do Professor</h1>
        <form onSubmit={openLobby}>
          <input type="text" placeholder="PIN" value={pin} onChange={(e) => setPin(e.target.value)} style={{ fontSize: '24px', padding: '10px', textAlign: 'center' }} />
          <br/><br/>
          <button type="submit" style={{ fontSize: '20px', padding: '10px 40px', cursor: 'pointer' }}>Abrir Lobby</button>
        </form>
        {error && <p style={{ color: 'red' }}>{error}</p>}
      </div>
    );
  }

  // TELA FINAL: O Pódio
  if (currentQIndex === -2) {
    return (
      <div style={{ textAlign: 'center', padding: '50px', fontFamily: 'sans-serif', background: '#222', minHeight: '100vh', color: '#fff' }}>
        <h1 style={{ fontSize: '60px', color: '#ffd700', marginBottom: '40px' }}>🏆 PÓDIO FINAL 🏆</h1>
        
        <div style={{ maxWidth: '600px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '15px' }}>
          {leaderboard.map((player, index) => {
            // Cores das medalhas
            const bg = index === 0 ? '#ffd700' : index === 1 ? '#c0c0c0' : index === 2 ? '#cd7f32' : '#444';
            const color = index < 3 ? '#000' : '#fff';
            
            return (
              <div key={index} style={{ background: bg, color: color, padding: '20px 30px', borderRadius: '12px', fontSize: '30px', fontWeight: 'bold', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>{index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}º`} {player.name}</span>
                <span>{player.score} pts</span>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // TELA DO JOGO (Rodando ou Resultado da Pergunta)
  if (currentQIndex >= 0) {
    const question = questions[currentQIndex];
    const colors = ['#e21b3c', '#1368ce', '#d89e00', '#26890c'];

    return (
      <div style={{ textAlign: 'center', padding: '40px', fontFamily: 'sans-serif', background: '#f8f9fa', minHeight: '100vh' }}>
        <div style={{ background: '#fff', padding: '30px', borderRadius: '15px', boxShadow: '0 4px 10px rgba(0,0,0,0.1)', maxWidth: '1000px', margin: '0 auto 30px auto' }}>
          <h2 style={{ fontSize: '45px', margin: 0, color: '#333' }}>{question.question_text}</h2>
        </div>
        
        {!showResults ? (
           <div style={{ fontSize: '80px', margin: '20px 0', fontWeight: 'bold', color: timeLeft <= 5 ? 'red' : 'black' }}>
             ⏱️ {timeLeft}
           </div>
        ) : (
           <div style={{ fontSize: '50px', margin: '20px 0', fontWeight: 'bold', color: '#333' }}>Tempo Esgotado!</div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', maxWidth: '1000px', margin: '30px auto' }}>
          {question.options.map((opt, i) => {
            if (!opt) return null;
            const isCorrect = question.correct_answer === i;
            const opacity = showResults ? (isCorrect ? 1 : 0.3) : 1;
            return (
              <div key={i} style={{ background: colors[i], color: '#fff', padding: '30px', fontSize: '28px', borderRadius: '12px', fontWeight: 'bold', opacity, transition: 'opacity 0.5s' }}>
                {opt} {showResults && isCorrect && '✅'}
              </div>
            );
          })}
        </div>

        {showResults && (
          <button onClick={nextQuestion} style={{ fontSize: '24px', padding: '15px 50px', background: '#007bff', color: '#fff', cursor: 'pointer', border: 'none', borderRadius: '8px', fontWeight: 'bold' }}>
            {currentQIndex + 1 < questions.length ? 'Próxima Pergunta ➔' : 'Mostrar Pódio 🏆'}
          </button>
        )}
      </div>
    );
  }

  // TELA LOBBY
  return (
    <div style={{ textAlign: 'center', marginTop: '50px', fontFamily: 'sans-serif' }}>
      <h1>MetaQuiz</h1>
      <h2 style={{ fontSize: '100px', margin: '10px 0', letterSpacing: '5px' }}>{quiz.pin}</h2>
      <div style={{ background: '#eee', padding: '30px', borderRadius: '15px', maxWidth: '800px', margin: '40px auto', minHeight: '250px' }}>
        <h3 style={{ margin: '0 0 20px 0' }}>Alunos na sala: {players.length}</h3>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '15px', justifyContent: 'center' }}>
          {players.map(p => <div key={p.id} style={{ background: '#333', color: '#fff', padding: '10px 25px', borderRadius: '8px', fontSize: '22px', fontWeight: 'bold' }}>{p.name}</div>)}
        </div>
      </div>
      <button onClick={startGame} style={{ fontSize: '24px', padding: '15px 60px', background: '#28a745', color: '#fff', cursor: 'pointer', border: 'none', borderRadius: '8px', fontWeight: 'bold' }}>
        Iniciar Partida
      </button>
    </div>
  );
}