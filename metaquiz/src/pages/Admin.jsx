import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabase';

export default function Admin() {
  const [step, setStep] = useState(1);
  const [activeTab, setActiveTab] = useState('new');
  
  // Dados do Quiz
  const [title, setTitle] = useState('');
  const [teacherName, setTeacherName] = useState('');
  const [quizId, setQuizId] = useState(null);
  const [pin, setPin] = useState('');
  const [savedQuizzes, setSavedQuizzes] = useState([]);
  
  // Abas de Pergunta: 'ai' ou 'manual'
  const [mode, setMode] = useState('ai');
  
  // Estado do Importador IA
  const [rawText, setRawText] = useState('');
  const [parsedPreview, setParsedPreview] = useState([]);
  
  // Estado do Cadastro Manual
  const [questionText, setQuestionText] = useState('');
  const [questionType, setQuestionType] = useState('quiz');
  const [timeLimit, setTimeLimit] = useState(20);
  const [options, setOptions] = useState(['', '', '', '']);
  const [correctAnswer, setCorrectAnswer] = useState(0);
  
  const [message, setMessage] = useState('');
  const [copiedPrompt, setCopiedPrompt] = useState(false);
  const navigate = useNavigate();

  const promptTemplate = `Gere um quiz sobre o assunto com 5 perguntas de múltipla escolha. 
Retorne EXATAMENTE neste formato JSON para o meu sistema importar:

[
  {
    "question_text": "Qual a capital do Brasil?",
    "options": ["São Paulo", "Rio de Janeiro", "Brasília", "Salvador"],
    "correct_answer": 2,
    "time_limit": 20
  }
]
Note: correct_answer é o índice da resposta correta (0 para 1ª, 1 para 2ª, 2 para 3ª, 3 para 4ª).`;

  // Função auxiliar para recarregar quizzes após ações de criar/deletar
  const fetchQuizzes = async () => {
    const { data } = await supabase
      .from('quizzes')
      .select('*')
      .order('id', { ascending: false });
    if (data) setSavedQuizzes(data);
  };

  // Carregamento inicial limpo no useEffect (sem alerta do linter)
  useEffect(() => {
    let isMounted = true;
    const loadInitialQuizzes = async () => {
      const { data } = await supabase
        .from('quizzes')
        .select('*')
        .order('id', { ascending: false });
      if (data && isMounted) {
        setSavedQuizzes(data);
      }
    };

    loadInitialQuizzes();

    return () => {
      isMounted = false;
    };
  }, []);

  const copyPromptToClipboard = () => {
    navigator.clipboard.writeText(promptTemplate);
    setCopiedPrompt(true);
    setTimeout(() => setCopiedPrompt(false), 3000);
  };

  const createQuiz = async (e) => {
    e.preventDefault();
    const generatedPin = Math.floor(100000 + Math.random() * 900000).toString();
    
    const { data, error } = await supabase
      .from('quizzes')
      .insert([{ title, teacher_name: teacherName || 'Professor', pin: generatedPin, is_active: true }])
      .select()
      .single();

    if (error) return alert('Erro ao criar sala!');
    
    setQuizId(data.id);
    setPin(generatedPin);
    setStep(2);
    fetchQuizzes();
  };

  const selectQuizToEdit = (quiz) => {
    setQuizId(quiz.id);
    setPin(quiz.pin);
    setTitle(quiz.title);
    setTeacherName(quiz.teacher_name || 'Professor');
    setStep(2);
  };

  const deleteQuiz = async (id) => {
    if (!window.confirm('Tem certeza que deseja excluir esta sala? Todas as perguntas e históricos serão apagados.')) return;
    await supabase.from('quizzes').delete().eq('id', id);
    fetchQuizzes();
    if (quizId === id) {
      setStep(1);
      setQuizId(null);
    }
  };

  const processAIText = (text) => {
    setRawText(text);
    if (!text.trim()) {
      setParsedPreview([]);
      return;
    }

    try {
      const jsonMatch = text.match(/\[\s*\{.*\}\s*\]/s);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const formatted = parsed.map(q => ({
            quiz_id: quizId,
            question_text: q.question_text || q.question || 'Pergunta sem título',
            options: (q.options || [q.option_a, q.option_b, q.option_c, q.option_d]).slice(0, 4),
            correct_answer: typeof q.correct_answer === 'number' ? q.correct_answer : 0,
            time_limit: q.time_limit || 20
          }));
          setParsedPreview(formatted);
          return;
        }
      }
    } catch {
      // Ignora erro se não for JSON
    }

    const blocks = text.split(/(?=\d+[.)]|\n\s*\n|Pergunta\s*\d+:?)/i).filter(b => b.trim().length > 10);
    const questions = [];

    for (const block of blocks) {
      const lines = block.split('\n').map(l => l.trim()).filter(Boolean);
      if (lines.length < 3) continue;

      let qText = lines[0].replace(/^(\d+[.)]|Pergunta\s*\d+:?|Q:?)\s*/i, '');
      let opts = [];
      let correctIdx = 0;
      let time = 20;

      for (let i = 1; i < lines.length; i++) {
        const line = lines[i];
        if (/^[A-D1-4][.)]/i.test(line)) {
          opts.push(line.replace(/^[A-D1-4][.)]\s*/i, ''));
        } else if (/^(Resposta|Gabarito|Correta):/i.test(line)) {
          const ansVal = line.replace(/^(Resposta|Gabarito|Correta):\s*/i, '').toUpperCase();
          if (ansVal.includes('A') || ansVal.includes('1')) correctIdx = 0;
          else if (ansVal.includes('B') || ansVal.includes('2')) correctIdx = 1;
          else if (ansVal.includes('C') || ansVal.includes('3')) correctIdx = 2;
          else if (ansVal.includes('D') || ansVal.includes('4')) correctIdx = 3;
        }
      }

      if (opts.length >= 2) {
        while (opts.length < 4) opts.push('');
        questions.push({
          quiz_id: quizId,
          question_text: qText,
          options: opts.slice(0, 4),
          correct_answer: correctIdx,
          time_limit: time
        });
      }
    }

    setParsedPreview(questions);
  };

  const saveBatchQuestions = async () => {
    if (parsedPreview.length === 0) return;

    const { error } = await supabase.from('questions').insert(parsedPreview);

    if (error) {
      setMessage('❌ Erro ao salvar lote de perguntas.');
    } else {
      setMessage(`✅ Sucesso! ${parsedPreview.length} perguntas adicionadas ao quiz!`);
      setRawText('');
      setParsedPreview([]);
    }
    setTimeout(() => setMessage(''), 4000);
  };

  const addSingleQuestion = async (e) => {
    e.preventDefault();
    const finalOptions = questionType === 'tf' ? ['Verdadeiro', 'Falso'] : options;

    const { error } = await supabase.from('questions').insert([{
      quiz_id: quizId,
      question_text: questionText,
      options: finalOptions,
      correct_answer: correctAnswer,
      time_limit: timeLimit
    }]);

    if (error) {
      setMessage('❌ Erro ao salvar pergunta.');
    } else {
      setMessage('✅ Pergunta adicionada com sucesso!');
      setQuestionText('');
      setOptions(['', '', '', '']);
    }
    setTimeout(() => setMessage(''), 3000);
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex items-center justify-center p-4 font-sans">
      <div className="bg-slate-800 border border-slate-700 max-w-4xl w-full rounded-3xl shadow-2xl overflow-hidden">
        
        {/* Cabeçalho */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-6 text-center text-white">
          <h1 className="text-3xl font-black tracking-tight">👨‍🏫 Painel do Professor - MetaQuiz</h1>
          <p className="text-blue-100 text-sm mt-1 font-medium">Gestão de Salas, Importação via IA e Banco de Quizzes</p>
        </div>

        {/* Menu Superior de Navegação no Admin */}
        <div className="flex border-b border-slate-700 bg-slate-900/50">
          <button 
            onClick={() => { setActiveTab('new'); setStep(1); }}
            className={`flex-1 py-4 font-bold text-sm transition-all border-b-2 ${activeTab === 'new' && step === 1 ? 'border-blue-500 text-blue-400 bg-slate-800' : 'border-transparent text-slate-400 hover:text-white'}`}
          >
            ➕ Nova Sala
          </button>
          <button 
            onClick={() => { setActiveTab('list'); fetchQuizzes(); }}
            className={`flex-1 py-4 font-bold text-sm transition-all border-b-2 ${activeTab === 'list' ? 'border-blue-500 text-blue-400 bg-slate-800' : 'border-transparent text-slate-400 hover:text-white'}`}
          >
            📚 Minhas Salas / Histórico ({savedQuizzes.length})
          </button>
        </div>

        <div className="p-8">
          
          {/* ABA 1: MINHAS SALAS / HISTÓRICO DE QUIZZES */}
          {activeTab === 'list' && (
            <div className="space-y-4">
              <h3 className="text-xl font-bold text-white mb-4">Salas Cadastradas no Banco</h3>
              
              {savedQuizzes.length === 0 ? (
                <p className="text-slate-500 text-center py-8">Nenhuma sala cadastrada até o momento.</p>
              ) : (
                <div className="space-y-3 max-h-[450px] overflow-y-auto pr-2">
                  {savedQuizzes.map((q) => (
                    <div key={q.id} className="bg-slate-900 border border-slate-700 p-5 rounded-2xl flex flex-wrap items-center justify-between gap-4 hover:border-slate-600 transition-all">
                      <div>
                        <h4 className="font-extrabold text-lg text-white">{q.title}</h4>
                        <div className="flex items-center gap-4 mt-1 text-xs text-slate-400">
                          <span>👨‍🏫 Autor: <strong className="text-slate-200">{q.teacher_name || 'Não informado'}</strong></span>
                          <span>🔑 PIN: <strong className="text-emerald-400 font-mono text-sm">{q.pin}</strong></span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <button 
                          onClick={() => { selectQuizToEdit(q); setActiveTab('new'); }}
                          className="px-4 py-2 bg-indigo-600/20 hover:bg-indigo-600/40 text-indigo-300 border border-indigo-500/30 font-bold text-xs rounded-xl transition-all cursor-pointer"
                        >
                          ✏️ Editar / Add Perguntas
                        </button>
                        <button 
                          onClick={() => navigate('/host')}
                          className="px-4 py-2 bg-emerald-500/20 hover:bg-emerald-500/40 text-emerald-300 border border-emerald-500/30 font-bold text-xs rounded-xl transition-all cursor-pointer"
                        >
                          🖥️ Abrir Telão
                        </button>
                        <button 
                          onClick={() => deleteQuiz(q.id)}
                          className="px-3 py-2 bg-red-500/10 hover:bg-red-500/30 text-red-400 border border-red-500/20 font-bold text-xs rounded-xl transition-all cursor-pointer"
                        >
                          🗑️ Excluir
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ABA 2: CRIAR / EDITAR SALA */}
          {activeTab === 'new' && (
            <>
              {/* PASSO 1: Formulário do Quiz e Nome do Professor */}
              {step === 1 && (
                <form onSubmit={createQuiz} className="space-y-6 max-w-lg mx-auto py-4">
                  <div className="text-center">
                    <h3 className="text-2xl font-bold text-white mb-2">Criar Nova Sala Interativa</h3>
                    <p className="text-slate-400 text-sm">Preencha os dados da disciplina e do professor.</p>
                  </div>

                  <div>
                    <label className="block text-slate-300 font-bold text-sm mb-2">Nome do Professor / Instrutor</label>
                    <input 
                      type="text" 
                      placeholder="Ex: Prof. Gilson Terada" 
                      value={teacherName}
                      onChange={(e) => setTeacherName(e.target.value)}
                      className="w-full p-4 bg-slate-900 border border-slate-700 rounded-2xl text-lg font-bold outline-none focus:border-blue-500 transition-all text-white placeholder-slate-600"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-slate-300 font-bold text-sm mb-2">Tema / Título da Aula</label>
                    <input 
                      type="text" 
                      placeholder="Ex: Fundamentos de Inteligência Artificial" 
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      className="w-full p-4 bg-slate-900 border border-slate-700 rounded-2xl text-lg font-bold outline-none focus:border-blue-500 transition-all text-white placeholder-slate-600"
                      required
                    />
                  </div>

                  <button 
                    type="submit" 
                    className="w-full py-4 text-xl font-black bg-emerald-500 hover:bg-emerald-400 text-slate-950 rounded-2xl shadow-xl transition-transform transform active:scale-95 cursor-pointer"
                  >
                    Gerar PIN e Adicionar Perguntas 🚀
                  </button>
                </form>
              )}

              {/* PASSO 2: Inserção de Perguntas */}
              {step === 2 && (
                <div className="space-y-6">
                  {/* Box do Quiz Ativo */}
                  <div className="bg-slate-900 border border-slate-700 p-4 rounded-2xl flex items-center justify-between shadow-inner">
                    <div>
                      <span className="text-slate-400 text-xs uppercase font-extrabold tracking-wider">PIN da Sala</span>
                      <h2 className="text-3xl font-black text-emerald-400 tracking-widest">{pin}</h2>
                    </div>
                    <div className="text-right">
                      <span className="text-slate-400 text-xs uppercase font-extrabold tracking-wider">Aula & Autor</span>
                      <p className="text-white font-bold text-base">{title}</p>
                      <p className="text-blue-400 text-xs font-semibold">Prof: {teacherName}</p>
                    </div>
                  </div>

                  {/* Seletor de Modo (IA vs Manual) */}
                  <div className="flex bg-slate-900 p-1.5 rounded-2xl border border-slate-700">
                    <button 
                      onClick={() => setMode('ai')}
                      className={`flex-1 py-3 font-bold rounded-xl text-sm transition-all ${mode === 'ai' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-white'}`}
                    >
                      ✨ Importar via IA (Lei de Tesler)
                    </button>
                    <button 
                      onClick={() => setMode('manual')}
                      className={`flex-1 py-3 font-bold rounded-xl text-sm transition-all ${mode === 'manual' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-white'}`}
                    >
                      ✍️ Cadastro Manual
                    </button>
                  </div>

                  {/* ABA IA */}
                  {mode === 'ai' && (
                    <div className="space-y-6 bg-slate-900/50 p-6 rounded-2xl border border-slate-700/50">
                      <div className="flex justify-between items-center">
                        <div>
                          <h3 className="font-bold text-lg text-white">Cole o texto da IA abaixo</h3>
                          <p className="text-slate-400 text-xs">Cole a resposta gerada pelo Gemini, ChatGPT ou NotebookLM.</p>
                        </div>
                        <button 
                          onClick={copyPromptToClipboard}
                          className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-blue-400 border border-slate-600 rounded-xl font-bold text-xs flex items-center gap-2 transition-all cursor-pointer"
                        >
                          <span>{copiedPrompt ? '✅ Prompt Copiado!' : '📋 Copiar Prompt Modelo'}</span>
                        </button>
                      </div>

                      <textarea 
                        rows={5}
                        value={rawText}
                        onChange={(e) => processAIText(e.target.value)}
                        placeholder="Cole aqui o resultado fornecido pela IA (JSON ou lista com gabarito)..."
                        className="w-full p-4 bg-slate-950 border border-slate-700 rounded-2xl font-mono text-sm text-slate-200 outline-none focus:border-indigo-500 transition-all"
                      />

                      {parsedPreview.length > 0 && (
                        <div className="space-y-3">
                          <span className="text-emerald-400 font-extrabold text-sm block">
                            🔍 {parsedPreview.length} Pergunta(s) identificada(s):
                          </span>

                          <div className="max-h-48 overflow-y-auto space-y-2 pr-2">
                            {parsedPreview.map((q, idx) => (
                              <div key={idx} className="bg-slate-950 p-3 rounded-xl border border-slate-800 text-sm">
                                <p className="font-bold text-white mb-1">{idx + 1}. {q.question_text}</p>
                                <div className="grid grid-cols-2 gap-2 text-xs text-slate-400">
                                  {q.options.map((opt, oIdx) => (
                                    <div key={oIdx} className={`p-1.5 rounded-lg ${q.correct_answer === oIdx ? 'bg-emerald-950 border border-emerald-500 text-emerald-300 font-bold' : 'bg-slate-900'}`}>
                                      {opt} {q.correct_answer === oIdx && '✅'}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            ))}
                          </div>

                          <button 
                            onClick={saveBatchQuestions}
                            className="w-full py-4 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-lg rounded-2xl shadow-lg transition-transform transform active:scale-95 cursor-pointer"
                          >
                            🚀 Confirmar e Salvar {parsedPreview.length} Perguntas no Quiz
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  {/* ABA MANUAL */}
                  {mode === 'manual' && (
                    <form onSubmit={addSingleQuestion} className="bg-slate-900/50 p-6 rounded-2xl border border-slate-700/50 space-y-4">
                      <div>
                        <label className="block text-slate-300 font-bold text-sm mb-2">Pergunta</label>
                        <textarea 
                          value={questionText} 
                          onChange={(e) => setQuestionText(e.target.value)} 
                          className="w-full p-3 bg-slate-950 border border-slate-700 rounded-xl text-white outline-none focus:border-indigo-500 resize-none" 
                          rows={2}
                          placeholder="Digite a pergunta..."
                          required 
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-slate-300 font-bold text-sm mb-1">Formato</label>
                          <select value={questionType} onChange={(e) => setQuestionType(e.target.value)} className="w-full p-3 bg-slate-950 border border-slate-700 rounded-xl text-white outline-none">
                            <option value="quiz">Múltipla Escolha</option>
                            <option value="tf">Verdadeiro ou Falso</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-slate-300 font-bold text-sm mb-1">Tempo (segundos)</label>
                          <select value={timeLimit} onChange={(e) => setTimeLimit(Number(e.target.value))} className="w-full p-3 bg-slate-950 border border-slate-700 rounded-xl text-white outline-none">
                            <option value="10">⚡ 10s</option>
                            <option value="20">⏱️ 20s</option>
                            <option value="30">🤔 30s</option>
                            <option value="60">🧠 60s</option>
                          </select>
                        </div>
                      </div>

                      <div>
                        <label className="block text-slate-300 font-bold text-sm mb-2">Alternativas (Marque a correta)</label>
                        {questionType === 'quiz' ? (
                          <div className="space-y-2">
                            {[0, 1, 2, 3].map((index) => (
                              <div key={index} className={`flex items-center gap-3 p-2 rounded-xl border ${correctAnswer === index ? 'border-emerald-500 bg-emerald-950/30' : 'border-slate-800 bg-slate-950'}`}>
                                <input 
                                  type="radio" 
                                  name="correct" 
                                  className="w-5 h-5 ml-2 cursor-pointer accent-emerald-500" 
                                  checked={correctAnswer === index} 
                                  onChange={() => setCorrectAnswer(index)} 
                                />
                                <input 
                                  type="text" 
                                  placeholder={`Opção ${index + 1}`} 
                                  value={options[index]} 
                                  onChange={(e) => { const newOptions = [...options]; newOptions[index] = e.target.value; setOptions(newOptions); }} 
                                  className="flex-1 p-2 bg-transparent outline-none text-white text-sm" 
                                  required 
                                />
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="flex gap-4">
                            <label className={`flex-1 flex items-center justify-center gap-2 p-3 rounded-xl border cursor-pointer ${correctAnswer === 0 ? 'border-emerald-500 bg-emerald-950/40 text-emerald-400' : 'border-slate-800 bg-slate-950 text-slate-400'}`}>
                              <input type="radio" name="correct_tf" checked={correctAnswer === 0} onChange={() => setCorrectAnswer(0)} /> 
                              <span className="font-bold">Verdadeiro</span>
                            </label>
                            <label className={`flex-1 flex items-center justify-center gap-2 p-3 rounded-xl border cursor-pointer ${correctAnswer === 1 ? 'border-red-500 bg-red-950/40 text-red-400' : 'border-slate-800 bg-slate-950 text-slate-400'}`}>
                              <input type="radio" name="correct_tf" checked={correctAnswer === 1} onChange={() => setCorrectAnswer(1)} /> 
                              <span className="font-bold">Falso</span>
                            </label>
                          </div>
                        )}
                      </div>

                      <button type="submit" className="w-full py-4 font-bold bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl shadow-md transition-all mt-2 cursor-pointer">
                        + Salvar Esta Pergunta
                      </button>
                    </form>
                  )}

                  {message && (
                    <div className="p-4 bg-emerald-950 border border-emerald-500/50 text-emerald-300 rounded-2xl text-center font-bold text-sm animate-pulse">
                      {message}
                    </div>
                  )}

                  <button 
                    onClick={() => navigate('/host')} 
                    className="w-full py-5 text-2xl font-black bg-blue-600 hover:bg-blue-500 text-white rounded-2xl shadow-xl transition-transform transform active:scale-95 cursor-pointer mt-4"
                  >
                    🏁 Ir para o Telão da Aula
                  </button>
                </div>
              )}
            </>
          )}

        </div>
      </div>
    </div>
  );
}