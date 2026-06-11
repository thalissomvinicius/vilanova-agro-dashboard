import React, { useState } from 'react';
import {
  Type,
  Hash,
  Calendar,
  Clock,
  ChevronDown,
  CheckSquare,
  Camera,
  PenTool,
  MapPin,
  FileUp,
  FileText,
  Plus,
  Trash2,
  Settings,
  Phone,
  Save,
  Check,
  Tractor,
} from 'lucide-react';

export default function FormBuilder() {
  const [formFields, setFormFields] = useState([
    { id: '1', type: 'text', label: 'Nome do Produtor / Proprietário', placeholder: 'Insira o nome completo...', required: true },
    { id: '2', type: 'number', label: 'Umidade do Cacho (%)', placeholder: 'Ex: 14.5', required: true },
    { id: '3', type: 'checklist', label: 'Itens de Segurança Verificados', options: ['Bota de borracha', 'Óculos de proteção', 'Luvas de raspa'], required: true },
    { id: '4', type: 'gps', label: 'Ponto de Coleta Georreferenciado', placeholder: 'GPS Automático', required: true }
  ]);
  
  const [selectedField, setSelectedField] = useState(null);
  const [formName, setFormName] = useState('Inspeção Geral de Dendê');
  const [isSaved, setIsSaved] = useState(false);

  const toolBoxItems = [
    { type: 'text', label: 'Campo de Texto', icon: Type },
    { type: 'number', label: 'Campo Numérico', icon: Hash },
    { type: 'date', label: 'Data', icon: Calendar },
    { type: 'time', label: 'Hora', icon: Clock },
    { type: 'select', label: 'Caixa de Seleção', icon: ChevronDown },
    { type: 'checklist', label: 'Checklist / Caixa', icon: CheckSquare },
    { type: 'photo', label: 'Captura de Foto', icon: Camera },
    { type: 'signature', label: 'Assinatura Digital', icon: PenTool },
    { type: 'gps', label: 'Coordenadas GPS', icon: MapPin },
    { type: 'file', label: 'Upload de Arquivo', icon: FileUp },
    { type: 'observation', label: 'Observação Longa', icon: FileText }
  ];

  const handleAddField = (type) => {
    const defaultLabels = {
      text: 'Novo Campo de Texto',
      number: 'Novo Campo Numérico',
      date: 'Data do Registro',
      time: 'Hora do Registro',
      select: 'Selecione uma Opção',
      checklist: 'Opções da Checklist',
      photo: 'Registrar Foto de Evidência',
      signature: 'Assinatura do Responsável',
      gps: 'Coordenadas GPS do Local',
      file: 'Anexar Laudo Técnico',
      observation: 'Observações de Campo'
    };

    const newField = {
      id: Math.random().toString(36).substr(2, 9),
      type,
      label: defaultLabels[type] || 'Novo Campo',
      placeholder: 'Digite aqui...',
      required: false,
      options: type === 'select' || type === 'checklist' ? ['Opção 1', 'Opção 2', 'Opção 3'] : undefined
    };

    setFormFields([...formFields, newField]);
    setSelectedField(newField);
    setIsSaved(false);
  };

  const handleDeleteField = (id, e) => {
    e.stopPropagation();
    const filtered = formFields.filter(f => f.id !== id);
    setFormFields(filtered);
    if (selectedField && selectedField.id === id) {
      setSelectedField(null);
    }
    setIsSaved(false);
  };

  const handleUpdateFieldProperty = (fieldId, property, val) => {
    const updated = formFields.map(f => {
      if (f.id === fieldId) {
        const u = { ...f, [property]: val };
        if (selectedField && selectedField.id === fieldId) {
          setSelectedField(u);
        }
        return u;
      }
      return f;
    });
    setFormFields(updated);
    setIsSaved(false);
  };

  const handleSaveForm = () => {
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 3000);
  };

  return (
    <div className="fade-in page-shell">
      {/* Title section */}
      <div className="page-header">
        <div className="page-title-block">
          <span className="page-eyebrow">Modelos digitais</span>
          <h2>
            Gestão de Formulários & Checklist
          </h2>
          <p>
            Crie e gerencie relatórios de inspeção digital e coletas de campo sem programar.
          </p>
        </div>
        <div className="page-actions">
          <button onClick={handleSaveForm} className="btn btn-primary">
            {isSaved ? <Check size={18} /> : <Save size={18} />}
            <span>{isSaved ? 'Modelo Salvo!' : 'Salvar Modelo'}</span>
          </button>
        </div>
      </div>

      {/* Main Builder Split Layout */}
      <div className="builder-container">
        
        {/* Left Side: Toolbox Panels */}
        <div className="builder-panel">
          <div className="panel-header">
            <span>Caixa de Componentes</span>
          </div>
          <div className="panel-body toolbox-list">
            {toolBoxItems.map(item => {
              const Icon = item.icon;
              return (
                <button
                  key={item.type}
                  onClick={() => handleAddField(item.type)}
                  className="toolbox-item"
                  style={{ width: '100%', borderStyle: 'dashed', textAlign: 'left' }}
                >
                  <Icon size={16} style={{ color: 'var(--green-institutional)' }} />
                  <span>{item.label}</span>
                  <Plus size={14} style={{ marginLeft: 'auto', opacity: 0.5 }} />
                </button>
              );
            })}
          </div>
        </div>

        {/* Center Panel: Interactive Canvas Area */}
        <div className="builder-panel" style={{ flex: 1 }}>
          <div className="panel-header" style={{ padding: '10px 20px' }}>
            <input
              type="text"
              className="form-input"
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              style={{ fontWeight: 'bold', fontSize: '1.05rem', width: '70%', height: '36px', border: 'none', paddingLeft: '0', backgroundColor: 'transparent' }}
            />
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              {formFields.length} campos criados
            </span>
          </div>

          <div className="panel-body" style={{ padding: '20px', backgroundColor: 'var(--bg-primary)' }}>
            <div className="canvas-area">
              {formFields.length === 0 ? (
                <div className="canvas-empty">
                  <Settings size={48} className="spin" style={{ color: 'var(--border-color)', animationDuration: '3s' }} />
                  <h4>Seu formulário está vazio</h4>
                  <p style={{ fontSize: '0.8rem', maxWidth: '300px', marginTop: '6px' }}>
                    Clique nos componentes do painel esquerdo para adicionar campos ao seu formulário operacional.
                  </p>
                </div>
              ) : (
                formFields.map((field, idx) => {
                  const isSelected = selectedField && selectedField.id === field.id;
                  return (
                    <div
                      key={field.id}
                      onClick={() => setSelectedField(field)}
                      className={`canvas-field ${isSelected ? 'selected' : ''}`}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                        <span style={{ fontSize: '0.7rem', fontWeight: '800', background: 'var(--bg-primary)', padding: '2px 6px', borderRadius: '4px' }}>
                          #{idx + 1}
                        </span>
                        <span style={{ fontSize: '0.75rem', textTransform: 'uppercase', fontWeight: '700', color: 'var(--green-institutional)' }}>
                          {field.type}
                        </span>
                        {field.required && (
                          <span style={{ color: 'var(--status-danger)', fontSize: '0.75rem', fontWeight: 'bold' }}>* Obrigatório</span>
                        )}
                        
                        <div className="field-actions">
                          <button
                            onClick={(e) => handleDeleteField(field.id, e)}
                            className="field-action-btn field-action-delete"
                            title="Remover Campo"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </div>

                      <div className="form-group" style={{ margin: '0' }}>
                        <label className="form-label" style={{ fontSize: '0.85rem' }}>{field.label}</label>
                        {field.type === 'text' && <input type="text" className="form-input" placeholder={field.placeholder} disabled />}
                        {field.type === 'number' && <input type="number" className="form-input" placeholder={field.placeholder} disabled />}
                        {field.type === 'date' && <input type="date" className="form-input" disabled />}
                        {field.type === 'time' && <input type="time" className="form-input" disabled />}
                        {field.type === 'select' && (
                          <select className="form-input" disabled style={{ paddingRight: '30px' }}>
                            <option>{field.placeholder || 'Selecione...'}</option>
                          </select>
                        )}
                        {field.type === 'checklist' && (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', padding: '6px 0' }}>
                            {(field.options || []).map((o, i) => (
                              <label key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                                <input type="checkbox" disabled />
                                <span>{o}</span>
                              </label>
                            ))}
                          </div>
                        )}
                        {field.type === 'photo' && (
                          <div style={{ height: '60px', border: '1px dashed var(--border-color)', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: '0.75rem', gap: '8px', backgroundColor: 'var(--bg-primary)' }}>
                            <Camera size={16} /> Capturar Foto (Camera Integrada)
                          </div>
                        )}
                        {field.type === 'signature' && (
                          <div style={{ height: '60px', border: '1px dashed var(--border-color)', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: '0.75rem', gap: '8px', backgroundColor: 'var(--bg-primary)' }}>
                            <PenTool size={16} /> Desenhar Assinatura na Tela
                          </div>
                        )}
                        {field.type === 'gps' && (
                          <div style={{ height: '36px', borderRadius: '6px', display: 'flex', alignItems: 'center', padding: '0 12px', color: 'var(--green-institutional)', fontSize: '0.75rem', gap: '8px', backgroundColor: 'var(--status-success-bg)', fontWeight: 'bold' }}>
                            <MapPin size={16} /> GPS Coletor Ativo (Georeferenciamento obrigatório)
                          </div>
                        )}
                        {field.type === 'file' && <input type="file" className="form-input" disabled style={{ padding: '8px 12px', fontSize: '0.75rem' }} />}
                        {field.type === 'observation' && <textarea className="form-input" style={{ height: '60px', resize: 'none' }} placeholder={field.placeholder} disabled />}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Right Panel: Settings (Selected Field) or Live Phone Mockup */}
        <div className="builder-panel builder-properties">
          <div className="panel-header">
            <span>Propriedades & Preview</span>
          </div>
          
          <div className="panel-body" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {selectedField ? (
              <div className="card" style={{ padding: '16px', borderStyle: 'solid' }}>
                <h4 style={{ fontSize: '0.85rem', fontWeight: '700', marginBottom: '14px', borderBottom: '1px solid var(--border-color)', paddingBottom: '6px' }}>
                  Configurações do Campo
                </h4>
                
                <div className="form-group">
                  <label className="form-label">Título da Pergunta / Label</label>
                  <input
                    type="text"
                    className="form-input"
                    value={selectedField.label}
                    onChange={(e) => handleUpdateFieldProperty(selectedField.id, 'label', e.target.value)}
                  />
                </div>

                {['text', 'number', 'observation', 'select'].includes(selectedField.type) && (
                  <div className="form-group">
                    <label className="form-label">Placeholder / Dica de Preenchimento</label>
                    <input
                      type="text"
                      className="form-input"
                      value={selectedField.placeholder || ''}
                      onChange={(e) => handleUpdateFieldProperty(selectedField.id, 'placeholder', e.target.value)}
                    />
                  </div>
                )}

                {['select', 'checklist'].includes(selectedField.type) && (
                  <div className="form-group">
                    <label className="form-label">Opções (Separadas por vírgula)</label>
                    <input
                      type="text"
                      className="form-input"
                      value={(selectedField.options || []).join(', ')}
                      onChange={(e) => {
                        const splitOptions = e.target.value.split(',').map(s => s.trim()).filter(s => s !== '');
                        handleUpdateFieldProperty(selectedField.id, 'options', splitOptions);
                      }}
                    />
                  </div>
                )}

                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '12px' }}>
                  <input
                    type="checkbox"
                    id="chk-req"
                    checked={selectedField.required}
                    onChange={(e) => handleUpdateFieldProperty(selectedField.id, 'required', e.target.checked)}
                  />
                  <label htmlFor="chk-req" style={{ fontSize: '0.8rem', fontWeight: '600', cursor: 'pointer' }}>
                    Campo de Preenchimento Obrigatório
                  </label>
                </div>

                <button
                  onClick={() => setSelectedField(null)}
                  className="btn btn-secondary"
                  style={{ width: '100%', marginTop: '16px', height: '32px', fontSize: '0.75rem' }}
                >
                  Fechar Propriedades
                </button>
              </div>
            ) : (
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'center', color: 'var(--text-secondary)', fontSize: '0.8rem', fontWeight: '600', marginBottom: '14px' }}>
                  <Phone size={14} />
                  <span>Visualização Mobile (Tablet/Celular)</span>
                </div>
                
                {/* Phone Simulator Frame */}
                <div className="phone-mockup">
                  <div className="phone-screen">
                    <div className="phone-header">
                      <Tractor size={16} />
                      <span>{formName || 'Inspeção Vila Nova'}</span>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      {formFields.map((field) => (
                        <div key={field.id} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <span style={{ fontSize: '0.7rem', fontWeight: '700', color: '#475569' }}>
                            {field.label} {field.required && <strong style={{ color: '#EF4444' }}>*</strong>}
                          </span>
                          
                          {field.type === 'text' && <input type="text" style={{ fontSize: '0.75rem', height: '28px', border: '1px solid #CBD5E1', borderRadius: '4px', padding: '0 6px', width: '100%' }} placeholder={field.placeholder} disabled />}
                          {field.type === 'number' && <input type="number" style={{ fontSize: '0.75rem', height: '28px', border: '1px solid #CBD5E1', borderRadius: '4px', padding: '0 6px', width: '100%' }} placeholder={field.placeholder} disabled />}
                          {field.type === 'date' && <input type="date" style={{ fontSize: '0.75rem', height: '28px', border: '1px solid #CBD5E1', borderRadius: '4px', padding: '0 6px', width: '100%' }} disabled />}
                          {field.type === 'time' && <input type="time" style={{ fontSize: '0.75rem', height: '28px', border: '1px solid #CBD5E1', borderRadius: '4px', padding: '0 6px', width: '100%' }} disabled />}
                          {field.type === 'select' && (
                            <select style={{ fontSize: '0.75rem', height: '28px', border: '1px solid #CBD5E1', borderRadius: '4px', width: '100%' }} disabled>
                              <option>{field.placeholder}</option>
                            </select>
                          )}
                          {field.type === 'checklist' && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                              {(field.options || []).map((o, idx) => (
                                <label key={idx} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.65rem', color: '#475569' }}>
                                  <input type="checkbox" disabled />
                                  <span>{o}</span>
                                </label>
                              ))}
                            </div>
                          )}
                          {field.type === 'photo' && (
                            <div style={{ height: '36px', border: '1px dashed var(--border-color)', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.65rem', color: 'var(--text-muted)', gap: '6px', backgroundColor: 'var(--bg-primary)' }}>
                              <Camera size={12} /> Tirar Foto
                            </div>
                          )}
                          {field.type === 'signature' && (
                            <div style={{ height: '36px', border: '1px dashed var(--border-color)', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.65rem', color: 'var(--text-muted)', gap: '6px', backgroundColor: 'var(--bg-primary)' }}>
                              <PenTool size={12} /> Assinar
                            </div>
                          )}
                          {field.type === 'gps' && (
                            <div style={{ height: '28px', borderRadius: '4px', display: 'flex', alignItems: 'center', padding: '0 8px', color: '#0F5132', fontSize: '0.65rem', gap: '6px', backgroundColor: '#D1E7DD', fontWeight: 'bold' }}>
                              <MapPin size={12} /> Captura de GPS Ativa
                            </div>
                          )}
                          {field.type === 'file' && (
                            <div style={{ fontSize: '0.65rem', border: '1px solid var(--border-color)', height: '28px', display: 'flex', alignItems: 'center', padding: '0 6px', borderRadius: '4px', color: 'var(--text-muted)' }}>
                              Anexar Arquivo
                            </div>
                          )}
                          {field.type === 'observation' && (
                            <textarea style={{ fontSize: '0.75rem', height: '36px', border: '1px solid #CBD5E1', borderRadius: '4px', padding: '4px 6px', width: '100%', resize: 'none' }} placeholder={field.placeholder} disabled />
                          )}
                        </div>
                      ))}
                    </div>

                    <button style={{ width: '100%', marginTop: '16px', height: '32px', backgroundColor: 'var(--orange-institutional)', color: 'white', border: 'none', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 'bold', cursor: 'not-allowed' }} disabled>
                      Enviar Relatório (Sync)
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
