import React from 'react';
import { Search, FileText, Star, Clock, Folder, Sparkles, Brain, UploadCloud } from 'lucide-react';

const DashboardHome = ({ user }) => {
  return (
    <div className="dashboard-layout">
      {/* Center Panel */}
      <div className="center-panel">
        
        {/* Search Bar */}
        <div className="search-area">
          <div className="search-input-wrapper">
            <Search size={20} color="#94a3b8" />
            <input type="text" placeholder="Search PDFs by name or meaning..." />
            <button className="btn-primary" style={{ padding: '8px 24px', height: '36px', borderRadius: '8px' }}>
              <Sparkles size={16} /> Search
            </button>
          </div>
          <div className="search-suggestions">
            <span>Try searching:</span>
            <span className="suggestion-pill">machine learning basics</span>
            <span className="suggestion-pill">neural networks</span>
            <span className="suggestion-pill">data privacy</span>
            <span className="suggestion-pill">climate change</span>
          </div>
        </div>

        {/* Upload Banner (Conditional) */}
        {!user && (
          <div className="card" style={{ backgroundColor: '#fefce8', border: '1px solid #fef08a', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <UploadCloud size={24} color="#ca8a04" />
              <div>
                <h3 style={{ fontSize: '15px', color: '#854d0e', marginBottom: '4px' }}>Upload Restricted</h3>
                <p style={{ fontSize: '13px', color: '#a16207' }}>You must sign in to upload new PDFs to your library.</p>
              </div>
            </div>
          </div>
        )}
        
        {user && (
           <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
             <button className="btn-primary"><UploadCloud size={16} /> Upload PDF</button>
           </div>
        )}

        {/* Quick Access */}
        <div>
          <div className="section-header">
            <h2 className="section-title">Quick Access</h2>
            <a href="#" className="view-all">View all</a>
          </div>
          
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px' }}>
            {/* Card 1 */}
            <div className="card" style={{ padding: '20px', backgroundColor: 'var(--accent-purple)', border: 'none' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                <div style={{ backgroundColor: 'white', padding: '10px', borderRadius: '12px' }}>
                  <FileText color="var(--icon-purple)" size={24} />
                </div>
                <div style={{ backgroundColor: 'white', width: '24px', height: '24px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <span style={{ fontSize: '12px', color: '#94a3b8' }}>→</span>
                </div>
              </div>
              <div style={{ marginTop: '16px' }}>
                <h3 style={{ fontSize: '20px', fontWeight: 'bold' }}>128</h3>
                <p style={{ fontSize: '13px', color: 'var(--text-gray)' }}>All PDFs</p>
              </div>
            </div>

            {/* Card 2 */}
            <div className="card" style={{ padding: '20px', backgroundColor: 'var(--accent-yellow)', border: 'none' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                <div style={{ backgroundColor: 'white', padding: '10px', borderRadius: '12px' }}>
                  <Star color="var(--icon-yellow)" size={24} />
                </div>
                <div style={{ backgroundColor: 'white', width: '24px', height: '24px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <span style={{ fontSize: '12px', color: '#94a3b8' }}>→</span>
                </div>
              </div>
              <div style={{ marginTop: '16px' }}>
                <h3 style={{ fontSize: '20px', fontWeight: 'bold' }}>23</h3>
                <p style={{ fontSize: '13px', color: 'var(--text-gray)' }}>Favorites</p>
              </div>
            </div>

            {/* Card 3 */}
            <div className="card" style={{ padding: '20px', backgroundColor: 'var(--accent-green)', border: 'none' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                <div style={{ backgroundColor: 'white', padding: '10px', borderRadius: '12px' }}>
                  <Clock color="var(--icon-green)" size={24} />
                </div>
                <div style={{ backgroundColor: 'white', width: '24px', height: '24px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <span style={{ fontSize: '12px', color: '#94a3b8' }}>→</span>
                </div>
              </div>
              <div style={{ marginTop: '16px' }}>
                <h3 style={{ fontSize: '20px', fontWeight: 'bold' }}>15</h3>
                <p style={{ fontSize: '13px', color: 'var(--text-gray)' }}>Recently Viewed</p>
              </div>
            </div>

            {/* Card 4 */}
            <div className="card" style={{ padding: '20px', backgroundColor: 'var(--accent-blue)', border: 'none' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                <div style={{ backgroundColor: 'white', padding: '10px', borderRadius: '12px' }}>
                  <Folder color="var(--icon-blue)" size={24} />
                </div>
                <div style={{ backgroundColor: 'white', width: '24px', height: '24px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <span style={{ fontSize: '12px', color: '#94a3b8' }}>→</span>
                </div>
              </div>
              <div style={{ marginTop: '16px' }}>
                <h3 style={{ fontSize: '20px', fontWeight: 'bold' }}>8</h3>
                <p style={{ fontSize: '13px', color: 'var(--text-gray)' }}>Collections</p>
              </div>
            </div>
          </div>
        </div>

        {/* Recent PDFs */}
        <div>
          <h2 className="section-title" style={{ marginBottom: '16px' }}>Recent PDFs</h2>
          <div className="card" style={{ padding: '0' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '3fr 1fr auto', padding: '16px 24px', borderBottom: '1px solid var(--border-color)', fontSize: '13px', color: 'var(--text-gray)', fontWeight: '600' }}>
              <div>Name</div>
              <div>Last Modified</div>
              <div></div>
            </div>
            
            {/* List Items */}
            {[
              { name: "Deep Learning Approaches for NLP.pdf", desc: "... deep learning techniques for natural language processing and context understanding ...", date: "May 20, 2024", time: "10:30 AM", fav: true },
              { name: "Attention is All You Need.pdf", desc: "... introduces the transformer model which relies solely on attention mechanism ...", date: "May 19, 2024", time: "09:15 PM", fav: false },
              { name: "Data Privacy in the Digital Age.pdf", desc: "... discusses privacy challenges, data protection and ethical considerations ...", date: "May 18, 2024", time: "04:45 PM", fav: false },
              { name: "Machine Learning Basics.pdf", desc: "... basic concepts of machine learning, supervised learning, unsupervised learning and more ...", date: "May 18, 2024", time: "11:20 AM", fav: true },
            ].map((pdf, idx) => (
              <div key={idx} style={{ display: 'grid', gridTemplateColumns: '3fr 1fr auto', padding: '16px 24px', borderBottom: idx === 3 ? 'none' : '1px solid var(--border-color)', alignItems: 'center' }}>
                <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                  <div style={{ backgroundColor: '#fee2e2', padding: '8px', borderRadius: '8px', color: '#ef4444', fontSize: '10px', fontWeight: 'bold' }}>
                    PDF
                  </div>
                  <div>
                    <h4 style={{ fontSize: '14px', color: 'var(--text-dark)', fontWeight: '500', marginBottom: '4px' }}>{pdf.name}</h4>
                    <p style={{ fontSize: '12px', color: 'var(--text-gray)' }}>{pdf.desc}</p>
                  </div>
                </div>
                <div style={{ fontSize: '12px', color: 'var(--text-gray)' }}>
                  <div style={{ marginBottom: '4px' }}>{pdf.date}</div>
                  <div>{pdf.time}</div>
                </div>
                <div style={{ display: 'flex', gap: '16px', color: '#cbd5e1' }}>
                  <Star size={18} fill={pdf.fav ? '#f59e0b' : 'none'} color={pdf.fav ? '#f59e0b' : 'currentColor'} />
                  <span style={{ fontWeight: 'bold' }}>⋮</span>
                </div>
              </div>
            ))}
            
            <div style={{ padding: '16px', textAlign: 'center', borderTop: '1px solid var(--border-color)' }}>
              <a href="#" className="view-all">View all PDFs →</a>
            </div>
          </div>
        </div>
      </div>

      {/* Right Panel */}
      <div className="right-panel">
        
        {/* Semantic Search Promo Card */}
        <div className="card" style={{ padding: '32px 24px', textAlign: 'center' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', backgroundColor: 'var(--primary-light)', color: 'var(--primary)', padding: '6px 12px', borderRadius: '20px', fontSize: '13px', fontWeight: '600', marginBottom: '24px' }}>
            <Brain size={16} /> Semantic Search
          </div>
          
          <div style={{ height: '120px', marginBottom: '24px', position: 'relative' }}>
             {/* Simple visual abstraction */}
             <div style={{ width: '80px', height: '100px', backgroundColor: '#f1f5f9', borderRadius: '8px', margin: '0 auto', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: '8px', padding: '16px' }}>
                <div style={{ height: '6px', backgroundColor: '#cbd5e1', borderRadius: '3px', width: '100%' }}></div>
                <div style={{ height: '6px', backgroundColor: '#cbd5e1', borderRadius: '3px', width: '70%' }}></div>
                <div style={{ height: '6px', backgroundColor: '#cbd5e1', borderRadius: '3px', width: '90%' }}></div>
             </div>
             {/* Connecting dots */}
             <div style={{ position: 'absolute', right: '40px', top: '20px', width: '40px', height: '40px', border: '1px dashed #7b61ff', borderRadius: '50%', zIndex: '-1' }}></div>
          </div>

          <h3 style={{ fontSize: '15px', fontWeight: '600', marginBottom: '8px' }}>Search goes beyond keywords.</h3>
          <p style={{ fontSize: '13px', color: 'var(--text-gray)', marginBottom: '16px', lineHeight: '1.5' }}>Find PDFs by concepts, topics, or meaning.</p>
          <a href="#" className="view-all">Learn more →</a>
        </div>

        {/* Top Topics */}
        <div className="card">
          <h3 style={{ fontSize: '15px', fontWeight: '600', marginBottom: '24px' }}>Top Topics in Your Library</h3>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {[
              { name: 'Machine Learning', val: 38 },
              { name: 'Deep Learning', val: 26 },
              { name: 'NLP', val: 14 },
              { name: 'Data Science', val: 10 },
              { name: 'Privacy & Security', val: 6 },
            ].map(topic => (
              <div key={topic.name}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '8px' }}>
                  <span style={{ color: 'var(--text-dark)' }}>{topic.name}</span>
                  <span style={{ color: 'var(--text-gray)' }}>{topic.val}%</span>
                </div>
                <div style={{ height: '6px', backgroundColor: '#f1f5f9', borderRadius: '3px', overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${topic.val}%`, backgroundColor: 'var(--primary-light)' }}>
                     <div style={{ height: '100%', width: '100%', backgroundColor: 'var(--primary)', borderRadius: '3px' }}></div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Quote */}
        <div className="card" style={{ backgroundColor: 'var(--primary-light)', border: 'none' }}>
          <p style={{ fontSize: '14px', color: 'var(--primary)', fontStyle: 'italic', lineHeight: '1.6', marginBottom: '16px', fontWeight: '500' }}>
            "The goal is to turn data into information, and information into insight."
          </p>
          <p style={{ fontSize: '12px', color: 'var(--primary)', textAlign: 'right' }}>- Carly Fiorina</p>
        </div>

      </div>
    </div>
  );
};

export default DashboardHome;
