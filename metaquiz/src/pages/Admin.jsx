import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabase';

export default function Admin() {
  const [step, setStep] = useState(1);
  const [title, setTitle] = useState('');
  const [quizId, setQuizId] = useState(null);
  const [pin, setPin] = useState('');
  
  const [questionText, setQuestionText] = useState('');
  const [questionType, setQuestionType] = useState('quiz');
  const [timeLimit, setTimeLimit] = useState(20);
  const [options, setOptions] = useState(['', '', '', '']);
  const [correctAnswer, setCorrectAnswer] = useState(0);
  const [message, setMessage] = useState('');
  
  const navigate = useNavigate();

  const createQuiz = async (e) => {
    e.preventDefault();
    const generatedPin = Math.floor(100000 + Math.random() * 900000).toString();
    
    const { data, error } = await supabase
      .from('quizzes')
      .insert([{ title, pin: generatedPin, is_active: true }])
      .select()
      .single();

    if (error) {
      alert('Erro ao criar sala!');
      return;
    }

    setQuizId(data.id);
    setPin(generatedPin);
    setStep(2);
  };

  const addQuestion = async (e) => {
    e.preventDefault();
    const finalOptions = questionType === 'tf' ? ['Verdadeiro', 'Falso'] : options;

    const { error } = await supabase
      .from('questions')
      .insert([{
        quiz_id: quizId,
        question_text: questionText,
        options: finalOptions,
        correct_answer: correctAnswer,
        time_limit: timeLimit
      }]);

    if (error) {
      setMessage('Erro ao salvar pergunta.');
    } else {
      setMessage('Pergunta adicionada com sucesso!');
      setQuestionText('');
      setOptions(['', '', '', '']);
    }
    
    setTimeout(() => setMessage(''), 3000);
  };

  const finishQuiz = () => {
    // Redireciona o professor para o telão
    navigate('/host');
  };

  return (
    <div style={{ maxWidth: '600px', margin: '50px auto', fontFamily: 'sans-serif', textAlign: 'center' }}>
      <h1>👨‍🏫 Painel do Professor</h1>
      
      {step === 1 && (
        <form onSubmit={createQuiz} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
          <h3>1. Crie uma nova sala</h3>
          <input 
            type="text" 
            placeholder="Nome da Aula / Assunto" 
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            style={{ padding: '10px', fontSize: '18px' }}
            required
          />
          <button type="submit" style={{ padding: '10px', fontSize: '18px', background: '#333', color: '#fff', cursor: 'pointer' }}>
            Criar Sala e Gerar PIN
          </button>
        </form>
      )}

      {step === 2 && (
        <div>
          <div style={{ background: '#eee', padding: '15px', borderRadius: '8px', marginBottom: '20px' }}>
            <h2 style={{ fontSize: '40px', margin: '10px 0', color: '#007bff' }}>PIN: {pin}</h2>
            <p>Anote este PIN! Adicione as perguntas abaixo e finalize quando terminar.</p>
          </div>

          <form onSubmit={addQuestion} style={{ display: 'flex', flexDirection: 'column', gap: '15px', textAlign: 'left', background: '#f8f9fa', padding: '20px', borderRadius: '8px' }}>
            <label><strong>Pergunta:</strong>
              <textarea value={questionText} onChange={(e) => setQuestionText(e.target.value)} style={{ width: '100%', padding: '10px', marginTop: '5px' }} required />
            </label>

            <div style={{ display: 'flex', gap: '20px' }}>
              <label><strong>Tipo:</strong><br/>
                <select value={questionType} onChange={(e) => setQuestionType(e.target.value)} style={{ padding: '5px', marginTop: '5px' }}>
                  <option value="quiz">Múltipla Escolha</option>
                  <option value="tf">Verdadeiro ou Falso</option>
                </select>
              </label>

              <label><strong>Tempo (segundos):</strong><br/>
                <select value={timeLimit} onChange={(e) => setTimeLimit(Number(e.target.value))} style={{ padding: '5px', marginTop: '5px' }}>
                  <option value="10">10s</option>
                  <option value="20">20s</option>
                  <option value="30">30s</option>
                  <option value="60">60s</option>
                </select>
              </label>
            </div>

            {questionType === 'quiz' ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {[0, 1, 2, 3].map((index) => (
                  <div key={index} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <input type="radio" name="correct" checked={correctAnswer === index} onChange={() => setCorrectAnswer(index)} />
                    <input type="text" placeholder={`Opção ${index + 1}`} value={options[index]} onChange={(e) => { const newOptions = [...options]; newOptions[index] = e.target.value; setOptions(newOptions); }} style={{ flex: 1, padding: '8px' }} required />
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <label><input type="radio" name="correct_tf" checked={correctAnswer === 0} onChange={() => setCorrectAnswer(0)} /> Verdadeiro</label>
                <label><input type="radio" name="correct_tf" checked={correctAnswer === 1} onChange={() => setCorrectAnswer(1)} /> Falso</label>
              </div>
            )}

            <button type="submit" style={{ padding: '10px', fontSize: '18px', background: '#28a745', color: '#fff', cursor: 'pointer', marginTop: '10px', border: 'none', borderRadius: '5px' }}>
              + Salvar Pergunta
            </button>
            {message && <p style={{ color: 'green', fontWeight: 'bold', textAlign: 'center' }}>{message}</p>}
          </form>

          <hr style={{ margin: '30px 0', border: '1px solid #ccc' }} />
          
          <button onClick={finishQuiz} style={{ padding: '15px 40px', fontSize: '20px', background: '#007bff', color: '#fff', cursor: 'pointer', border: 'none', borderRadius: '8px', fontWeight: 'bold', width: '100%' }}>
            🏁 Finalizar e Abrir Telão
          </button>
        </div>
      )}
    </div>
  );
}