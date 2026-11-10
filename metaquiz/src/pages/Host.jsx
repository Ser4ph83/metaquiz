import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabase';

export default function Host() {
  const [pin, setPin] = useState('');
  const [quiz, setQuiz] = useState(null);
  const [players, setPlayers] = useState([]);
  const [questions, setQuestions] = useState([]);
  const [currentQIndex, setCurrentQIndex] = useState(-1);
  const [error, setError] = useState('');
  const [timeLeft, setTimeLeft] = useState(0);
  const [leaderboard, setLeaderboard] = useState([]);
  
  const navigate = useNavigate();
  const showResults = timeLeft === 0 && currentQIndex >= 0;

  const openLobby = async (e) => {
    e.preventDefault();
    setError('');
    
    // 1. Localiza a sala pelo PIN
    const { data, error } = await supabase.from('quizzes').select('*').eq('pin', pin).single();
    if (error || !data) return setError('PIN não encontrado. Verifique se digitou certo.');
    
    setQuiz(data);

    // 2. LIMPEZA AUTOMÁTICA: Apaga respostas e alunos de partidas anteriores
    await supabase.from('answers').delete().eq('quiz_id', data.id);
    await supabase.from('players').delete().eq('quiz_id', data.id);
    await supabase.from('quizzes').update({ current_step: -1 }).eq('id', data.id);
    
    // 3. Garante que a lista comece zerada no estado local
    setPlayers([]);
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
      alert('Nenhuma pergunta cadastrada nesta sala!');
    }
  };

  // Zera as respostas no banco e reinicia a partida para o Lobby
  const restartGame = async () => {
    await supabase.from('answers').delete().eq('quiz_id', quiz.id);
    await supabase.from('quizzes').update({ current_step: -1 }).eq('id', quiz.id);
    setCurrentQIndex(-1);
    setLeaderboard([]);
  };

  const generateLeaderboard = async () => {
    const { data: allAnswers } = await supabase.from('answers').select('*').eq('quiz_id', quiz.id);
    
    let scores = {};
    players.forEach(p => scores[p.id] = { name: p.name, score: 0 });

    if (allAnswers) {
      allAnswers.forEach(ans => {
        const question = questions[ans.question_index];
        if (question && ans.selected_option === question.correct_answer) {
          const timeRatio = Math.max(0, question.time_limit - ans.reaction_time) / question.time_limit;
          const points = Math.round(500 + (500 * timeRatio));
          if (scores[ans.player_id]) scores[ans.player_id].score += points;
        }
      });
    }

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
      setCurrentQIndex(-2);
    }
  };

  useEffect(() => {
    if (currentQIndex >= 0 && timeLeft > 0) {
      const timer = setTimeout(() => setTimeLeft(timeLeft - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [timeLeft, currentQIndex]);

  // 1. TELA DE BUSCA DE PIN
  if (!quiz) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-900 via-indigo-900 to-purple-900 p-4 font-sans text-white">
        <div className="bg-white/10 backdrop-blur-md p-10 rounded-3xl border border-white/20 shadow-2xl max-w-md w-full text-center">
          <h1 className="text-4xl font-black mb-2">🖥️ Telão Host</h1>
          <p className="text-blue-200 mb-8 font-medium">Projeção de Sala Interativa</p>
          
          <form onSubmit={openLobby} className="space-y-6">
            <input 
              type="text" 
              placeholder="Digite o PIN" 
              value={pin} 
              onChange={(e) => setPin(e.target.value)} 
              className="w-full text-center text-4xl tracking-widest font-black py-4 bg-white/20 border-2 border-white/30 rounded-2xl outline-none focus:border-white focus:bg-white/30 transition-all text-white placeholder-blue-200" 
            />
            <button 
              type="submit" 
              className="w-full py-4 text-xl font-black bg-emerald-500 hover:bg-emerald-400 text-gray-900 rounded-2xl shadow-lg transition-transform transform hover:scale-105 cursor-pointer"
            >
              Abrir Lobby 🚀
            </button>
          </form>
          {error && <p className="mt-4 text-red-300 font-bold bg-red-900/50 p-3 rounded-xl border border-red-500/30">{error}</p>}
        </div>
      </div>
    );
  }

  // 2. TELA FINAL: PÓDIO COM NAVEGAÇÃO DE RETORNO
  if (currentQIndex === -2) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 font-sans text-white">
        <div className="text-center mb-10 animate-bounce">
          <h1 className="text-6xl font-black text-amber-400 tracking-tight drop-shadow-lg">🏆 PÓDIO FINAL 🏆</h1>
          <p className="text-slate-400 text-xl mt-2 font-medium">Parabéns aos vencedores da partida!</p>
        </div>

        <div className="max-w-2xl w-full space-y-4 mb-10">
          {leaderboard.map((player, index) => {
            const styles = [
              "bg-gradient-to-r from-amber-400 to-yellow-500 text-slate-950 scale-105 shadow-amber-500/20",
              "bg-gradient-to-r from-slate-300 to-slate-400 text-slate-950 shadow-slate-400/20",
              "bg-gradient-to-r from-amber-700 to-amber-800 text-white shadow-amber-800/20",
              "bg-slate-800 text-slate-200 border border-slate-700"
            ];
            const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}º`;
            const currentStyle = styles[index] || styles[3];

            return (
              <div 
                key={index} 
                className={`p-6 rounded-2xl font-black text-2xl flex items-center justify-between shadow-xl transition-all ${currentStyle}`}
              >
                <span className="flex items-center gap-4">
                  <span className="text-3xl">{medal}</span>
                  <span>{player.name}</span>
                </span>
                <span className="font-mono tracking-wider">{player.score} pts</span>
              </div>
            );
          })}
        </div>

        {/* Barra de Ações Pós-Jogo */}
        <div className="flex flex-wrap gap-4 justify-center max-w-2xl w-full">
          <button 
            onClick={restartGame}
            className="flex-1 min-w-[200px] py-4 font-black text-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 rounded-2xl shadow-xl transition-all transform active:scale-95 cursor-pointer"
          >
            🔄 Jogar Novamente
          </button>
          <button 
            onClick={() => { setQuiz(null); setPin(''); setCurrentQIndex(-1); }}
            className="flex-1 min-w-[200px] py-4 font-black text-lg bg-slate-800 hover:bg-slate-700 text-white border border-slate-700 rounded-2xl shadow-xl transition-all transform active:scale-95 cursor-pointer"
          >
            🖥️ Digitar Outro PIN
          </button>
          <button 
            onClick={() => navigate('/admin')}
            className="flex-1 min-w-[200px] py-4 font-black text-lg bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl shadow-xl transition-all transform active:scale-95 cursor-pointer"
          >
            👨‍🏫 Ir para o Admin
          </button>
        </div>
      </div>
    );
  }

  // 3. TELA DA PERGUNTA (EM ANDAMENTO OU RESULTADO)
  if (currentQIndex >= 0) {
    const question = questions[currentQIndex];
    const bgColors = ['bg-red-600', 'bg-blue-600', 'bg-amber-500', 'bg-emerald-600'];

    return (
      <div className="min-h-screen bg-slate-100 flex flex-col p-6 font-sans text-slate-800 justify-between">
        <div className="bg-white p-8 rounded-3xl shadow-lg border border-slate-200 text-center max-w-5xl w-full mx-auto">
          <span className="text-sm font-bold text-slate-400 uppercase tracking-widest block mb-2">Pergunta {currentQIndex + 1} de {questions.length}</span>
          <h2 className="text-4xl font-extrabold text-slate-800">{question.question_text}</h2>
        </div>

        <div className="text-center my-6">
          {!showResults ? (
            <div className={`inline-flex items-center gap-3 px-8 py-4 rounded-full font-black text-5xl shadow-md transition-colors ${timeLeft <= 5 ? 'bg-red-500 text-white animate-pulse' : 'bg-slate-900 text-white'}`}>
              <span>⏱️</span>
              <span>{timeLeft}s</span>
            </div>
          ) : (
            <div className="inline-block bg-slate-800 text-white px-8 py-4 rounded-full font-black text-3xl shadow-md">
              Tempo Esgotado!
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-6 max-w-5xl w-full mx-auto">
          {question.options.map((opt, i) => {
            if (!opt) return null;
            const isCorrect = question.correct_answer === i;
            const opacityClass = showResults ? (isCorrect ? 'opacity-100 scale-102 ring-4 ring-emerald-400' : 'opacity-25 grayscale') : 'opacity-100';

            return (
              <div 
                key={i} 
                className={`${bgColors[i]} text-white p-8 rounded-2xl text-2xl font-black shadow-lg flex items-center justify-between transition-all ${opacityClass}`}
              >
                <span>{opt}</span>
                {showResults && isCorrect && <span className="text-4xl bg-white text-emerald-600 p-2 rounded-full shadow">✅</span>}
              </div>
            );
          })}
        </div>

        <div className="text-center mt-6 h-16">
          {showResults && (
            <button 
              onClick={nextQuestion} 
              className="px-10 py-4 text-2xl font-black bg-blue-600 hover:bg-blue-700 text-white rounded-2xl shadow-xl transition-all transform hover:scale-105 cursor-pointer"
            >
              {currentQIndex + 1 < questions.length ? 'Próxima Pergunta ➔' : 'Ver Pódio 🏆'}
            </button>
          )}
        </div>
      </div>
    );
  }

  // 4. LOBBY DE ESPERA
  return (
    <div className="min-h-screen bg-slate-900 text-white flex flex-col items-center justify-between p-8 font-sans">
      <div className="text-center mt-4">
        <h1 className="text-3xl font-extrabold text-blue-400 tracking-wider">METAQUIZ</h1>
        <p className="text-slate-400 font-medium">Entre no sistema digitando o PIN:</p>
        <div className="bg-white text-slate-950 font-black text-8xl tracking-widest py-6 px-12 rounded-3xl shadow-2xl mt-4 inline-block">
          {quiz.pin}
        </div>
      </div>

      <div className="bg-slate-800/80 border border-slate-700 p-8 rounded-3xl max-w-4xl w-full min-h-[300px] shadow-inner my-6">
        <div className="flex justify-between items-center mb-6 border-b border-slate-700 pb-4">
          <h3 className="text-xl font-bold text-slate-300">Alunos Conectados</h3>
          <span className="bg-emerald-500/20 text-emerald-400 font-extrabold px-4 py-1 rounded-full text-lg border border-emerald-500/30">
            {players.length} na sala
          </span>
        </div>

        <div className="flex flex-wrap gap-4 justify-center">
          {players.map((p) => (
            <div key={p.id} className="bg-slate-700 text-white font-bold text-xl px-6 py-3 rounded-xl shadow-md border border-slate-600">
              👤 {p.name}
            </div>
          ))}
          {players.length === 0 && (
            <p className="text-slate-500 text-lg my-auto">Aguardando alunos digitarem o PIN no celular...</p>
          )}
        </div>
      </div>

      <button 
        onClick={startGame} 
        className="px-12 py-5 text-3xl font-black bg-emerald-500 hover:bg-emerald-400 text-slate-950 rounded-2xl shadow-xl transition-all transform hover:scale-105 cursor-pointer"
      >
        Iniciar Partida 🚀
      </button>
    </div>
  );
}