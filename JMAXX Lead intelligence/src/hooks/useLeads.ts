import { useState, useEffect, useCallback } from 'react';
import { Lead, LeadStatus } from '../types';
import { getLeads, getLeadById, createLead, updateLead, deleteLead, getLeadStats } from '../services/leads';

export function useLeads(filters?: {
  status?: LeadStatus;
  source?: string;
  priority?: string;
  search?: string;
}) {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [count, setCount] = useState(0);

  const fetchLeads = useCallback(async () => {
    setLoading(true);
    setError(null);
    const result = await getLeads(filters);
    if (result.error) {
      setError(result.error);
    } else {
      setLeads(result.data || []);
      setCount(result.count || 0);
    }
    setLoading(false);
  }, [filters?.status, filters?.source, filters?.priority, filters?.search]);

  useEffect(() => {
    fetchLeads();
  }, [fetchLeads]);

  return { leads, loading, error, count, refetch: fetchLeads };
}

export function useLead(id: string) {
  const [lead, setLead] = useState<Lead | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchLead() {
      setLoading(true);
      const result = await getLeadById(id);
      if (result.error) {
        setError(result.error);
      } else {
        setLead(result.data);
      }
      setLoading(false);
    }
    if (id) fetchLead();
  }, [id]);

  const update = async (updates: Partial<Lead>) => {
    const result = await updateLead(id, updates);
    if (result.error) {
      setError(result.error);
      return false;
    }
    setLead(result.data);
    return true;
  };

  return { lead, loading, error, update };
}

export function useLeadMutations() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const create = async (lead: Partial<Lead>) => {
    setLoading(true);
    setError(null);
    const result = await createLead(lead);
    setLoading(false);
    if (result.error) {
      setError(result.error);
      return null;
    }
    return result.data;
  };

  const update = async (id: string, updates: Partial<Lead>) => {
    setLoading(true);
    setError(null);
    const result = await updateLead(id, updates);
    setLoading(false);
    if (result.error) {
      setError(result.error);
      return null;
    }
    return result.data;
  };

  const remove = async (id: string) => {
    setLoading(true);
    setError(null);
    const result = await deleteLead(id);
    setLoading(false);
    if (result.error) {
      setError(result.error);
      return false;
    }
    return true;
  };

  return { create, update, remove, loading, error };
}

export function useLeadStats() {
  const [stats, setStats] = useState<{
    new: number;
    contacted: number;
    quoted: number;
    won: number;
    lost: number;
    total: number;
    hot: number;
    high: number;
    medium: number;
    low: number;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = useCallback(async () => {
    setLoading(true);
    const result = await getLeadStats();
    if (result.error) {
      setError(result.error);
    } else {
      setStats(result.data);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  return { stats, loading, error, refetch: fetchStats };
}
