import React, { useState } from 'react';
import { Lead, Activity, STATUS_LABELS, STATUS_COLORS, PRIORITY_LABELS, SWISS_CANTONS, CLASSIFICATION_LABELS, CLASSIFICATION_COLORS, LeadClassification, STATUS_DESCRIPTIONS } from '../../types';
import { Card, Badge, Button, Select, Textarea, Modal, Input } from '../ui';
import { getScoreColor, formatDate, formatRelativeDate, cn } from '../../utils';
import {
  MapPin,
  Phone,
  Mail,
  MessageCircle,
  FileText,
  Calendar,
  Clock,
  User,
  Edit3,
  Plus,
  ArrowLeft,
  ExternalLink,
  Star,
  AlertCircle,
  Send,
  Flame,
  RefreshCw,
  Copy,
  Check,
  TrendingUp,
  DollarSign,
  RotateCcw,
  XCircle,
  CheckCircle,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { addNote, getActivities, markLeadAsHot, recalculateLeadScore } from '../../services/leads';
import { generateWhatsAppMessage, generateEmailTemplate, generateQuoteData, sendWhatsAppMessage, sendEmail } from '../../services/actionLayer';
import { closeLeadAsWon, closeLeadAsLost, updateLeadRevenue, reopenLead } from '../../services/revenue';
import { useLeadMutations } from '../../hooks/useLeads';

interface LeadDetailProps {
  lead: Lead;
  activities: Activity[];
  onRefresh: () => void;
}

export function LeadDetail({ lead, activities, onRefresh }: LeadDetailProps) {
  const navigate = useNavigate();
  const [newNote, setNewNote] = useState('');
  const [addingNote, setAddingNote] = useState(false);
  const [showWhatsAppModal, setShowWhatsAppModal] = useState(false);
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [showQuoteModal, setShowQuoteModal] = useState(false);
  const [showCloseModal, setShowCloseModal] = useState(false);
  const [closingType, setClosingType] = useState<'won' | 'lost'>('won');
  const [closingRevenue, setClosingRevenue] = useState('');
  const [closingReason, setClosingReason] = useState('');
  const [copied, setCopied] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [editRevenue, setEditRevenue] = useState(false);
  const [revenueValue, setRevenueValue] = useState(lead.revenue?.toString() || '');
  const { update, loading } = useLeadMutations();

  const classification = lead.classification as LeadClassification | null;

  const handleAddNote = async () => {
    if (!newNote.trim()) return;
    setAddingNote(true);
    await addNote(lead.id, newNote.trim());
    setNewNote('');
    setAddingNote(false);
    onRefresh();
  };

  const handleStatusChange = async (newStatus: string) => {
    await update(lead.id, { status: newStatus as Lead['status'] });
    onRefresh();
  };

  const handlePriorityChange = async (newPriority: string) => {
    await update(lead.id, { priority: newPriority as Lead['priority'] });
    onRefresh();
  };

  const handleScoreChange = async (newScore: number) => {
    await update(lead.id, { score: newScore });
    onRefresh();
  };

  const handleMarkAsHot = async () => {
    await markLeadAsHot(lead.id);
    onRefresh();
  };

  const handleRecalculateScore = async () => {
    await recalculateLeadScore(lead.id);
    onRefresh();
  };

  const handleWhatsApp = async () => {
    await sendWhatsAppMessage(lead);
    setShowWhatsAppModal(true);
  };

  const handleEmail = async () => {
    await sendEmail(lead);
    setShowEmailModal(true);
  };

  const handleCreateQuote = () => {
    setShowQuoteModal(true);
  };

  const handleCloseLead = (type: 'won' | 'lost') => {
    setClosingType(type);
    setShowCloseModal(true);
  };

  const handleSubmitClose = async () => {
    setSubmitting(true);
    try {
      if (closingType === 'won') {
        const revenue = parseFloat(closingRevenue) || 0;
        if (revenue <= 0) {
          alert('Por favor ingresa un monto de revenue válido');
          setSubmitting(false);
          return;
        }
        await closeLeadAsWon(lead.id, revenue);
      } else {
        await closeLeadAsLost(lead.id, closingReason);
      }
      setShowCloseModal(false);
      onRefresh();
    } catch (error) {
      console.error('Error closing lead:', error);
    }
    setSubmitting(false);
  };

  const handleReopenLead = async () => {
    await reopenLead(lead.id, 'contacted');
    onRefresh();
  };

  const handleSaveRevenue = async () => {
    const revenue = parseFloat(revenueValue) || null;
    await updateLeadRevenue(lead.id, revenue);
    setEditRevenue(false);
    onRefresh();
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const isClosed = lead.status === 'won' || lead.status === 'lost';

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <button
          onClick={() => navigate('/leads')}
          className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 mb-4"
        >
          <ArrowLeft className="w-4 h-4" />
          Volver a leads
        </button>

        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-2xl font-bold text-gray-900">{lead.title}</h1>
              {lead.external_url && (
                <a
                  href={lead.external_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:text-blue-700"
                >
                  <ExternalLink className="w-5 h-5" />
                </a>
              )}
              {classification === 'hot' && (
                <span className="flex items-center gap-1 px-3 py-1 bg-red-500 text-white rounded-full text-sm font-bold animate-pulse">
                  <Flame className="w-4 h-4" />
                  HOT
                </span>
              )}
              {isClosed && (
                <Badge variant={lead.status === 'won' ? 'success' : 'danger'} size="md">
                  {lead.status === 'won' ? 'Ganado' : 'Perdido'}
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-4 text-sm text-gray-500">
              <span className="flex items-center gap-1">
                <Clock className="w-4 h-4" />
                Creado {formatRelativeDate(lead.created_at)}
              </span>
              <span className="flex items-center gap-1">
                <Calendar className="w-4 h-4" />
                Actualizado {formatRelativeDate(lead.updated_at)}
              </span>
              {lead.time_to_close_days && (
                <span className="flex items-center gap-1">
                  <TrendingUp className="w-4 h-4" />
                  Tiempo cierre: {lead.time_to_close_days} días
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className={cn(
              'px-4 py-2 rounded-lg text-white font-medium text-sm',
              STATUS_COLORS[lead.status]
            )}>
              {STATUS_LABELS[lead.status]}
            </div>
            <div className={cn(
              'text-center py-2 px-4 rounded-lg font-bold',
              getScoreColor(lead.score)
            )}>
              <p className="text-xs opacity-60">SCORE</p>
              <p className="text-2xl">{lead.score}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Revenue Banner for Won Leads */}
      {lead.status === 'won' && lead.revenue && (
        <Card className="mb-6 bg-green-50 border-green-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <DollarSign className="w-8 h-8 text-green-600" />
              <div>
                <p className="text-sm text-green-600">Revenue Generado</p>
                <p className="text-3xl font-bold text-green-700">
                  CHF {lead.revenue.toLocaleString()}
                </p>
              </div>
            </div>
            <Button variant="ghost" size="sm" onClick={() => setEditRevenue(true)}>
              Editar
            </Button>
          </div>
        </Card>
      )}

      <div className="grid grid-cols-12 gap-6">
        <div className="col-span-8 space-y-6">
          <Card padding="lg">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Descripción</h2>
            <p className="text-gray-700 whitespace-pre-wrap">{lead.description || 'Sin descripción'}</p>

            {lead.score_breakdown && (
              <div className="mt-6 pt-6 border-t border-gray-200">
                <h3 className="text-sm font-semibold text-gray-900 mb-3">Desglose del Score</h3>
                <div className="grid grid-cols-5 gap-4">
                  <ScoreBarItem label="Base" value={lead.score_breakdown.base} color="bg-gray-200" />
                  <ScoreBarItem label="Urgencia" value={lead.score_breakdown.urgency} color="bg-red-400" />
                  <ScoreBarItem label="Intención" value={lead.score_breakdown.intent} color="bg-blue-400" />
                  <ScoreBarItem label="Servicio" value={lead.score_breakdown.service} color="bg-green-400" />
                  <ScoreBarItem label="Ubicación" value={lead.score_breakdown.geographic} color="bg-yellow-400" />
                </div>
              </div>
            )}
          </Card>

          <Card padding="lg">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Timeline de Actividad</h2>
            <div className="space-y-4">
              {activities.length === 0 ? (
                <p className="text-gray-500 text-center py-8">No hay actividad registrada</p>
              ) : (
                activities.map((activity) => (
                  <div key={activity.id} className="flex gap-3">
                    <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0">
                      <ActivityIcon type={activity.type} />
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-gray-900">{activity.title}</p>
                      {activity.description && (
                        <p className="text-sm text-gray-600 mt-0.5">{activity.description}</p>
                      )}
                      <p className="text-xs text-gray-400 mt-1">{formatDate(activity.created_at)}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </Card>

          {!isClosed && (
            <Card padding="lg">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Notas Internas</h2>
              <Textarea
                value={newNote}
                onChange={(e) => setNewNote(e.target.value)}
                placeholder="Añadir una nota..."
                rows={3}
              />
              <div className="flex justify-end mt-3">
                <Button onClick={handleAddNote} loading={addingNote} icon={<Plus className="w-4 h-4" />}>
                  Añadir Nota
                </Button>
              </div>
            </Card>
          )}
        </div>

        <div className="col-span-4 space-y-6">
          <Card padding="lg" className={cn(classification === 'hot' ? 'ring-2 ring-red-500' : '')}>
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Acciones</h2>

            {!isClosed ? (
              <div className="space-y-2">
                <Button variant="secondary" className="w-full justify-start" icon={<MessageCircle className="w-4 h-4" />} onClick={handleWhatsApp}>
                  WhatsApp
                </Button>
                <Button variant="secondary" className="w-full justify-start" icon={<Mail className="w-4 h-4" />} onClick={handleEmail}>
                  Enviar Email
                </Button>
                <Button variant="secondary" className="w-full justify-start" icon={<Phone className="w-4 h-4" />}>
                  Llamar
                </Button>
                <Button variant="secondary" className="w-full justify-start" icon={<FileText className="w-4 h-4" />} onClick={handleCreateQuote}>
                  Crear Presupuesto
                </Button>
                <div className="border-t border-gray-200 my-2 pt-2">
                  <Button variant="success" className="w-full justify-start bg-green-600 hover:bg-green-700" icon={<CheckCircle className="w-4 h-4" />} onClick={() => handleCloseLead('won')}>
                    Marcar como Ganado
                  </Button>
                  <Button variant="danger" className="w-full justify-start mt-2" icon={<XCircle className="w-4 h-4" />} onClick={() => handleCloseLead('lost')}>
                    Marcar como Perdido
                  </Button>
                </div>
                <div className="border-t border-gray-200 my-2 pt-2">
                  {classification !== 'hot' && (
                    <Button variant="ghost" className="w-full justify-start text-red-600" icon={<Flame className="w-4 h-4" />} onClick={handleMarkAsHot}>
                      Marcar como HOT
                    </Button>
                  )}
                  <Button variant="ghost" className="w-full justify-start" icon={<RefreshCw className="w-4 h-4" />} onClick={handleRecalculateScore}>
                    Recalcular Score
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <Button variant="secondary" className="w-full justify-start" icon={<RotateCcw className="w-4 h-4" />} onClick={handleReopenLead}>
                  Reabrir Lead
                </Button>
                {lead.status === 'won' && !lead.revenue && (
                  <Button variant="secondary" className="w-full justify-start" icon={<DollarSign className="w-4 h-4" />} onClick={() => setEditRevenue(true)}>
                    Agregar Revenue
                  </Button>
                )}
              </div>
            )}
          </Card>

          {classification && (
            <Card padding="md" className={cn('border-2', CLASSIFICATION_COLORS[classification])}>
              <div className="flex items-center justify-between">
                <span className="font-semibold">Clasificación</span>
                <span className={cn('text-lg font-bold', classification === 'hot' ? '' : classification === 'high' ? 'text-orange-600' : classification === 'medium' ? 'text-blue-600' : 'text-gray-600')}>
                  {CLASSIFICATION_LABELS[classification]}
                </span>
              </div>
              {lead.urgency_detected && (
                <div className="mt-2 flex items-center gap-1 text-xs text-red-600">
                  <AlertCircle className="w-3 h-3" />
                  Urgencia detectada
                </div>
              )}
            </Card>
          )}

          <Card padding="lg">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Información de Contacto</h2>
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center">
                  <User className="w-5 h-5 text-gray-500" />
                </div>
                <div>
                  <p className="font-medium text-gray-900">{lead.contact_name || 'Sin nombre'}</p>
                  <p className="text-sm text-gray-500">Contacto</p>
                </div>
              </div>
              {lead.phone && (
                <div className="flex items-center gap-3 text-sm">
                  <Phone className="w-4 h-4 text-gray-400" />
                  <a href={`tel:${lead.phone}`} className="text-gray-700 hover:text-blue-600">{lead.phone}</a>
                </div>
              )}
              {lead.email && (
                <div className="flex items-center gap-3 text-sm">
                  <Mail className="w-4 h-4 text-gray-400" />
                  <a href={`mailto:${lead.email}`} className="text-gray-700 hover:text-blue-600">{lead.email}</a>
                </div>
              )}
              {(lead.city || lead.canton) && (
                <div className="flex items-center gap-3 text-sm">
                  <MapPin className="w-4 h-4 text-gray-400" />
                  <span className="text-gray-700">{[lead.city, lead.canton].filter(Boolean).join(', ')}</span>
                </div>
              )}
            </div>
          </Card>

          {!isClosed && (
            <Card padding="lg">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Estado y Prioridad</h2>
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1 block">Estado</label>
                  <Select
                    value={lead.status}
                    onChange={(e) => handleStatusChange(e.target.value)}
                    options={Object.entries(STATUS_LABELS).map(([value, label]) => ({ value, label }))}
                  />
                  <p className="text-xs text-gray-500 mt-1">{STATUS_DESCRIPTIONS[lead.status]}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1 block">Prioridad</label>
                  <Select
                    value={lead.priority}
                    onChange={(e) => handlePriorityChange(e.target.value)}
                    options={Object.entries(PRIORITY_LABELS).map(([value, label]) => ({ value, label }))}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1 block">Score (Manual)</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={lead.score}
                      onChange={(e) => handleScoreChange(parseInt(e.target.value))}
                      className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                    />
                    <span className={cn('text-sm font-bold', getScoreColor(lead.score))}>
                      {lead.score}
                    </span>
                  </div>
                </div>
              </div>
            </Card>
          )}

          <Card padding="lg">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Detalles</h2>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">Fuente</span>
                <Badge variant="default">{lead.source}</Badge>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Tipo de servicio</span>
                <span className="text-gray-900">{lead.service_type || '-'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">ID externo</span>
                <span className="text-gray-900 text-xs font-mono">{lead.external_id || '-'}</span>
              </div>
              {lead.last_scored_at && (
                <div className="flex justify-between">
                  <span className="text-gray-500">Último cálculo</span>
                  <span className="text-gray-900 text-xs">{formatRelativeDate(lead.last_scored_at)}</span>
                </div>
              )}
              {lead.closed_at && (
                <div className="flex justify-between">
                  <span className="text-gray-500">Cerrado</span>
                  <span className="text-gray-900 text-xs">{formatDate(lead.closed_at)}</span>
                </div>
              )}
            </div>
          </Card>
        </div>
      </div>

      {/* WhatsApp Modal */}
      <Modal isOpen={showWhatsAppModal} onClose={() => setShowWhatsAppModal(false)} title="WhatsApp" size="md">
        <WhatsAppPreview lead={lead} onCopy={handleCopy} copied={copied} />
      </Modal>

      {/* Email Modal */}
      <Modal isOpen={showEmailModal} onClose={() => setShowEmailModal(false)} title="Plantilla de Email" size="lg">
        <EmailPreview lead={lead} />
      </Modal>

      {/* Quote Modal */}
      <Modal isOpen={showQuoteModal} onClose={() => setShowQuoteModal(false)} title="Crear Presupuesto" size="lg">
        <QuotePreview lead={lead} />
      </Modal>

      {/* Close Lead Modal */}
      <Modal isOpen={showCloseModal} onClose={() => setShowCloseModal(false)} title={closingType === 'won' ? 'Marcar como Ganado' : 'Marcar como Perdido'} size="md">
        <div className="space-y-4">
          <div className={cn(
            'p-4 rounded-lg',
            closingType === 'won' ? 'bg-green-50' : 'bg-red-50'
          )}>
            <p className={closingType === 'won' ? 'text-green-700' : 'text-red-700'}>
              {closingType === 'won'
                ? 'Este lead se marcará como ganado. Ingresa el monto de revenue generado.'
                : 'Este lead se marcará como perdido. Opcionalmente indica la razón.'}
            </p>
          </div>

          {closingType === 'won' && (
            <Input
              label="Revenue (CHF) *"
              type="number"
              value={closingRevenue}
              onChange={(e) => setClosingRevenue(e.target.value)}
              placeholder="Ej: 15000"
            />
          )}

          {closingType === 'lost' && (
            <Textarea
              label="Razón (opcional)"
              value={closingReason}
              onChange={(e) => setClosingReason(e.target.value)}
              placeholder="Motivo por el cual se perdió el lead..."
              rows={3}
            />
          )}

          <div className="flex justify-end gap-2 pt-4">
            <Button variant="ghost" onClick={() => setShowCloseModal(false)}>Cancelar</Button>
            <Button
              variant={closingType === 'won' ? 'primary' : 'danger'}
              onClick={handleSubmitClose}
              loading={submitting}
            >
              {closingType === 'won' ? 'Confirmar Ganado' : 'Confirmar Perdido'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Edit Revenue Modal */}
      <Modal isOpen={editRevenue} onClose={() => setEditRevenue(false)} title="Editar Revenue" size="sm">
        <div className="space-y-4">
          <Input
            label="Revenue (CHF)"
            type="number"
            value={revenueValue}
            onChange={(e) => setRevenueValue(e.target.value)}
            placeholder="Ej: 15000"
          />
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setEditRevenue(false)}>Cancelar</Button>
            <Button onClick={handleSaveRevenue}>Guardar</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

function ScoreBarItem({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="text-center">
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
        <div className={cn('h-full rounded-full', color)} style={{ width: `${Math.min(100, value * 2)}%` }} />
      </div>
      <p className="text-xs font-semibold mt-1">+{value}</p>
    </div>
  );
}

function WhatsAppPreview({ lead, onCopy, copied }: { lead: Lead; onCopy: (text: string) => void; copied: boolean }) {
  const waMessage = generateWhatsAppMessage(lead);

  return (
    <div className="space-y-4">
      <div className="bg-gray-50 rounded-lg p-4">
        <p className="text-xs text-gray-500 mb-2">Mensaje:</p>
        <p className="text-sm whitespace-pre-wrap">{waMessage.message}</p>
      </div>
      <div className="flex gap-2">
        <Button variant="secondary" onClick={() => onCopy(waMessage.message)} icon={copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}>
          {copied ? 'Copiado' : 'Copiar'}
        </Button>
        <Button onClick={() => window.open(waMessage.link, '_blank')}>
          Abrir WhatsApp
        </Button>
      </div>
    </div>
  );
}

function EmailPreview({ lead }: { lead: Lead }) {
  const emailTemplate = generateEmailTemplate(lead);

  return (
    <div className="space-y-4">
      <div>
        <p className="text-xs text-gray-500 mb-1">Para:</p>
        <p className="text-sm font-medium">{emailTemplate.to || 'Sin email'}</p>
      </div>
      <div>
        <p className="text-xs text-gray-500 mb-1">Asunto:</p>
        <p className="text-sm font-medium">{emailTemplate.subject}</p>
      </div>
      <div>
        <p className="text-xs text-gray-500 mb-1">Cuerpo:</p>
        <pre className="text-sm whitespace-pre-wrap bg-gray-50 p-4 rounded-lg overflow-auto max-h-64">
          {emailTemplate.body}
        </pre>
      </div>
    </div>
  );
}

function QuotePreview({ lead }: { lead: Lead }) {
  const quoteData = generateQuoteData(lead);

  return (
    <div className="space-y-4">
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-sm text-yellow-800">
        Esta funcionalidad estará integrada con JMAXX OS en el futuro.
      </div>
      <div>
        <p className="text-xs text-gray-500 mb-2">Datos del presupuesto:</p>
        <div className="bg-gray-50 rounded-lg p-4 space-y-2 text-sm">
          <p><strong>Cliente:</strong> {quoteData.clientName}</p>
          <p><strong>Servicio:</strong> {quoteData.serviceType}</p>
        </div>
      </div>
    </div>
  );
}

function ActivityIcon({ type }: { type: string }) {
  const icons: Record<string, React.ReactNode> = {
    created: <Star className="w-4 h-4 text-blue-500" />,
    lead_created: <Star className="w-4 h-4 text-blue-500" />,
    status_changed: <TrendingUp className="w-4 h-4 text-purple-500" />,
    note_added: <Edit3 className="w-4 h-4 text-orange-500" />,
    called: <Phone className="w-4 h-4 text-green-500" />,
    emailed: <Mail className="w-4 h-4 text-blue-500" />,
    whatsapp_sent: <MessageCircle className="w-4 h-4 text-green-500" />,
    score_calculated: <RefreshCw className="w-4 h-4 text-blue-500" />,
    lead_classified: <Star className="w-4 h-4 text-purple-500" />,
    marked_hot: <Flame className="w-4 h-4 text-red-500" />,
    lead_won: <CheckCircle className="w-4 h-4 text-green-500" />,
    lead_lost: <XCircle className="w-4 h-4 text-red-500" />,
    revenue_updated: <DollarSign className="w-4 h-4 text-green-500" />,
  };

  return icons[type] || <AlertCircle className="w-4 h-4 text-gray-400" />;
}
