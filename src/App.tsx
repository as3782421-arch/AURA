import { useState, useEffect } from 'react';
import { useAuth } from './contexts/AuthContext';
import { db } from './lib/firebase';
import { collection, query, where, onSnapshot, addDoc, serverTimestamp, deleteDoc, doc, updateDoc } from 'firebase/firestore';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Library, 
  Sparkles, 
  Brain, 
  Plus, 
  Film, 
  Tv, 
  Gamepad2, 
  BookOpen, 
  Clapperboard, 
  Search,
  Filter,
  CheckCircle2,
  Clock,
  Trash2,
  ChevronRight,
  TrendingUp,
  History,
  Info
} from 'lucide-react';
import { getRecommendations, getBrainstorming } from './services/gemini';
import Markdown from 'react-markdown';

// --- Types ---
interface MediaEntry {
  id: string;
  title: string;
  type: 'anime' | 'web-series' | 'movie' | 'manga' | 'game' | 'tv-show';
  status: 'watching' | 'completed' | 'dropped' | 'planned';
  rating?: number;
  review?: string;
  watchedAt: any;
  coverUrl?: string;
}

// --- Main App ---
export default function App() {
  const { user, loading, signIn } = useAuth();
  const [activeTab, setActiveTab] = useState<'vault' | 'feed' | 'brainstorming' | 'stats'>('vault');

  if (loading) return (
    <div className="h-screen w-screen flex items-center justify-center bg-aura-black">
      <motion.div 
        animate={{ scale: [1, 1.1, 1], opacity: [0.5, 1, 0.5] }}
        transition={{ repeat: Infinity, duration: 2 }}
        className="text-aura-accent font-serif text-4xl"
      >
        Aura
      </motion.div>
    </div>
  );

  if (!user) return <LandingPage onSignIn={signIn} />;

  return (
    <div className="min-h-screen bg-aura-black aura-gradient flex flex-col md:flex-row">
      <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} />
      
      <main className="flex-1 p-6 md:p-10 overflow-y-auto max-h-screen no-scrollbar">
        <AnimatePresence mode="wait">
          {activeTab === 'vault' && <VaultView key="vault" />}
          {activeTab === 'feed' && <FeedView key="feed" />}
          {activeTab === 'brainstorming' && <BrainstormingView key="brainstorming" />}
          {activeTab === 'stats' && <StatsView key="stats" />}
        </AnimatePresence>
      </main>
    </div>
  );
}

// --- Sub-Views ---

function VaultView() {
  const { user } = useAuth();
  const [items, setItems] = useState<MediaEntry[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [filter, setFilter] = useState<string>('all');

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, 'vault'), where('uid', '==', user.uid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as MediaEntry[];
      setItems(data.sort((a, b) => (b.watchedAt?.seconds || 0) - (a.watchedAt?.seconds || 0)));
    });
    return unsubscribe;
  }, [user]);

  const filteredItems = filter === 'all' ? items : items.filter(i => i.type === filter);

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="max-w-6xl mx-auto"
    >
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-10">
        <div>
          <h1 className="text-4xl font-serif font-black tracking-tight mb-2 italic">The Vault</h1>
          <p className="text-aura-muted">Your curated lifetime content history.</p>
        </div>
        
        <div className="flex items-center gap-3">
          <div className="flex bg-white/5 rounded-full p-1 border border-white/10 overflow-x-auto no-scrollbar max-w-[300px] md:max-w-none">
            {['all', 'anime', 'movie', 'web-series', 'tv-show', 'manga', 'game'].map(type => (
              <button
                key={type}
                onClick={() => setFilter(type)}
                className={`px-4 py-1.5 rounded-full text-xs font-medium transition-all whitespace-nowrap ${filter === type ? 'bg-aura-accent text-white' : 'text-aura-muted hover:text-white'}`}
              >
                {type.charAt(0).toUpperCase() + type.slice(1).replace('-', ' ')}
              </button>
            ))}
          </div>
          <button 
            onClick={() => setIsAdding(true)}
            className="bg-white text-black p-3 rounded-full hover:bg-aura-accent hover:text-white transition-all shadow-xl shadow-white/5"
          >
            <Plus size={24} />
          </button>
        </div>
      </header>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
        {filteredItems.map((item) => (
          <MediaCard key={item.id} item={item} />
        ))}
        {filteredItems.length === 0 && (
          <div className="col-span-full py-20 text-center border-2 border-dashed border-white/5 rounded-3xl">
            <Library size={48} className="mx-auto mb-4 opacity-20" />
            <p className="text-aura-muted italic">Your vault is empty. Start your journey by adding content.</p>
          </div>
        )}
      </div>

      <AnimatePresence>
        {isAdding && <AddMediaModal onClose={() => setIsAdding(false)} />}
      </AnimatePresence>
    </motion.div>
  );
}

function FeedView() {
  const { user } = useAuth();
  const [recommendations, setRecommendations] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [watchedTitles, setWatchedTitles] = useState<string[]>([]);

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, 'vault'), where('uid', '==', user.uid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const titles = snapshot.docs.map(doc => doc.data().title);
      setWatchedTitles(titles);
    });
    return unsubscribe;
  }, [user]);

  const loadRecommendations = async () => {
    if (watchedTitles.length === 0) return;
    setLoading(true);
    const recs = await getRecommendations(watchedTitles, ['anime', 'movies', 'web-series']);
    setRecommendations(recs);
    setLoading(false);
  };

  useEffect(() => {
    if (watchedTitles.length > 0 && recommendations.length === 0) {
      loadRecommendations();
    }
  }, [watchedTitles]);

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0 }}
      className="max-w-4xl mx-auto"
    >
      <div className="flex justify-between items-center mb-10">
        <div>
          <h1 className="text-4xl font-serif font-black italic">Discovery Feed</h1>
          <p className="text-aura-muted">AI-curated recommendations based on your taste.</p>
        </div>
        <button 
          onClick={loadRecommendations}
          disabled={loading}
          className="flex items-center gap-2 px-6 py-3 glass-card hover:bg-white/10 transition-all text-sm font-medium disabled:opacity-50"
        >
          {loading ? "Re-tuning..." : <><Sparkles size={18} /> Refresh Loop</>}
        </button>
      </div>

      <div className="flex flex-col gap-8">
        {recommendations.map((rec: any, idx) => (
          <motion.div 
            key={idx}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: idx * 0.1 }}
            className="glass-card p-8 flex flex-col md:flex-row gap-8 items-center"
          >
            <div className="w-full md:w-1/3 aspect-[3/4] bg-aura-gray rounded-xl overflow-hidden shadow-2xl relative group">
              <img 
                src={rec.imageUrl || `https://picsum.photos/seed/${rec.title}/400/600`} 
                alt={rec.title}
                className="w-full h-full object-cover transition-transform group-hover:scale-105"
                referrerPolicy="no-referrer"
              />
              <div className="absolute top-4 left-4 flex gap-2">
                 <span className="px-3 py-1 bg-black/80 backdrop-blur-md rounded-full text-[10px] uppercase font-bold tracking-widest leading-none flex items-center">
                   {rec.type}
                 </span>
              </div>
            </div>
            <div className="flex-1 space-y-4">
              <div className="flex items-center gap-3">
                <h3 className="text-3xl font-serif italic text-aura-accent">{rec.title}</h3>
                {rec.isRewatch && (
                  <span className="bg-aura-accent font-bold text-[10px] text-black px-2 py-0.5 rounded italic">REWATCH LOOP</span>
                )}
              </div>
              <div className="p-4 bg-white/5 rounded-xl border-l-4 border-aura-accent italic text-sm">
                "{rec.reason}"
              </div>
              <p className="text-aura-muted text-lg leading-relaxed">{rec.highlight}</p>
              <div className="pt-4 flex gap-4">
                <button 
                  onClick={() => {/* Direct add logic */}}
                  className="bg-white text-black px-8 py-3 rounded-full font-bold hover:bg-aura-accent hover:text-white transition-all text-sm"
                >
                  Add to Vault
                </button>
              </div>
            </div>
          </motion.div>
        ))}

        {watchedTitles.length === 0 && (
          <div className="text-center py-20 glass-card">
             <Info size={48} className="mx-auto mb-4 opacity-20" />
             <p className="text-aura-muted italic">Add items to your vault to unlock Personalized Recommendations.</p>
          </div>
        )}
      </div>
    </motion.div>
  );
}

function BrainstormingView() {
  const { user } = useAuth();
  const [vaultItems, setVaultItems] = useState<MediaEntry[]>([]);
  const [selectedItem, setSelectedItem] = useState<string>('');
  const [analysis, setAnalysis] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, 'vault'), where('uid', '==', user.uid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setVaultItems(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as MediaEntry[]);
    });
    return unsubscribe;
  }, [user]);

  const handleDeepDive = async () => {
    if (!selectedItem) return;
    setLoading(true);
    const result = await getBrainstorming(selectedItem);
    setAnalysis(result);
    setLoading(false);
  };

  return (
    <div className="max-w-4xl mx-auto">
      <header className="mb-10 text-center">
        <h1 className="text-5xl font-serif font-black italic mb-4">Deep Dives</h1>
        <p className="text-aura-muted text-lg">Analyze characters, themes, and story arcs across your history.</p>
      </header>

      <div className="glass-card p-8 mb-10 space-y-6">
        <div className="flex flex-col md:flex-row gap-4">
          <select 
            value={selectedItem}
            onChange={(e) => setSelectedItem(e.target.value)}
            className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-aura-accent transition-all appearance-none"
          >
            <option value="" className="bg-aura-black">Select from your vault...</option>
            {vaultItems.map(item => (
              <option key={item.id} value={item.title} className="bg-aura-black">{item.title}</option>
            ))}
          </select>
          <button 
            onClick={handleDeepDive}
            disabled={!selectedItem || loading}
            className="bg-aura-accent text-white px-8 py-3 rounded-xl font-bold hover:opacity-90 transition-all disabled:opacity-50 flex items-center gap-2 justify-center"
          >
            {loading ? "Analyzing..." : <><Brain size={20} /> Brainstorm</>}
          </button>
        </div>

        {analysis && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="prose prose-invert max-w-none bg-black/20 p-8 rounded-2xl border border-white/5 font-sans leading-relaxed"
          >
            <Markdown>{analysis}</Markdown>
          </motion.div>
        )}
      </div>
    </div>
  );
}

function StatsView() {
  const { user } = useAuth();
  const [items, setItems] = useState<MediaEntry[]>([]);

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, 'vault'), where('uid', '==', user.uid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setItems(snapshot.docs.map(doc => doc.data()) as MediaEntry[]);
    });
    return unsubscribe;
  }, [user]);

  const stats = {
    total: items.length,
    anime: items.filter(i => i.type === 'anime').length,
    movies: items.filter(i => i.type === 'movie').length,
    series: items.filter(i => i.type === 'web-series').length,
    completed: items.filter(i => i.status === 'completed').length
  };

  return (
    <div className="max-w-4xl mx-auto space-y-10">
      <div>
        <h1 className="text-4xl font-serif font-black italic mb-2">Life Stats</h1>
        <p className="text-aura-muted">Quantifying your journey through digital worlds.</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard label="Total Consumed" value={stats.total} icon={<Library className="text-aura-accent" />} />
        <StatCard label="Completed" value={stats.completed} icon={<CheckCircle2 className="text-green-500" />} />
        <StatCard label="Anime" value={stats.anime} icon={<Tv className="text-blue-400" />} />
        <StatCard label="Movies" value={stats.movies} icon={<Film className="text-red-400" />} />
      </div>

      <div className="glass-card p-10 flex flex-col items-center text-center space-y-6">
        <div className="bg-aura-accent/20 p-6 rounded-full">
           <TrendingUp size={48} className="text-aura-accent" />
        </div>
        <h3 className="text-2xl font-serif italic italic">Doom-Scroll Buffer</h3>
        <p className="text-aura-muted max-w-md">By focusing on your curated vault, you've saved countless hours from mindless social media surfing. Aura helps you choose intention over infinity.</p>
      </div>
    </div>
  );
}

// --- UI Components ---

function Sidebar({ activeTab, setActiveTab }: { activeTab: string, setActiveTab: (t: any) => void }) {
  const { user, logout } = useAuth();

  const navItems = [
    { id: 'vault', label: 'Vault', icon: <Library size={20} /> },
    { id: 'feed', label: 'Discovery', icon: <Sparkles size={20} /> },
    { id: 'brainstorming', label: 'Deep Dives', icon: <Brain size={20} /> },
    { id: 'stats', label: 'Insights', icon: <TrendingUp size={20} /> },
  ];

  return (
    <aside className="w-full md:w-80 bg-aura-black border-b md:border-b-0 md:border-r border-white/10 p-6 flex flex-col justify-between h-auto md:h-screen sticky top-0 z-50">
      <div className="space-y-10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-aura-accent rounded-lg flex items-center justify-center font-bold text-black shadow-lg shadow-aura-accent/20">A</div>
          <span className="text-2xl font-serif font-black tracking-tighter italic">Aura</span>
        </div>

        <nav className="space-y-2">
          {navItems.map(item => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`w-full flex items-center gap-4 px-5 py-4 rounded-2xl text-sm font-semibold transition-all ${activeTab === item.id ? 'bg-white text-black shadow-xl' : 'text-aura-muted hover:bg-white/5 hover:text-white'}`}
            >
              {item.icon}
              {item.label}
            </button>
          ))}
        </nav>
      </div>

      <div className="mt-10 flex items-center gap-4 border-t border-white/5 pt-6">
        <img 
          src={user?.photoURL || ''} 
          alt={user?.displayName || ''} 
          className="w-10 h-10 rounded-full border border-white/20"
          referrerPolicy="no-referrer"
        />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold truncate leading-none mb-1">{user?.displayName}</p>
          <button onClick={logout} className="text-xs text-aura-accent hover:underline font-mono uppercase tracking-tighter">Sign Out</button>
        </div>
      </div>
    </aside>
  );
}

function MediaCard({ item }: { item: MediaEntry }) {
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async () => {
    if (confirm(`Delete ${item.title}?`)) {
      setIsDeleting(true);
      await deleteDoc(doc(db, 'vault', item.id));
    }
  };

  const getIcon = () => {
    switch (item.type) {
      case 'anime': return <Tv size={14} />;
      case 'movie': return <Film size={14} />;
      case 'tv-show': return <Tv size={14} />;
      case 'web-series': return <Clapperboard size={14} />;
      case 'manga': return <BookOpen size={14} />;
      case 'game': return <Gamepad2 size={14} />;
    }
  };

  return (
    <motion.div 
      layout
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className={`glass-card overflow-hidden group relative transition-all duration-500 hover:shadow-2xl hover:shadow-aura-accent/10 ${isDeleting ? 'scale-90 opacity-50' : ''}`}
    >
      <div className="aspect-[3/4] relative overflow-hidden bg-aura-gray">
        <img 
          src={item.coverUrl || `https://picsum.photos/seed/${item.title}/400/600`} 
          alt={item.title} 
          className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
          referrerPolicy="no-referrer"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent opacity-80" />
        
        <div className="absolute top-3 left-3 flex gap-2">
           <span className="px-2 py-1 bg-black/60 backdrop-blur-md rounded-md text-[9px] uppercase font-bold tracking-widest flex items-center gap-1">
             {getIcon()} {item.type}
           </span>
        </div>

        <div className="absolute bottom-4 left-4 right-4">
          <h3 className="text-lg font-serif italic mb-1 truncate group-hover:text-aura-accent transition-colors">{item.title}</h3>
          <div className="flex items-center gap-3 text-[10px] text-aura-muted uppercase tracking-wider font-bold">
            <span className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-aura-accent/20 text-aura-accent">{item.status}</span>
            {item.rating && <span className="flex items-center gap-1"><History size={10} /> {item.rating}/10</span>}
          </div>
        </div>
      </div>
      
      <button 
        onClick={handleDelete}
        className="absolute top-3 right-3 p-2 bg-red-500/0 hover:bg-red-500/80 rounded-full opacity-0 group-hover:opacity-100 transition-all text-white"
      >
        <Trash2 size={16} />
      </button>
    </motion.div>
  );
}

function AddMediaModal({ onClose }: { onClose: () => void }) {
  const { user } = useAuth();
  const [formData, setFormData] = useState({
    title: '',
    type: 'anime',
    status: 'watching',
    rating: 8,
    review: '',
    currentProgress: ''
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    
    await addDoc(collection(db, 'vault'), {
      ...formData,
      uid: user.uid,
      watchedAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/80 backdrop-blur-sm">
      <motion.div 
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="glass-card w-full max-w-xl p-8 md:p-12 relative"
      >
        <h2 className="text-3xl font-serif italic mb-8">Add to Vault</h2>
        
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2 md:col-span-2">
              <label className="text-[10px] uppercase font-bold tracking-widest text-aura-muted">Original Title</label>
              <input 
                autoFocus
                required
                value={formData.title}
                onChange={e => setFormData({...formData, title: e.target.value})}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-aura-accent"
                placeholder="e.g. Neon Genesis Evangelion"
              />
            </div>

            <div className="space-y-2">
              <label className="text-[10px] uppercase font-bold tracking-widest text-aura-muted">Category</label>
              <select 
                value={formData.type}
                onChange={e => setFormData({...formData, type: e.target.value as any})}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 capitalize"
              >
                {['anime', 'web-series', 'tv-show', 'movie', 'manga', 'game'].map(t => (
                  <option key={t} value={t} className="bg-aura-black">{t.replace('-', ' ')}</option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] uppercase font-bold tracking-widest text-aura-muted">Status</label>
              <select 
                value={formData.status}
                onChange={e => setFormData({...formData, status: e.target.value as any})}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 capitalize"
              >
                {['watching', 'completed', 'dropped', 'planned'].map(s => (
                  <option key={s} value={s} className="bg-aura-black">{s}</option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] uppercase font-bold tracking-widest text-aura-muted">Rating ({formData.rating}/10)</label>
              <input 
                type="range"
                min="0" max="10"
                value={formData.rating}
                onChange={e => setFormData({...formData, rating: parseFloat(e.target.value)})}
                className="w-full accent-aura-accent"
              />
            </div>
          </div>

          <div className="flex gap-4 pt-6">
            <button 
              type="button"
              onClick={onClose}
              className="flex-1 py-4 border border-white/10 rounded-xl hover:bg-white/5 transition-all text-sm font-bold"
            >
              Cancel
            </button>
            <button 
              type="submit"
              className="flex-1 py-4 bg-aura-accent text-white rounded-xl font-bold shadow-2xl shadow-aura-accent/20 hover:opacity-90 transition-all text-sm"
            >
              Log into History
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

function StatCard({ label, value, icon }: { label: string, value: number, icon: any }) {
  return (
    <div className="glass-card p-6 flex items-center gap-5">
      <div className="w-12 h-12 bg-white/5 rounded-2xl flex items-center justify-center border border-white/5">
        {icon}
      </div>
      <div>
        <div className="text-3xl font-serif italic italic leading-none mb-1">{value}</div>
        <div className="text-[10px] uppercase font-bold tracking-widest text-aura-muted">{label}</div>
      </div>
    </div>
  );
}

function LandingPage({ onSignIn }: { onSignIn: () => void }) {
  return (
    <div className="h-screen w-screen bg-aura-black aura-gradient flex flex-col items-center justify-center p-6 text-center overflow-hidden">
      <motion.div 
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-3xl space-y-8"
      >
        <div className="w-24 h-24 bg-aura-accent rounded-3xl mx-auto flex items-center justify-center mb-6 shadow-[0_0_60px_rgba(242,125,38,0.3)]">
          <span className="text-6xl font-serif font-black text-black italic">A</span>
        </div>
        <h1 className="text-7xl font-serif font-black tracking-tighter italic lg:text-9xl mb-4">Aura.</h1>
        <p className="text-xl md:text-2xl text-aura-muted leading-relaxed font-light max-w-2xl mx-auto italic">
          Stop scrolling, start witnessing. A digital sanctuary to curate your anime, manga, and cinema history.
        </p>
        
        <div className="pt-10 flex flex-col md:flex-row gap-6 justify-center">
          <button 
            onClick={onSignIn}
            className="px-12 py-5 bg-white text-black rounded-full font-black text-lg hover:bg-aura-accent hover:text-white hover:scale-105 transition-all shadow-2xl shadow-white/10"
          >
            Enter the Vault
          </button>
          <div className="flex bg-white/5 backdrop-blur-md rounded-full px-6 py-4 items-center gap-3 border border-white/10">
            <Sparkles className="text-aura-accent" size={20} />
            <span className="text-sm font-medium opacity-80 italic">Powered by Gemini Intelligence</span>
          </div>
        </div>

        <div className="pt-20 grid grid-cols-1 md:grid-cols-3 gap-10 opacity-40">
           <div className="space-y-2">
             <div className="font-serif italic text-xl">Category-Wise Vault</div>
             <p className="text-xs uppercase tracking-widest">Anime • Manga • Cine</p>
           </div>
           <div className="space-y-2">
             <div className="font-serif italic text-xl">AI-Insights</div>
             <p className="text-xs uppercase tracking-widest">Deep-Dive Story Beats</p>
           </div>
           <div className="space-y-2">
             <div className="font-serif italic text-xl">Discovery Loop</div>
             <p className="text-xs uppercase tracking-widest">Taste-Based Discovery</p>
           </div>
        </div>
      </motion.div>
    </div>
  );
}
