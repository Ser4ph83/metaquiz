import { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { supabase } from '../supabase';

export default function Player() {
  const location = useLocation();
  const { name, playerId, quizId } = location.state || { name: 'Aluno', playerId: null, quizId: null };
  
  const [questions, setQuestions] = useState([]);
  const [currentStep, setCurrentStep] = useState(-1);
  const [hasAnswered, setHasAnswered] = useState(false);
  const [startTime, setStartTime] = useState(() => new Date().getTime());
  
  const colors = ['#e21b3c', '#1368ce', '#d89e00', '#26890c'];

  useEffect(() => {
    if (!quizId) return;

    const fetchQuestions = async () => {
      const { data } = await supabase.from('questions').select('*').eq('quiz_id', quizId).order('id', { ascending: true });
      if (data) setQuestions(data);
    };

    const fetchQuizStatus = async () => {
      const { data } = await supabase.from('quizzes').select('current_step').eq('id', quizId).single();
      if (data) setCurrentStep(data.current_step);
    };

    fetchQuestions();
    fetchQuizStatus();

    const subscription = supabase
      .channel('quiz_status')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'quizzes', filter: `id=eq.${quizId}` }, 
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
      question_index: currentStep // <- Agora registramos qual foi a pergunta!
    }]);
  };

  // Tela 1: Aguardando iniciar
  if (currentStep === -1) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: '#f2f2f2', fontFamily: 'sans-serif' }}>
        <div style={{ background: '#333', color: '#fff', padding: '15px', textAlign: 'center', fontSize: '20px', fontWeight: 'bold' }}>👤 {name}</div>
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px', fontWeight: 'bold', color: '#555', padding: '20px', textAlign: 'center' }}>
          Você está dentro!<br/>Aguarde o professor iniciar.
        </div>
      </div>
    );
  }

  // Tela 2: Fim de Jogo
  if (currentStep === -2) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: '#222', color: '#fff', fontFamily: 'sans-serif' }}>
        <div style={{ background: '#111', padding: '15px', textAlign: 'center', fontSize: '20px', fontWeight: 'bold' }}>👤 {name}</div>
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '28px', fontWeight: 'bold', padding: '20px', textAlign: 'center' }}>
          Fim de Jogo! 🏁<br/><br/>Olhe para o telão para ver o pódio.
        </div>
      </div>
    );
  }

  // Tela 3: Respondendo pergunta
  if (currentStep >= 0 && questions.length > 0) {
    const question = questions[currentStep];

    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', fontFamily: 'sans-serif', margin: 0, background: '#f2f2f2' }}>
        <div style={{ background: '#333', color: '#fff', padding: '15px', textAlign: 'center', fontSize: '20px', fontWeight: 'bold' }}>👤 {name}</div>
        
        {hasAnswered ? (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px', fontWeight: 'bold', color: '#555', textAlign: 'center', padding: '20px' }}>
            Resposta enviada!<br/>Olhe para o telão. 👀
          </div>
        ) : (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '10px' }}>
            <div style={{ background: '#fff', padding: '15px', borderRadius: '8px', marginBottom: '10px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)', textAlign: 'center', fontWeight: 'bold', fontSize: '18px' }}>
              {question.question_text}
            </div>
            <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 1fr', gridTemplateRows: '1fr 1fr', gap: '10px' }}>
              {question.options.map((opt, index) => {
                if (!opt) return null;
                return (
                  <button key={index} style={{ background: colors[index], color: '#fff', fontSize: '18px', fontWeight: 'bold', border: 'none', borderRadius: '8px', cursor: 'pointer', boxShadow: '0 6px 0 rgba(0,0,0,0.2)', padding: '10px' }} onClick={() => handleAnswer(index)}>
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