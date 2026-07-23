import { describe, it, expect, beforeEach } from "vitest";
import { useUserStore } from "../../../app/stores/userStore";
import type { User } from "../../../app/stores/userStore";

describe("UserStore", () => {
  const mockUser: User = {
    id: "123",
    email: "test@example.com",
    name: "Test User",
    avatar: "https://example.com/avatar.jpg",
    role: "student",
    studentId: "ST001",
    isActive: true,
  };

  beforeEach(() => {
    // Reset store before each test
    useUserStore.setState({
      user: null,
      isLoading: true,
      isAuthenticated: false,
    });
  });

  describe("Initial State", () => {
    it("should have null user initially", () => {
      const { user, isLoading, isAuthenticated } = useUserStore.getState();
      expect(user).toBeNull();
      expect(isLoading).toBe(true);
      expect(isAuthenticated).toBe(false);
    });
  });

  describe("setUser", () => {
    it("should set user and update authentication state", () => {
      useUserStore.getState().setUser(mockUser);

      const { user, isAuthenticated, isLoading } = useUserStore.getState();
      expect(user).toEqual(mockUser);
      expect(isAuthenticated).toBe(true);
      expect(isLoading).toBe(false);
    });

    it("should set user to null and update authentication state", () => {
      useUserStore.getState().setUser(mockUser);
      useUserStore.getState().setUser(null);

      const { user, isAuthenticated, isLoading } = useUserStore.getState();
      expect(user).toBeNull();
      expect(isAuthenticated).toBe(false);
      expect(isLoading).toBe(false);
    });
  });

  describe("setLoading", () => {
    it("should update loading state", () => {
      useUserStore.getState().setLoading(false);

      const { isLoading } = useUserStore.getState();
      expect(isLoading).toBe(false);
    });

    it("should set loading to true", () => {
      useUserStore.getState().setLoading(true);

      const { isLoading } = useUserStore.getState();
      expect(isLoading).toBe(true);
    });
  });

  describe("logout", () => {
    it("should clear user and authentication state", () => {
      useUserStore.getState().setUser(mockUser);
      useUserStore.getState().logout();

      const { user, isAuthenticated, isLoading } = useUserStore.getState();
      expect(user).toBeNull();
      expect(isAuthenticated).toBe(false);
      expect(isLoading).toBe(false);
    });
  });

  describe("Role-based state", () => {
    it("should handle student role", () => {
      useUserStore.getState().setUser(mockUser);

      const { user } = useUserStore.getState();
      expect(user?.role).toBe("student");
    });

    it("should handle lecturer role", () => {
      const lecturerUser = { ...mockUser, role: "lecturer" as const };
      useUserStore.getState().setUser(lecturerUser);

      const { user } = useUserStore.getState();
      expect(user?.role).toBe("lecturer");
    });
  });
});
