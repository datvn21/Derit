import axios from 'axios';

export const BACKEND_URL = import.meta.env.DEV
    ? (import.meta.env.VITE_DEV_BACKEND_URL || 'http://localhost:5001')
    : (import.meta.env.VITE_BACKEND_URL || 'http://localhost:5001');

const api = axios.create({
    baseURL: BACKEND_URL,
    withCredentials: true,
    headers: {
        'Content-Type': 'application/json',
    },
});

// Auth APIs
export const authAPI = {
    getUser: () => api.get('/auth/user'),
    logout: () => api.get('/auth/logout'),
};



// Exam Template APIs (Lecturer)
export const examTemplateAPI = {
    create: (data: any) => api.post('/exam-templates', data),
    getAll: () => api.get('/exam-templates'),
    getById: (id: string) => api.get(`/exam-templates/${id}`),
    update: (id: string, data: any) => api.put(`/exam-templates/${id}`, data),
    delete: (id: string) => api.delete(`/exam-templates/${id}`),
    addQuestion: (id: string, data: any) => api.post(`/exam-templates/${id}/questions`, data),
    removeQuestion: (id: string, questionId: string) =>
        api.delete(`/exam-templates/${id}/questions/${questionId}`),
    togglePublish: (id: string) => api.patch(`/exam-templates/${id}/publish`),
    share: (id: string, email: string) => api.post(`/exam-templates/${id}/share`, { email }),
};

// Exam Session APIs
export const examSessionAPI = {
    // Lecturer
    create: (data: any) => api.post('/exam-sessions', data),
    getAll: () => api.get('/exam-sessions'),
    getById: (id: string) => api.get(`/exam-sessions/${id}`),
    update: (id: string, data: any) => api.put(`/exam-sessions/${id}`, data),
    delete: (id: string) => api.delete(`/exam-sessions/${id}`),
    start: (id: string) => api.post(`/exam-sessions/${id}/start`),
    end: (id: string) => api.post(`/exam-sessions/${id}/end`),
    getStudents: (id: string) => api.get(`/exam-sessions/${id}/students`),
    getResults: (id: string) => api.get(`/exam-sessions/${id}/results`),

    // Student
    getAvailable: () => api.get('/exam-sessions/available'),
    searchByRoomCode: (roomCode: string) => api.get(`/exam-sessions/search/by-roomcode/${roomCode}`),
    join: (id: string, accessKey: string) =>
        api.post(`/exam-sessions/${id}/join`, { accessKey }),
    assignCode: (id: string, data: { accessKey: string }) =>
        api.post(`/exam-sessions/${id}/assign-code`, data),
    joinWaitingList: (roomCode: string, data: { computerOrder?: number | null; accessKey: string }) =>
        api.post(`/exam-sessions/join-waiting/${roomCode}`, data),
    getWaitingList: (id: string) => api.get(`/exam-sessions/${id}/waiting`),
    approveWaitingStudent: (id: string, studentId: string) =>
        api.post(`/exam-sessions/${id}/approve-waiting/${studentId}`),
    approveAllWaiting: (id: string) =>
        api.post(`/exam-sessions/${id}/approve-all-waiting`),
    getExam: (id: string) => api.get(`/exam-sessions/${id}/exam`),
    getStatus: (id: string) => api.get(`/exam-sessions/${id}/status`),
};

// Submission APIs (Student)
export const submissionAPI = {
    submit: (data: any) => api.post('/submissions', data),
    autosave: (data: any) => api.post('/submissions/autosave', data),
    runConsole: (data: { files: any[]; mainFile: string; language: string }) =>
        api.post('/submissions/run-console', data),
    getById: (id: string) => api.get(`/submissions/${id}`),
    getByExam: (sessionId: string) => api.get(`/submissions/exam/${sessionId}`),
    getByQuestion: (sessionId: string, questionId: string) =>
        api.get(`/submissions/exam/${sessionId}/question/${questionId}`),
    getLatest: (sessionId: string, questionId: string) =>
        api.get(`/submissions/exam/${sessionId}/question/${questionId}/latest`),
    submitExam: (sessionId: string) => api.post(`/submissions/submit-exam/${sessionId}`),
    recordActivity: (sessionId: string, data: { type: 'join' | 'tab_switch' }) =>
        api.post(`/submissions/record-activity/${sessionId}`, data),

    // Lecturer
    getAllForSession: (sessionId: string) => api.get(`/submissions/session/${sessionId}/all`),
    getStudentSubmissions: (sessionId: string, studentId: string) =>
        api.get(`/submissions/session/${sessionId}/student/${studentId}`),
    regradeAll: (sessionId: string, submittedOnly = true) => api.post(`/submissions/session/${sessionId}/regrade-all`, { submittedOnly }),
    regradeProgressUrl: (sessionId: string) =>
        `${BACKEND_URL}/submissions/session/${sessionId}/regrade-progress`,
    exportCSV: (sessionId: string) =>
        api.get(`/submissions/session/${sessionId}/export-csv`, { responseType: 'blob' }),
    getStudentDetail: (sessionId: string, studentId: string) =>
        api.get(`/submissions/session/${sessionId}/student/${studentId}/detail`),
    getStudentActivity: (sessionId: string, studentId: string) =>
        api.get(`/submissions/session/${sessionId}/student/${studentId}/activity`),
};

// Result APIs
export const resultAPI = {
    // Student
    getMyResult: (sessionId: string) => api.get(`/results/exam/${sessionId}`),
    getHistory: () => api.get('/results/history'),

    // Lecturer
    getSessionResults: (sessionId: string) => api.get(`/results/session/${sessionId}`),
    getLeaderboard: (sessionId: string) => api.get(`/results/session/${sessionId}/leaderboard`),
    finalize: (sessionId: string) => api.post(`/results/session/${sessionId}/finalize`),
    exportCSV: (sessionId: string) =>
        api.get(`/results/session/${sessionId}/export`, { responseType: 'blob' }),
};

// Classroom APIs (Lecturer)
export const classroomAPI = {
    create: (data: any) => api.post('/classrooms', data),
    getAll: () => api.get('/classrooms'),
    getById: (id: string) => api.get(`/classrooms/${id}`),
    update: (id: string, data: any) => api.put(`/classrooms/${id}`, data),
    delete: (id: string) => api.delete(`/classrooms/${id}`),
};

// Upload APIs
export const uploadAPI = {
    uploadPdf: (file: File, onProgress?: (progress: number) => void) => {
        const formData = new FormData();
        formData.append('pdf', file);
        return api.post('/upload/pdf', formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
            timeout: 60000, // 60 second timeout
            onUploadProgress: (progressEvent) => {
                if (progressEvent.total) {
                    const percentCompleted = Math.round(
                        (progressEvent.loaded * 100) / progressEvent.total
                    );
                    onProgress?.(percentCompleted);
                }
            },
        });
    },
    deletePdf: (filename: string) => {
        return api.delete(`/upload/pdf/${filename}`);
    },
};

export default api;
