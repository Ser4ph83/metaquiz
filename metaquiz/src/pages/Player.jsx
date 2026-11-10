import { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { supabase } from '../supabase';

export default function Player() {
  const location = useLocation();
  const navigate = useNavigate();
  const { name, playerId, quizId } = location.state || {};

  const [questions, setQuestions] = useState([]);
  const [currentStep, setCurrentStep] = useState(-1);
  const [hasAnswered, setHasAnswered] = useState(false);
  const [startTime, setStartTime] = useState(() => new Date().getTime());
  
  const bgColors = [
    'bg-red-600 hover:bg-red-500', 
    'bg-blue-600 hover:bg-blue-500', 
    'bg-amber-500 hover:bg-amber-400', 
    'bg-emerald-600 hover:bg-emerald-500'
  ];

  useEffect(() => {
    if (!quizId || !playerId) {
      navigate('/');
    }
  }, [quizId, playerId, navigate]);

  useEffect(() => {
    if (!quizId) return;

    const fetchQuestions = async () => {
      const { data } = await supabase
        .from('questions')
        .select('*')
        .eq('quiz_id', quizId)
        .order('id', { ascending: true });
      if (data) setQuestions(data);
    };

    const fetchQuizStatus = async () => {
      const { data } = await supabase
        .from('quizzes')
        .select('current_step')
        .eq('id', quizId)
        .single();
      if (data) setCurrentStep(data.current_step);
    };

    fetchQuestions();
    fetchQuizStatus();

    const subscription = supabase
      .channel('quiz_status')
      .on('postgres_changes', { 
        event: 'UPDATE', 
        schema: 'public', 
        table: 'quizzes', 
        filter: `id=eq.${quizId}` 
      }, 
      (payload) => {
        setCurrentStep(payload.new.current_step);
        setHasAnswered(false);
        setStartTime(new Date().getTime()); 
      })
      .subscribe();

    return () => supabase.removeChannel(subscription);
  }, [quizId]);

  const handleAnswer = async (optionIndex) => {
    if (hasAnswered) return;
    setHasAnswered(true);
    
    const currentTime = new Date().getTime();
    const reactionTime = (currentTime - startTime) / 1000; 

    await supabase.from('answers').insert([{
      quiz_id: quizId,
      player_id: playerId,
      selected_option: optionIndex,
      reaction_time: reactionTime,
      question_index: currentStep
    }]);
  };

  if (!quizId || !playerId) return null;

  // 1. TELA DE ESPERA INICIAL (Lobby)
  if (currentStep === -1) {
    return (
      <div className="min-h-screen bg-slate-900 text-white flex flex-col justify-between p-4 font-sans">
        <div className="bg-slate-800 p-4 rounded-2xl flex items-center justify-between border border-slate-700 shadow-md">
          <span className="font-bold text-lg text-slate-300">👤 {name}</span>
          <span className="text-xs bg-blue-500/20 text-blue-400 font-extrabold px-3 py-1 rounded-full border border-blue-500/30">Conectado</span>
        </div>

        <div className="text-center p-8 bg-slate-800/50 border border-slate-700/50 rounded-3xl my-auto shadow-2xl backdrop-blur-sm">
          <div className="text-6xl mb-6 animate-bounce">📱</div>
          <h2 className="text-3xl font-black text-white mb-2">Você está na sala!</h2>
          <p className="text-slate-400 text-lg font-medium">Fique de olho no telão da aula. O jogo começará em breve...</p>
        </div>
      </div>
    );
  }

  // 2. TELA DE FIM DE JOGO COM BOTÃO DE SAÍDA / NOVO JOGO
  if (currentStep === -2) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex flex-col justify-between p-4 font-sans">
        <div className="bg-slate-900 p-4 rounded-2xl flex items-center justify-between border border-slate-800">
          <span className="font-bold text-lg text-slate-400">👤 {name}</span>
        </div>

        <div className="text-center p-8 my-auto flex flex-col items-center">
          <div className="text-7xl mb-4">🏁</div>
          <h2 className="text-4xl font-black text-amber-400 mb-2">Fim da Partida!</h2>
          <p className="text-slate-300 text-xl font-medium mb-8">Olhe para o telão para conferir a sua posição no Pódio Final.</p>
          
          <button 
            onClick={() => navigate('/')}
            className="w-full max-w-xs py-4 font-black text-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 rounded-2xl shadow-xl transition-all transform active:scale-95 cursor-pointer"
          >
            🎮 Entrar em Outra Sala
          </button>
        </div>
      </div>
    );
  }

  // 3. TELA DE JOGO / BOTÕES DE RESPOSTA
  if (currentStep >= 0 && questions.length > 0) {
    const question = questions[currentStep];

    return (
      <div className="min-h-screen bg-slate-950 flex flex-col justify-between p-3 font-sans">
        <div className="bg-slate-900 p-3 rounded-xl flex items-center justify-between border border-slate-800 shadow">
          <span className="font-bold text-slate-300 text-sm">👤 {name}</span>
          <span className="text-xs text-slate-400 font-mono">Pergunta {currentStep + 1} de {questions.length}</span>
        </div>
        
        {hasAnswered ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-6 bg-slate-900/80 my-3 rounded-2xl border border-slate-800 shadow-2xl">
            <div className="text-6xl mb-4 animate-pulse">⏳</div>
            <h3 className="text-2xl font-black text-emerald-400 mb-2">Resposta Registrada!</h3>
            <p className="text-slate-400 font-medium">Aguarde o tempo esgotar no telão.</p>
          </div>
        ) : (
          <div className="flex-1 flex flex-col my-3 gap-3">
            <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl text-center shadow">
              <p className="text-white font-bold text-lg leading-snug">{question.question_text}</p>
            </div>

            <div className="flex-1 grid grid-cols-2 gap-3">
              {question.options.map((opt, index) => {
                if (!opt) return null;
                return (
                  <button 
                    key={index}
                    onClick={() => handleAnswer(index)}
                    className={`${bgColors[index]} text-white font-black text-xl p-4 rounded-2xl shadow-xl transition-all transform active:scale-95 flex items-center justify-center text-center border-b-4 border-black/20`}
                  >
                    {opt}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    );
  }

  return null;
}