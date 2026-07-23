import { create } from 'zustand';

export interface User {
    id: string;
    email: string;
    name: string;
    avatar: string;
    role: 'student' | 'lecturer' | 'admin';
    studentId?: string;
    isActive: boolean;
    isSuperAdmin?: boolean;
    adminPermissions?: string[];
}

interface UserStore {
    user: User | null;
    isLoading: boolean;
    isAuthenticated: boolean;
    setUser: (user: User | null) => void;
    setLoading: (loading: boolean) => void;
    logout: () => void;
}

export const useUserStore = create<UserStore>((set) => ({
    user: null,
    isLoading: true,
    isAuthenticated: false,

    setUser: (user) => set({
        user,
        isAuthenticated: !!user,
        isLoading: false
    }),

    setLoading: (loading) => set({ isLoading: loading }),

    logout: () => set({
        user: null,
        isAuthenticated: false,
        isLoading: false
    }),
}));
