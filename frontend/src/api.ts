const API_BASE = '/api/v1';

let authToken: string | null = localStorage.getItem('meditrace_token');

export const setAuthToken = (token: string | null) => {
  authToken = token;
  if (token) {
    localStorage.setItem('meditrace_token', token);
  } else {
    localStorage.removeItem('meditrace_token');
  }
};

const fetchJson = async (endpoint: string, options: RequestInit = {}) => {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {}),
  };

  if (authToken) {
    headers['Authorization'] = `Bearer ${authToken}`;
  }

  const res = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    const message = errorData.detail || errorData.error?.message || `HTTP error ${res.status}`;
    throw new Error(message);
  }

  return res.json();
};

export const api = {
  // Auth
  requestOTP: (phone: string) => fetchJson('/auth/otp/request', {
    method: 'POST',
    body: JSON.stringify({ phone }),
  }),

  verifyOTP: (phone: string, otp: string) => fetchJson('/auth/otp/verify', {
    method: 'POST',
    body: JSON.stringify({ phone, otp }),
  }),

  getMe: () => fetchJson('/auth/me'),

  // Profiles
  listCareProfiles: () => fetchJson('/care-profiles'),

  getSnapshot: (profileId: string) => fetchJson(`/care-profiles/${profileId}/snapshot`),

  getTimeline: (profileId: string) => fetchJson(`/care-profiles/${profileId}/timeline`),

  getObservations: (profileId: string) => fetchJson(`/care-profiles/${profileId}/observations`),

  compareObservations: (profileId: string, testName: string, targetUnit?: string) =>
    fetchJson(`/care-profiles/${profileId}/observations/compare`, {
      method: 'POST',
      body: JSON.stringify({ care_profile_id: profileId, test_name: testName, target_unit: targetUnit }),
    }),

  getReviews: (profileId: string) => fetchJson(`/care-profiles/${profileId}/reviews`),

  confirmFact: (factId: string, status: string, correctedValue?: string) =>
    fetchJson(`/facts/${factId}/confirm`, {
      method: 'POST',
      body: JSON.stringify({ verification_status: status, corrected_value: correctedValue }),
    }),

  // Documents & Upload
  listDocuments: (profileId: string) => fetchJson(`/documents?care_profile_id=${profileId}`),

  uploadFile: async (profileId: string, file: File) => {
    // 1. Presign
    const presign = await fetchJson('/uploads', {
      method: 'POST',
      body: JSON.stringify({
        care_profile_id: profileId,
        filename: file.name,
        mime_type: file.type || 'application/octet-stream',
        size_bytes: file.size,
      }),
    });

    // 2. Direct upload
    const formData = new FormData();
    formData.append('file', file);

    const headers: Record<string, string> = {};
    if (authToken) {
      headers['Authorization'] = `Bearer ${authToken}`;
    }

    const res = await fetch(presign.upload_url, {
      method: 'POST',
      headers,
      body: formData,
    });

    if (!res.ok) throw new Error('File upload failed');
    return res.json();
  },

  // Assistant & Chat
  createConversation: (profileId: string) => fetchJson(`/conversations?care_profile_id=${profileId}`, {
    method: 'POST',
  }),

  getMessages: (conversationId: string) => fetchJson(`/conversations/${conversationId}/messages`),

  sendMessage: (conversationId: string, profileId: string, message: string, language: string = 'en') =>
    fetchJson(`/conversations/${conversationId}/messages`, {
      method: 'POST',
      body: JSON.stringify({
        care_profile_id: profileId,
        message,
        language,
      }),
    }),

  // Pending Actions (Propose -> Confirm)
  listPendingActions: (profileId: string) => fetchJson(`/pending-actions?care_profile_id=${profileId}`),

  confirmPendingAction: (actionId: string) => fetchJson(`/pending-actions/${actionId}/confirm`, {
    method: 'POST',
  }),

  rejectPendingAction: (actionId: string) => fetchJson(`/pending-actions/${actionId}/reject`, {
    method: 'POST',
  }),

  // Voice
  getVoiceToken: (profileId: string, language: string = 'en') =>
    fetchJson(`/voice/token?care_profile_id=${profileId}&language=${language}`, {
      method: 'POST',
    }),

  // Doctor Portal
  listDoctors: () => fetchJson('/doctors'),

  getDoctorPatients: () => fetchJson('/doctor/patients'),

  getDoctorBriefing: (profileId: string) => fetchJson(`/doctor/patients/${profileId}/briefing`),

  draftPrescription: (profileId: string, diagnosis: string, medications: any[], instructions?: string) =>
    fetchJson('/doctor/prescriptions/draft', {
      method: 'POST',
      body: JSON.stringify({
        care_profile_id: profileId,
        diagnosis,
        medications,
        instructions,
      }),
    }),

  signPrescription: (prescriptionId: string, pin: string = '1234') =>
    fetchJson(`/doctor/prescriptions/${prescriptionId}/sign`, {
      method: 'POST',
      body: JSON.stringify({
        practitioner_signature_pin: pin,
      }),
    }),

  // Doctor-Patient Secure Messaging
  getDoctorMessages: (careProfileId: string, practitionerId: string) =>
    fetchJson(`/doctor-messages?care_profile_id=${careProfileId}&practitioner_id=${practitionerId}`),

  sendDoctorMessage: (careProfileId: string, practitionerId: string, senderRole: 'patient' | 'doctor', content: string) =>
    fetchJson('/doctor-messages', {
      method: 'POST',
      body: JSON.stringify({
        care_profile_id: careProfileId,
        practitioner_id: practitionerId,
        sender_role: senderRole,
        content,
      }),
    }),

  // Operations & Pharmacy Restock
  getRestockStatus: (careProfileId: string) =>
    fetchJson(`/operations/restock-status?care_profile_id=${careProfileId}`),

  createPharmacyOrder: (careProfileId: string, items: any[], deliveryAddress: string) =>
    fetchJson('/operations/orders', {
      method: 'POST',
      body: JSON.stringify({
        care_profile_id: careProfileId,
        items,
        delivery_address: deliveryAddress,
      }),
    }),

  getDoctorPracticeStats: () => fetchJson('/doctor/practice-stats'),

  // Doctor Voice Agent & Voice-to-Rx
  sendDoctorVoiceQuery: (query: string, patientId?: string) =>
    fetchJson('/doctor/voice-query', {
      method: 'POST',
      body: JSON.stringify({
        query,
        patient_id: patientId,
      }),
    }),

  sendVoicePrescription: (careProfileId: string, dictationText: string) =>
    fetchJson('/doctor/voice-to-prescription', {
      method: 'POST',
      body: JSON.stringify({
        care_profile_id: careProfileId,
        dictation_text: dictationText,
      }),
    }),

  // Full Voice Turn
  sendVoiceTurn: (careProfileId: string, speechInput: string, language: string = 'en') =>
    fetchJson('/voice/turn', {
      method: 'POST',
      body: JSON.stringify({
        care_profile_id: careProfileId,
        speech_input: speechInput,
        language,
      }),
    }),
};

