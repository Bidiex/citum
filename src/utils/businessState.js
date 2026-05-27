// businessState.js — Manejo de estado persistente de negocios para Citum

const DEFAULT_BUSINESSES = [
  {
    id: '1',
    name: 'Barbería Imperial',
    slug: 'barberia-imperial',
    phone: '3001234567',
    address: 'Calle 72 #10-15, Bogotá',
    color: '#8B5CF6', // Violeta por defecto
    logo: ''
  },
  {
    id: '2',
    name: 'Salón Deluxe',
    slug: 'salon-deluxe',
    phone: '3009876543',
    address: 'Av. 19 #100-80, Bogotá',
    color: '#EC4899', // Rosa por defecto
    logo: ''
  }
];

export function getBusinesses() {
  const cached = localStorage.getItem('citum_businesses');
  if (!cached) {
    localStorage.setItem('citum_businesses', JSON.stringify(DEFAULT_BUSINESSES));
    return DEFAULT_BUSINESSES;
  }
  return JSON.parse(cached);
}

export function saveBusinesses(businesses) {
  localStorage.setItem('citum_businesses', JSON.stringify(businesses));
  // Notificar cambios para que dropdown o secciones se enteren
  window.dispatchEvent(new CustomEvent('citum_businesses_changed', { detail: businesses }));
}

export function getActiveBusinessId() {
  const activeId = localStorage.getItem('citum_active_business_id');
  if (!activeId) {
    const businesses = getBusinesses();
    const firstId = businesses[0] ? businesses[0].id : '';
    localStorage.setItem('citum_active_business_id', firstId);
    return firstId;
  }
  return activeId;
}

export function setActiveBusinessId(id) {
  localStorage.setItem('citum_active_business_id', id);
  window.dispatchEvent(new CustomEvent('citum_active_business_changed', { detail: id }));
}

export function getActiveBusiness() {
  const businesses = getBusinesses();
  const activeId = getActiveBusinessId();
  return businesses.find(b => b.id === activeId) || businesses[0] || null;
}

export function addBusiness(newBiz) {
  const businesses = getBusinesses();
  const bizWithId = {
    ...newBiz,
    id: Date.now().toString()
  };
  businesses.push(bizWithId);
  saveBusinesses(businesses);
  setActiveBusinessId(bizWithId.id); // Hacer activo al crear
  return bizWithId;
}

export function updateBusiness(id, updatedData) {
  const businesses = getBusinesses();
  const index = businesses.findIndex(b => b.id === id);
  if (index !== -1) {
    businesses[index] = {
      ...businesses[index],
      ...updatedData
      // Nota: El slug y el nombre no se modifican si es edición
    };
    saveBusinesses(businesses);
    // Si era el negocio activo, disparar cambio activo para refrescar la UI
    if (getActiveBusinessId() === id) {
      setActiveBusinessId(id);
    }
    return businesses[index];
  }
  return null;
}

// === CLIENT MANAGEMENT ===

export function getClients(businessId) {
  const bizId = businessId || getActiveBusinessId();
  const key = `citum_clients_${bizId}`;
  const cached = localStorage.getItem(key);
  if (!cached) {
    // Seed default clients
    const todayStr = new Intl.DateTimeFormat('fr-CA', {
      timeZone: 'America/Bogota',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).format(new Date());
    
    const seedClients = [
      {
        id: 'c1',
        phone: '3001234567',
        name: 'Carlos Mendoza',
        email: 'carlos.mendoza@email.com',
        lastService: 'Corte Premium',
        lastServiceDate: todayStr,
        totalSpent: 35000,
        totalVisits: 1,
        businessId: bizId
      },
      {
        id: 'c2',
        phone: '3119876543',
        name: 'Diana Turbay',
        email: 'diana.turbay@email.com',
        lastService: 'Perfilado de Cejas',
        lastServiceDate: todayStr,
        totalSpent: 12000,
        totalVisits: 1,
        businessId: bizId
      },
      {
        id: 'c3',
        phone: '3154567890',
        name: 'Andrés López',
        email: 'andres.lopez@email.com',
        lastService: 'Afeitado de Barba',
        lastServiceDate: todayStr,
        totalSpent: 25000,
        totalVisits: 1,
        businessId: bizId
      },
      {
        id: 'c4',
        phone: '3209876543',
        name: 'Mateo Restrepo',
        email: 'mateo.restrepo@email.com',
        lastService: 'Combo Imperial',
        lastServiceDate: todayStr,
        totalSpent: 55000,
        totalVisits: 1,
        businessId: bizId
      }
    ];
    localStorage.setItem(key, JSON.stringify(seedClients));
    return seedClients;
  }
  return JSON.parse(cached);
}

export function saveClients(clients, businessId) {
  const bizId = businessId || getActiveBusinessId();
  const key = `citum_clients_${bizId}`;
  localStorage.setItem(key, JSON.stringify(clients));
  window.dispatchEvent(new CustomEvent('citum_clients_changed', { detail: { clients, businessId: bizId } }));
}

export function findClientByPhone(phone, businessId) {
  const clients = getClients(businessId);
  const cleanPhone = phone.trim();
  return clients.find(c => c.phone === cleanPhone) || null;
}

export function searchClientsByName(query, businessId) {
  const clients = getClients(businessId);
  if (!query) return [];
  const lowerQuery = query.toLowerCase();
  return clients.filter(c => c.name.toLowerCase().includes(lowerQuery) || c.phone.includes(lowerQuery));
}

export function upsertClientFromAppointment(appointment, businessId, isEdit = false, oldAppointment = null) {
  const bizId = businessId || getActiveBusinessId();
  let clients = getClients(bizId);

  const phone = appointment.phone.trim();
  const name = appointment.client.trim();
  const email = (appointment.email || '').trim();
  const service = appointment.service;
  const date = appointment.date;
  const price = appointment.totalPrice || 0;

  if (isEdit && oldAppointment) {
    const oldPhone = oldAppointment.phone.trim();
    const oldPrice = oldAppointment.totalPrice || 0;

    if (oldPhone !== phone) {
      // 1. Descontar del cliente viejo
      const oldIdx = clients.findIndex(c => c.phone === oldPhone);
      if (oldIdx !== -1) {
        clients[oldIdx].totalVisits = Math.max(0, clients[oldIdx].totalVisits - 1);
        clients[oldIdx].totalSpent = Math.max(0, clients[oldIdx].totalSpent - oldPrice);
      }
      // 2. Sumar al cliente nuevo
      const newIdx = clients.findIndex(c => c.phone === phone);
      if (newIdx !== -1) {
        clients[newIdx].name = name;
        if (email) clients[newIdx].email = email;
        clients[newIdx].totalVisits += 1;
        clients[newIdx].totalSpent += price;
        clients[newIdx].lastService = service;
        clients[newIdx].lastServiceDate = date;
      } else {
        clients.push({
          id: crypto.randomUUID(),
          phone,
          name,
          email,
          lastService: service,
          lastServiceDate: date,
          totalSpent: price,
          totalVisits: 1,
          businessId: bizId
        });
      }
    } else {
      // El teléfono es el mismo, solo ajustar los valores
      const idx = clients.findIndex(c => c.phone === phone);
      if (idx !== -1) {
        clients[idx].name = name;
        if (email) clients[idx].email = email;
        clients[idx].totalSpent = Math.max(0, clients[idx].totalSpent - oldPrice + price);
        clients[idx].lastService = service;
        clients[idx].lastServiceDate = date;
      } else {
        clients.push({
          id: crypto.randomUUID(),
          phone,
          name,
          email,
          lastService: service,
          lastServiceDate: date,
          totalSpent: price,
          totalVisits: 1,
          businessId: bizId
        });
      }
    }
  } else {
    // Nueva cita
    const idx = clients.findIndex(c => c.phone === phone);
    if (idx !== -1) {
      clients[idx].name = name;
      if (email) clients[idx].email = email;
      clients[idx].totalVisits += 1;
      clients[idx].totalSpent += price;
      clients[idx].lastService = service;
      clients[idx].lastServiceDate = date;
    } else {
      clients.push({
        id: crypto.randomUUID(),
        phone,
        name,
        email,
        lastService: service,
        lastServiceDate: date,
        totalSpent: price,
        totalVisits: 1,
        businessId: bizId
      });
    }
  }

  saveClients(clients, bizId);
}

export function removeClientAppointmentStats(appointment, businessId) {
  if (!appointment) return;
  const bizId = businessId || getActiveBusinessId();
  const clients = getClients(bizId);
  const phone = appointment.phone ? appointment.phone.trim() : '';
  if (!phone) return;

  const idx = clients.findIndex(c => c.phone === phone);
  if (idx !== -1) {
    const price = appointment.totalPrice || 0;
    clients[idx].totalVisits = Math.max(0, clients[idx].totalVisits - 1);
    clients[idx].totalSpent = Math.max(0, clients[idx].totalSpent - price);
    saveClients(clients, bizId);
  }
}

