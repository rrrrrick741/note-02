import React, { useState, useEffect, useMemo } from 'react'; // 核心：必须加上 React
import { createClient } from '@supabase/supabase-js';
import { Check, X, Book, Plus, ArrowLeft, List, Eye } from 'lucide-react';
// 1. 初始化 Supabase 客户端 (连接你的云端数据库)
const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

const INTERVALS = [1, 2, 4, 7, 15, 30, 60, 180];

export default function App() {
  const [words, setWords] = useState([]);
  const [books, setBooks] = useState([]);
  const [view, setView] = useState('home'); 
  const [activeBook, setActiveBook] = useState(null);
  const [loading, setLoading] = useState(true);

  // 初始化获取数据
  useEffect(() => { fetchData(); }, []);

  async function fetchData() {
    setLoading(true);
    try {
      const { data: w } = await supabase.from('words').select('*');
      const { data: b } = await supabase.from('wordbooks').select('*');
      setWords(w || []);
      setBooks(b || []);
    } catch (err) {
      console.error("数据加载失败:", err);
    } finally {
      setLoading(false);
    }
  }

  // --- 核心逻辑：艾宾浩斯复习提交 ---
  async function handleReview(word, isCorrect) {
    let nextStage = isCorrect ? word.stage + 1 : 0;
    let nextDate = new Date();
    // 计算下次复习时间
    const days = isCorrect ? (INTERVALS[Math.min(nextStage, 7)]) : 1;
    nextDate.setDate(nextDate.getDate() + days);

    let newBookIds = [...(word.book_ids || [])];
    // 如果错误，自动加入错题本 (ID: mistake_auto)
    if (!isCorrect && !newBookIds.includes('mistake_auto')) {
      newBookIds.push('mistake_auto');
    }

    await supabase.from('words').update({
      stage: nextStage,
      next_review: nextDate.toISOString(),
      correct_count: (word.correct_count || 0) + (isCorrect ? 1 : 0),
      wrong_count: (word.wrong_count || 0) + (isCorrect ? 0 : 1),
      book_ids: newBookIds
    }).eq('id', word.id);

    fetchData(); // 刷新同步
  }

  if (loading) return (
    <div className="flex h-screen flex-col items-center justify-center bg-gray-50">
      <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
      <p className="mt-4 font-bold text-indigo-600 animate-pulse">正在连接云端数据库...</p>
    </div>
  );

  return (
    <div className="max-w-md mx-auto min-h-screen bg-gray-50 shadow-2xl flex flex-col font-sans relative overflow-hidden">
      {/* 顶部导航 */}
      <header className="bg-indigo-600 text-white p-4 shadow-lg sticky top-0 z-50 flex justify-between items-center">
        <h1 className="font-bold flex items-center gap-2 text-lg cursor-pointer" onClick={() => setView('home')}>
          <Book size={20}/> 共享单词宝
        </h1>
        {view !== 'home' && (
          <button onClick={() => setView('home')} className="text-xs bg-indigo-500 hover:bg-indigo-400 px-3 py-1.5 rounded-full transition-colors font-bold uppercase tracking-wider">
            HOME
          </button>
        )}
      </header>

      {/* 视图切换 */}
      <main className="flex-1 p-4 overflow-y-auto">
        {view === 'home' && <HomeView words={words} setView={setView} />}
        {view === 'add' && <AddView books={books} onRefresh={fetchData} setView={setView} />}
        {view === 'review' && <ReviewView words={words} onResult={handleReview} onBack={() => setView('home')} />}
        {view === 'books' && <BooksView books={books} onSelect={(b) => {setActiveBook(b); setView('bookDetail');}} />}
        {view === 'bookDetail' && <BookDetailView book={activeBook} words={words} onBack={() => setView('books')} />}
      </main>
    </div>
  );
}

// --- 子组件：首页 ---
function HomeView({ words, setView }) {
  const due = words.filter(w => new Date(w.next_review) <= new Date()).length;
  return (
    <div className="space-y-6 pt-4">
      <div className="bg-white p-8 rounded-[2.5rem] shadow-sm text-center border-b-8 border-indigo-500">
        <h2 className="text-gray-400 text-xs font-black tracking-[0.2em] uppercase">Today's Goal</h2>
        <div className="text-8xl font-black text-indigo-600 my-4 tracking-tighter">{due}</div>
        <p className="text-gray-400 text-sm mb-6 font-medium">个单词待复习</p>
        <button 
          onClick={() => setView('review')} 
          disabled={due === 0}
          className={`w-full py-5 rounded-2xl font-black text-white shadow-xl shadow-indigo-100 transition-all active:scale-95 ${due > 0 ? 'bg-indigo-600 hover:bg-indigo-700' : 'bg-gray-300'}`}
        >
          {due > 0 ? '开始复习' : '全部复习完啦'}
        </button>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <button onClick={() => setView('add')} className="p-6 bg-white rounded-3xl shadow-sm flex flex-col items-center gap-3 hover:bg-indigo-50 transition-colors border border-gray-100 group">
          <div className="p-3 bg-green-50 rounded-2xl group-hover:scale-110 transition-transform"><Plus className="text-green-500" size={28}/></div>
          <span className="font-bold text-gray-700">新词录入</span>
        </button>
        <button onClick={() => setView('books')} className="p-6 bg-white rounded-3xl shadow-sm flex flex-col items-center gap-3 hover:bg-indigo-50 transition-colors border border-gray-100 group">
          <div className="p-3 bg-blue-50 rounded-2xl group-hover:scale-110 transition-transform"><List className="text-blue-500" size={28}/></div>
          <span className="font-bold text-gray-700">单词本</span>
        </button>
      </div>
    </div>
  );
}

// --- 子组件：复习模式 ---
function ReviewView({ words, onResult, onBack }) {
  const dueList = useMemo(() => words.filter(w => new Date(w.next_review) <= new Date()), [words]);
  const [idx, setIdx] = useState(0);
  const [show, setShow] = useState(false);

  if (dueList.length === 0 || idx >= dueList.length) {
    return (
      <div className="text-center py-20 animate-bounce">
        <div className="text-7xl mb-6">🏆</div>
        <h2 className="text-2xl font-black text-gray-800">完美收官！</h2>
        <p className="text-gray-500 mt-2 px-10">艾宾浩斯记忆曲线已更新，数据已同步至云端。</p>
        <button onClick={onBack} className="mt-10 bg-indigo-600 text-white px-10 py-4 rounded-full font-bold shadow-lg shadow-indigo-100 active:scale-95 transition-all">返回首页</button>
      </div>
    );
  }

  const word = dueList[idx];

  return (
    <div className="h-full flex flex-col gap-6">
      <div className="flex justify-between items-center text-gray-400 px-2">
        <span className="text-xs font-black uppercase tracking-widest">Reviewing</span>
        <span className="text-xs font-bold bg-indigo-100 text-indigo-600 px-2 py-1 rounded">进度 {idx + 1} / {dueList.length}</span>
      </div>
      
      <div className="flex-1 bg-white rounded-[3rem] shadow-xl p-10 flex flex-col items-center justify-center border border-gray-100 min-h-[420px]">
        <h2 className="text-5xl font-black text-gray-800 tracking-tight text-center break-all">{word.en}</h2>
        
        {show ? (
          <div className="mt-12 text-center w-full space-y-8">
            <div className="text-2xl text-indigo-600 font-bold py-6 border-t border-dashed border-gray-200">
              {word.cn}
            </div>
            <div className="flex gap-4">
              <button 
                onClick={() => {onResult(word, false); setShow(false); setIdx(idx + 1);}} 
                className="flex-1 bg-red-50 text-red-600 py-5 rounded-2xl font-black flex items-center justify-center gap-2 hover:bg-red-100 active:scale-95 transition-all"
              >
                <X size={20}/> 忘了
              </button>
              <button 
                onClick={() => {onResult(word, true); setShow(false); setIdx(idx + 1);}} 
                className="flex-1 bg-green-50 text-green-600 py-5 rounded-2xl font-black flex items-center justify-center gap-2 hover:bg-green-100 active:scale-95 transition-all"
              >
                <Check size={20}/> 记得
              </button>
            </div>
          </div>
        ) : (
          <button 
            onClick={() => setShow(true)} 
            className="mt-16 px-12 py-5 bg-indigo-600 text-white rounded-[2rem] font-black text-sm uppercase tracking-[0.2em] shadow-xl shadow-indigo-100 active:scale-95 transition-all"
          >
            显示答案
          </button>
        )}
      </div>
    </div>
  );
}

// --- 子组件：单词本详情 ---
function BookDetailView({ book, words, onBack }) {
  const [mode, setMode] = useState(1); 
  
  const bookWords = useMemo(() => {
    let filtered = words.filter(w => (w.book_ids || []).includes(book.id));
    if (mode === 2) return [...filtered].sort((a, b) => a.en.localeCompare(b.en));
    return filtered;
  }, [words, book, mode]);

  return (
    <div className="flex flex-col h-full animate-in fade-in duration-500">
      <div className="flex items-center justify-between mb-6">
        <button onClick={onBack} className="p-3 bg-white rounded-2xl shadow-sm hover:bg-gray-100 transition-colors"><ArrowLeft size={18}/></button>
        <h2 className="font-black text-xl text-gray-800 tracking-tight">{book.name}</h2>
        <div className="flex bg-gray-200 p-1 rounded-xl text-[10px] font-black">
          <button onClick={() => setMode(1)} className={`px-3 py-1.5 rounded-lg transition-all ${mode === 1 ? 'bg-white shadow-sm text-indigo-600' : 'text-gray-500'}`}>英-中</button>
          <button onClick={() => setMode(2)} className={`px-3 py-1.5 rounded-lg transition-all ${mode === 2 ? 'bg-white shadow-sm text-indigo-600' : 'text-gray-500'}`}>A-Z</button>
        </div>
      </div>
      
      <div className="space-y-3 pb-20">
        {bookWords.length === 0 ? (
          <div className="text-center py-20 text-gray-300 font-bold uppercase tracking-widest text-xs">Empty Library</div>
        ) : (
          bookWords.map(w => (
            <PracticeCard key={w.id} word={w} mode={mode} />
          ))
        )}
      </div>
    </div>
  );
}

function PracticeCard({ word, mode }) {
  const [show, setShow] = useState(false);
  const front = mode === 1 ? word.en : word.cn;
  const back = mode === 1 ? word.cn : word.en;

  return (
    <div 
      onClick={() => setShow(!show)} 
      className="bg-white p-5 rounded-[1.5rem] shadow-sm border border-gray-100 cursor-pointer hover:shadow-md transition-all active:scale-[0.98]"
    >
      <div className="flex justify-between items-center">
        <div className="text-lg font-black text-gray-700 tracking-tight">{front}</div>
        <Eye size={18} className={show ? "text-indigo-400" : "text-gray-200"} />
      </div>
      {show && (
        <div className="mt-4 pt-4 border-t border-dashed border-gray-100 text-indigo-600 font-black text-lg animate-in slide-in-from-top-2 duration-300">
          {back}
        </div>
      )}
    </div>
  );
}

// --- 子组件：新词录入 ---
function AddView({ books, onRefresh, setView }) {
  const [en, setEn] = useState('');
  const [cn, setCn] = useState('');
  const [bid, setBid] = useState('default');
  const [loading, setLoading] = useState(false);
  
  const save = async () => {
    if(!en || !cn) return alert('请填满单词和翻译哦！');
    setLoading(true);
    const { error } = await supabase.from('words').insert([{ 
      en: en.trim(), 
      cn: cn.trim(), 
      book_ids: [bid],
      next_review: new Date().toISOString(),
      stage: 0
    }]);
    
    if (error) alert('保存失败: ' + error.message);
    else {
      setEn(''); setCn('');
      onRefresh();
      alert('同步成功！');
      setView('home');
    }
    setLoading(false);
  };

  return (
    <div className="space-y-5 pt-4">
      <h2 className="text-3xl font-black text-gray-800 tracking-tighter">新词入库</h2>
      <div className="space-y-4 bg-white p-8 rounded-[2.5rem] shadow-sm border border-gray-50">
        <div className="space-y-2">
          <label className="text-[10px] font-black text-indigo-400 uppercase tracking-widest ml-1">English Word</label>
          <input 
            value={en} onChange={e=>setEn(e.target.value)} 
            className="w-full p-5 bg-gray-50 border-none rounded-2xl focus:ring-4 focus:ring-indigo-100 transition-all font-black text-xl" 
            placeholder="Word..." 
          />
        </div>
        <div className="space-y-2">
          <label className="text-[10px] font-black text-indigo-400 uppercase tracking-widest ml-1">Translation</label>
          <input 
            value={cn} onChange={e=>setCn(e.target.value)} 
            className="w-full p-5 bg-gray-50 border-none rounded-2xl focus:ring-4 focus:ring-indigo-100 transition-all font-bold" 
            placeholder="中文释义..." 
          />
        </div>
        <div className="space-y-2">
          <label className="text-[10px] font-black text-indigo-400 uppercase tracking-widest ml-1">Save to Book</label>
          <select 
            value={bid} onChange={e=>setBid(e.target.value)} 
            className="w-full p-5 bg-gray-50 border-none rounded-2xl focus:ring-4 focus:ring-indigo-100 transition-all font-bold appearance-none"
          >
            {books.filter(b => b.id !== 'mistake_auto').map(b => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
        </div>
        <button 
          onClick={save} 
          disabled={loading}
          className="w-full bg-indigo-600 text-white py-5 rounded-[2rem] font-black mt-6 shadow-xl shadow-indigo-100 active:scale-95 transition-all disabled:bg-gray-300"
        >
          {loading ? '正在同步...' : '保存到云端'}
        </button>
      </div>
    </div>
  );
}

// --- 子组件：单词本列表 ---
function BooksView({ books, onSelect }) {
  return (
    <div className="space-y-4 pt-4">
      <h2 className="text-3xl font-black text-gray-800 tracking-tighter mb-6">我的词库</h2>
      {books.map(b => (
        <div 
          key={b.id} 
          onClick={() => onSelect(b)} 
          className={`p-6 bg-white rounded-[2rem] shadow-sm flex justify-between items-center cursor-pointer border-2 border-transparent hover:border-indigo-500 hover:shadow-md transition-all active:scale-95 ${b.id === 'mistake_auto' ? 'bg-red-50/50' : ''}`}
        >
          <div className="flex items-center gap-5">
            <div className={`p-4 rounded-2xl ${b.id === 'mistake_auto' ? 'bg-red-100 text-red-600' : 'bg-indigo-100 text-indigo-600'}`}>
              <Book size={24} />
            </div>
            <div className="flex flex-col">
                <span className="font-black text-gray-700 text-lg tracking-tight">{b.name}</span>
                <span className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">{b.id === 'mistake_auto' ? 'Auto Collection' : 'Personal Book'}</span>
            </div>
          </div>
          <ArrowLeft className="rotate-180 text-gray-200" size={20}/>
        </div>
      ))}
    </div>
  );
}