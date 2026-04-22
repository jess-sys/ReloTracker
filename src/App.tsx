import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { useKindeAuth } from '@kinde-oss/kinde-auth-react';
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
  CloudUpload,
  LogOut,
  ChevronDown,
} from 'lucide-react';
import { apiFetch } from './lib/api';
import './App.css';

interface Box {
  id: number;
  category: string;
  items: string[];
  isFragile: boolean;
  createdAt: string;
}

const STORAGE_KEY = 'supermover_data';

const App: React.FC = () => {
  const { isAuthenticated, isLoading, login, register, logout, user, getToken } =
    useKindeAuth();

  const getAccessToken = useCallback(async (): Promise<string | null> => {
    if (!getToken) return null;
    const token = await getToken();
    return token ?? null;
  }, [getToken]);

  const [boxes, setBoxes] = useState<Box[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved) : [];
  });

  const [search, setSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingBox, setEditingBox] = useState<Box | null>(null);
  const [printingBox, setPrintingBox] = useState<Box | null>(null);

  const [category, setCategory] = useState('');
  const [items, setItems] = useState<string[]>(['']);
  const [isFragile, setIsFragile] = useState(false);

  const [showUserMenu, setShowUserMenu] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [syncStatus, setSyncStatus] = useState<string | null>(null);
  const [remoteLoaded, setRemoteLoaded] = useState(false);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(boxes));
  }, [boxes]);

  // Load remote boxes once after login
  const loadRemote = useCallback(async () => {
    const token = await getAccessToken();
    if (!token) return;
    try {
      const res = await apiFetch('/boxes', token);
      if (!res.ok) {
        setSyncError(`Failed to load from server (${res.status})`);
        return;
      }
      const remote = (await res.json()) as Box[];
      if (remote.length > 0) {
        setBoxes(remote);
      }
      setRemoteLoaded(true);
    } catch (e) {
      setSyncError(e instanceof Error ? e.message : 'Failed to load from server');
    }
  }, [getAccessToken]);

  useEffect(() => {
    if (isAuthenticated && !remoteLoaded) loadRemote();
  }, [isAuthenticated, remoteLoaded, loadRemote]);

  const handleSync = async () => {
    const token = await getAccessToken();
    if (!token) return;
    setSyncing(true);
    setSyncError(null);
    setSyncStatus(null);
    try {
      const res = await apiFetch('/boxes/sync', token, {
        method: 'POST',
        body: JSON.stringify({ boxes }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setSyncError(body?.error || `Sync failed (${res.status})`);
        return;
      }
      setSyncStatus(`Synced ${boxes.length} ${boxes.length === 1 ? 'box' : 'boxes'} to cloud`);
      setTimeout(() => setSyncStatus(null), 3000);
    } catch (e) {
      setSyncError(e instanceof Error ? e.message : 'Sync failed');
    } finally {
      setSyncing(false);
    }
  };

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
    a.download = `supermover_backup_${new Date().toISOString().split('T')[0]}.json`;
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
      } catch {
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

  // Loading
  if (isLoading) {
    return (
      <div className="loading-screen">
        <div className="spinner" />
      </div>
    );
  }

  // Login
  if (!isAuthenticated) {
    return (
      <div className="login-bg">
        <div className="login-card">
          <h1 className="login-title">
            <span className="brand-muted">Neutheria </span>SuperMover
          </h1>
          <div className="login-divider" />
          <p className="login-sub">
            Pack, label, and track every box of your move.
          </p>
          <div className="login-actions">
            <button className="login-btn-primary" onClick={() => login()}>
              Sign In
            </button>
            <button className="login-btn-secondary" onClick={() => register()}>
              Create Account
            </button>
          </div>
          <div className="login-footer">
            Secure authentication provided by Kinde. Your data is encrypted and
            stored on Cloudflare&rsquo;s global network.
          </div>
        </div>
      </div>
    );
  }

  const displayName = user?.given_name
    ? `${user.given_name}${user.family_name ? ` ${user.family_name}` : ''}`
    : user?.email || 'User';

  const initial = (user?.given_name?.[0] || user?.email?.[0] || 'U').toUpperCase();

  return (
    <>
      {/* Top Bar */}
      <div className="topbar-wrap">
        <div className="topbar">
          <div className="brand">
            <span className="brand-muted">Neutheria </span>SuperMover
          </div>

          <div className="topbar-actions">
            <div className="topbar-search">
              <Search size={16} className="search-icon" />
              <input
                type="text"
                placeholder="Search items, boxes, or rooms…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            <button className="pill-btn" onClick={() => handleOpenModal()} title="Add Box">
              <Plus size={16} />
              <span>Add Box</span>
            </button>

            <button
              className="pill-btn sync"
              onClick={handleSync}
              disabled={syncing}
              title="Save to cloud"
            >
              <CloudUpload size={16} />
              <span>{syncing ? 'Saving…' : 'Save'}</span>
            </button>

            <button className="pill-btn ghost" onClick={handleExport} title="Export JSON">
              <Download size={16} />
            </button>
            <label className="pill-btn ghost" title="Import JSON" style={{ cursor: 'pointer' }}>
              <Upload size={16} />
              <input type="file" hidden onChange={handleImport} accept=".json" />
            </label>

            <div className="user-wrap">
              <button className="user-btn" onClick={() => setShowUserMenu(v => !v)}>
                <div className="user-avatar">{initial}</div>
                <span className="user-name">{displayName}</span>
                <ChevronDown size={14} color="#9ca3af" />
              </button>
              {showUserMenu && (
                <>
                  <div className="menu-backdrop" onClick={() => setShowUserMenu(false)} />
                  <div className="user-menu">
                    <div className="user-menu-header">
                      <div className="name">{displayName}</div>
                      {user?.email && <div className="email">{user.email}</div>}
                    </div>
                    <button
                      className="signout"
                      onClick={() => {
                        setShowUserMenu(false);
                        logout();
                      }}
                    >
                      <LogOut size={14} />
                      Sign out
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      <main className="container">
        <div className="page-title">
          <h2>Your boxes</h2>
          <p>Every item packed, every room catalogued.</p>
        </div>

        {syncError && (
          <div className="banner">
            <span>{syncError}</span>
            <button onClick={() => setSyncError(null)}>Dismiss</button>
          </div>
        )}

        {syncStatus && (
          <div className="banner info">
            <span>{syncStatus}</span>
          </div>
        )}

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
                <button onClick={() => triggerPrint(box)}><Printer size={14} /> Print</button>
                <button onClick={() => handleOpenModal(box)}><Edit3 size={14} /> Edit</button>
                <button onClick={() => handleDeleteBox(box.id)} className="btn-delete" aria-label="Delete">
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
          {filteredBoxes.length === 0 && (
            <div className="empty-state">
              <p>{search ? 'No matches found' : 'No boxes yet'}</p>
              {!search && (
                <>
                  <p className="empty-sub">
                    Add your first box to start tracking.
                  </p>
                  <button onClick={() => handleOpenModal()} className="btn-primary" style={{ maxWidth: 220, margin: '0 auto' }}>
                    Add Box
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </main>

      {/* Modal */}
      {isModalOpen && (
        <div className="modal-overlay" onClick={() => setIsModalOpen(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{editingBox ? 'Edit Box' : 'New Box'}</h2>
              <button onClick={() => setIsModalOpen(false)} className="btn-close" aria-label="Close">
                <X size={18} />
              </button>
            </div>
            <div>
              <div className="form-group">
                <label>Category / Room</label>
                <input
                  autoFocus
                  type="text"
                  className="glass-input"
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
                      className="glass-input"
                      placeholder="Item name"
                      value={item}
                      onChange={(e) => {
                        const newItems = [...items];
                        newItems[idx] = e.target.value;
                        setItems(newItems);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          setItems([...items, '']);
                        }
                      }}
                    />
                    <button
                      onClick={() => {
                        const newItems = items.filter((_, i) => i !== idx);
                        setItems(newItems.length ? newItems : ['']);
                      }}
                      aria-label="Remove item"
                    >
                      <X size={14} />
                    </button>
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
              <button className="btn-primary" onClick={handleSaveBox}>
                {editingBox ? 'Save changes' : 'Add Box'}
              </button>
              <button className="btn-secondary" onClick={() => setIsModalOpen(false)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Print View (visible only during print) */}
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
    </>
  );
};

export default App;
