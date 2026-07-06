import React, { useState } from 'react';
import { Lead, LeadPriority, LeadStatus, STATUS_LABELS, PRIORITY_LABELS, SWISS_CANTONS } from '../../types';
import { Modal, Button, Input, Select, Textarea } from '../ui';

interface LeadFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (lead: Partial<Lead>) => Promise<void>;
  lead?: Lead | null;
}

const SOURCES = [
  { value: 'manual', label: 'Manual' },
  { value: 'anibis', label: 'Anibis' },
  { value: 'tutti', label: 'Tutti' },
  { value: 'homegate', label: 'Homegate' },
  { value: 'referral', label: 'Referido' },
  { value: 'website', label: 'Web' },
  { value: 'other', label: 'Otro' },
];

const SERVICE_TYPES = [
  { value: 'renovation', label: 'Renovación' },
  { value: 'construction', label: 'Construcción' },
  { value: 'painting', label: 'Pintura' },
  { value: 'plumbing', label: 'Fontanería' },
  { value: 'electrical', label: 'Electricidad' },
  { value: 'cleaning', label: 'Limpieza' },
  { value: 'other', label: 'Otro' },
];

export function LeadForm({ isOpen, onClose, onSubmit, lead }: LeadFormProps) {
  const [formData, setFormData] = useState<Partial<Lead>>({
    title: lead?.title || '',
    description: lead?.description || '',
    source: lead?.source || 'manual',
    priority: lead?.priority || 'medium',
    score: lead?.score || 50,
    status: lead?.status || 'new',
    contact_name: lead?.contact_name || '',
    phone: lead?.phone || '',
    email: lead?.email || '',
    city: lead?.city || '',
    canton: lead?.canton || '',
    service_type: lead?.service_type || '',
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    setLoading(true);
    await onSubmit(formData);
    setLoading(false);
    onClose();
  };

  const update = (field: keyof Lead, value: string | number) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={lead ? 'Editar Lead' : 'Nuevo Lead'}
      size="lg"
    >
      <div className="space-y-4">
        <Input
          label="Título *"
          value={formData.title}
          onChange={(e) => update('title', e.target.value)}
          placeholder="Título del lead"
          required
        />

        <Textarea
          label="Descripción"
          value={formData.description || ''}
          onChange={(e) => update('description', e.target.value)}
          placeholder="Descripción detallada..."
          rows={3}
        />

        <div className="grid grid-cols-2 gap-4">
          <Select
            label="Fuente"
            value={formData.source}
            onChange={(e) => update('source', e.target.value)}
            options={SOURCES}
          />
          <Select
            label="Tipo de servicio"
            value={formData.service_type || ''}
            onChange={(e) => update('service_type', e.target.value)}
            options={[{ value: '', label: 'Seleccionar...' }, ...SERVICE_TYPES]}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Select
            label="Prioridad"
            value={formData.priority}
            onChange={(e) => update('priority', e.target.value)}
            options={Object.entries(PRIORITY_LABELS).map(([value, label]) => ({ value, label }))}
          />
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Score</label>
            <input
              type="number"
              min="0"
              max="100"
              value={formData.score}
              onChange={(e) => update('score', parseInt(e.target.value) || 0)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Input
            label="Ciudad"
            value={formData.city || ''}
            onChange={(e) => update('city', e.target.value)}
            placeholder="Ciudad"
          />
          <Select
            label="Cantón"
            value={formData.canton || ''}
            onChange={(e) => update('canton', e.target.value)}
            options={[{ value: '', label: 'Seleccionar...' }, ...SWISS_CANTONS.map((c) => ({ value: c, label: c }))]}
          />
        </div>

        <div className="border-t border-gray-200 pt-4 mt-4">
          <h3 className="text-sm font-semibold text-gray-900 mb-3">Información de contacto</h3>
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Nombre"
              value={formData.contact_name || ''}
              onChange={(e) => update('contact_name', e.target.value)}
              placeholder="Nombre del contacto"
            />
            <Input
              label="Teléfono"
              value={formData.phone || ''}
              onChange={(e) => update('phone', e.target.value)}
              placeholder="+41 XX XXX XX XX"
            />
          </div>
          <div className="mt-4">
            <Input
              label="Email"
              type="email"
              value={formData.email || ''}
              onChange={(e) => update('email', e.target.value)}
              placeholder="email@ejemplo.com"
            />
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 mt-4">
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} loading={loading}>
            {lead ? 'Guardar cambios' : 'Crear Lead'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
