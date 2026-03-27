import React, { useState, useEffect, useMemo } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { 
  Plus, 
  Search, 
  Printer, 
  Trash2, 
  Edit3, 
  Download, 
  Upload, 
  X, 
  AlertTriangle,
} from 'lucide-react';
import './App.css';

interface Box {
  id: number;
  category: string;
  items: string[];
  isFragile: boolean;
  createdAt: string;
}

const STORAGE_KEY = 'relotracker_data';

const App: React.FC = () => {
  const [boxes, setBoxes] = useState<Box[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved) : [];
  });
  
  const [search, setSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingBox, setEditingBox] = useState<Box | null>(null);
  const [printingBox, setPrintingBox] = useState<Box | null>(null);
  
  // Form State
  const [category, setCategory] = useState('');
  const [items, setItems] = useState<string[]>(['']);
  const [isFragile, setIsFragile] = useState(false);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(boxes));
  }, [boxes]);

  const filteredBoxes = useMemo(() => {
    if (!search) return boxes;
    const s = search.toLowerCase();
    return boxes.filter(box => 
      box.id.toString().includes(s) ||
      box.category.toLowerCase().includes(s) ||
      box.items.some(item => item.toLowerCase().includes(s))
    );
  }, [boxes, search]);

  const handleOpenModal = (box?: Box) => {
    if (box) {
      setEditingBox(box);
      setCategory(box.category);
      setItems(box.items.length > 0 ? box.items : ['']);
      setIsFragile(box.isFragile);
    } else {
      setEditingBox(null);
      setCategory('');
      setItems(['']);
      setIsFragile(false);
    }
    setIsModalOpen(true);
  };

  const handleSaveBox = () => {
    if (!category.trim()) return;
    
    const cleanItems = items.filter(i => i.trim() !== '');
    
    if (editingBox) {
      setBoxes(prev => prev.map(b => b.id === editingBox.id ? {
        ...b,
        category: category.toUpperCase(),
        items: cleanItems,
        isFragile
      } : b));
    } else {
      const nextId = boxes.length > 0 ? Math.max(...boxes.map(b => b.id)) + 1 : 1;
      const newBox: Box = {
        id: nextId,
        category: category.toUpperCase(),
        items: cleanItems,
        isFragile,
        createdAt: new Date().toISOString().split('T')[0]
      };
      setBoxes(prev => [...prev, newBox]);
    }
    setIsModalOpen(false);
  };

  const handleDeleteBox = (id: number) => {
    if (window.confirm('Delete this box?')) {
      setBoxes(prev => prev.filter(b => b.id !== id));
    }
  };

  const handleExport = () => {
    const data = JSON.stringify({ boxes }, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `relotracker_backup_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = JSON.parse(event.target?.result as string);
        if (data.boxes && Array.isArray(data.boxes)) {
          setBoxes(data.boxes);
        }
      } catch (err) {
        alert('Invalid backup file');
      }
    };
    reader.readAsText(file);
  };

  const triggerPrint = (box: Box) => {
    setPrintingBox(box);
    setTimeout(() => {
      window.print();
    }, 100);
  };

  return (
    <div className="container">
      {/* Search Header */}
      <header className="header-glass">
        <div className="search-container">
          <Search size={18} className="search-icon" />
          <input 
            type="text" 
            placeholder="Search items, boxes, or rooms..." 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="header-actions">
          <button className="btn-icon" onClick={() => handleOpenModal()} title="Add Box">
            <Plus size={20} />
          </button>
          <button className="btn-icon" onClick={handleExport} title="Export Data">
            <Download size={20} />
          </button>
          <label className="btn-icon" title="Import Data">
            <Upload size={20} />
            <input type="file" hidden onChange={handleImport} accept=".json" />
          </label>
        </div>
      </header>

      <main className="content">
        <div className="box-grid">
          {filteredBoxes.map(box => (
            <div key={box.id} className="box-card">
              <div className="box-card-header">
                <span className="box-id">#{box.id.toString().padStart(3, '0')}</span>
                <span className="box-category">{box.category}</span>
                {box.isFragile && <AlertTriangle size={16} className="fragile-icon" />}
              </div>
              <ul className="box-items-preview">
                {box.items.slice(0, 3).map((item, i) => (
                  <li key={i}>{item}</li>
                ))}
                {box.items.length > 3 && <li>+ {box.items.length - 3} more</li>}
                {box.items.length === 0 && <li className="empty-hint">Empty box</li>}
              </ul>
              <div className="box-card-actions">
                <button onClick={() => triggerPrint(box)}><Printer size={16} /> Print</button>
                <button onClick={() => handleOpenModal(box)}><Edit3 size={16} /> Edit</button>
                <button onClick={() => handleDeleteBox(box.id)} className="btn-delete"><Trash2 size={16} /></button>
              </div>
            </div>
          ))}
          {filteredBoxes.length === 0 && (
            <div className="empty-state">
              <p>{search ? 'No matches found' : 'Start by adding your first box'}</p>
              {!search && <button onClick={() => handleOpenModal()} className="btn-primary">Add Box</button>}
            </div>
          )}
        </div>
      </main>

      {/* Modal */}
      {isModalOpen && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h2>{editingBox ? 'Edit Box' : 'New Box'}</h2>
              <button onClick={() => setIsModalOpen(false)} className="btn-close"><X /></button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label>Category / Room</label>
                <input 
                  autoFocus
                  type="text" 
                  placeholder="e.g. KITCHEN, LIVING ROOM" 
                  value={category}
                  onChange={(e) => setCategory(e.target.value.toUpperCase())}
                />
              </div>
              <div className="form-group">
                <label>Items</label>
                {items.map((item, idx) => (
                  <div key={idx} className="item-input">
                    <input 
                      type="text" 
                      placeholder="Item name" 
                      value={item}
                      onChange={(e) => {
                        const newItems = [...items];
                        newItems[idx] = e.target.value;
                        setItems(newItems);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          setItems([...items, '']);
                        }
                      }}
                    />
                    <button onClick={() => {
                      const newItems = items.filter((_, i) => i !== idx);
                      setItems(newItems.length ? newItems : ['']);
                    }}><X size={14}/></button>
                  </div>
                ))}
                <button className="btn-text" onClick={() => setItems([...items, ''])}>
                  <Plus size={14} /> Add Item
                </button>
              </div>
              <div className="form-group-row">
                <label className="checkbox-container">
                  <input 
                    type="checkbox" 
                    checked={isFragile}
                    onChange={(e) => setIsFragile(e.target.checked)}
                  />
                  <span>Mark as Fragile</span>
                </label>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-primary" onClick={handleSaveBox}>Save Box</button>
            </div>
          </div>
        </div>
      )}

      {/* Print View (Visible only during print) */}
      <div className="print-area">
        {printingBox && (
          <div className="label-4x6">
            <div className="label-header">
              {printingBox.category}
            </div>
            <div className="label-middle">
              <div className="label-qr">
                <QRCodeSVG 
                  value={printingBox.items.join('\n')} 
                  size={218}
                  level="M"
                  includeMargin={false}
                />
              </div>
              <div className="label-info">
                <div className="label-id">#{printingBox.id.toString().padStart(3, '0')}</div>
                <div className="label-footer-count">{printingBox.items.length} items</div>
                {printingBox.isFragile && (
                  <div className="label-fragile">
                    <span>FRAGILE</span>
                  </div>
                )}
              </div>
            </div>
            <div className="label-footer">
              <ul className="label-items">
                {printingBox.items.map((item, i) => (
                  <li key={i}>{item}</li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default App;
