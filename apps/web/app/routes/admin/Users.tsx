import { useState } from "react";
import { useSearchParams } from "react-router";
import { adminAPI } from "~/lib/api";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Checkbox } from "~/components/ui/checkbox";
import { Card, CardContent } from "~/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "~/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { Badge } from "~/components/ui/badge";
import { PageLoading } from "~/components/ui/page-loading";
import { useRequireRole } from "~/hooks/useAuth";
import {
  Users,
  Search,
  Plus,
  Edit2,
  Trash2,
  Shield,
  ShieldCheck,
  UserX,
  UserCheck,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { TablePagination } from "~/components/ui/table-pagination";
import { ConfirmDeleteDialog } from "~/components/ui/confirm-delete-dialog";
import { EmptyState } from "~/components/ui/empty-state";

export default function AdminUsers() {
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const user = useRequireRole("admin");

  const [search, setSearch] = useState(searchParams.get("search") || "");
  const [roleFilter, setRoleFilter] = useState(searchParams.get("role") || "all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [page, setPage] = useState(1);

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<any>(null);

  const [createForm, setCreateForm] = useState({
    email: "",
    name: "",
    role: "lecturer",
  });

  const [editForm, setEditForm] = useState({
    name: "",
    role: "",
    isActive: true,
    isSuperAdmin: false,
  });

  // Fetch users
  const { data: usersData, isLoading, refetch } = useQuery({
    queryKey: ["admin-users", page, search, roleFilter, statusFilter],
    queryFn: () =>
      adminAPI.getUsers({
        page,
        limit: 15,
        role: roleFilter !== "all" ? roleFilter : undefined,
        isActive: statusFilter !== "all" ? statusFilter === "active" : undefined,
        search: search || undefined,
      }),
  });

  const users = usersData?.data?.users || [];
  const pagination = usersData?.data?.pagination || { page: 1, pages: 1, total: 0 };

  // Create user mutation
  const createMutation = useMutation({
    mutationFn: (data: any) => adminAPI.createUser(data),
    onSuccess: () => {
      toast.success("User created successfully");
      setIsCreateModalOpen(false);
      setCreateForm({ email: "", name: "", role: "lecturer" });
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || "Failed to create user");
    },
  });

  // Update user mutation
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) =>
      adminAPI.updateUser(id, data),
    onSuccess: () => {
      toast.success("User updated successfully");
      setIsEditModalOpen(false);
      setSelectedUser(null);
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || "Failed to update user");
    },
  });

  // Delete user mutation
  const deleteMutation = useMutation({
    mutationFn: (id: string) => adminAPI.deleteUser(id),
    onSuccess: () => {
      toast.success("User deleted successfully");
      setIsDeleteModalOpen(false);
      setSelectedUser(null);
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || "Failed to delete user");
    },
  });

  // Change role mutation
  const changeRoleMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) =>
      adminAPI.changeRole(id, data),
    onSuccess: () => {
      toast.success("User role updated successfully");
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || "Failed to update role");
    },
  });

  const handleOpenEdit = (user: any) => {
    setSelectedUser(user);
    setEditForm({
      name: user.name,
      role: user.role,
      isActive: user.isActive,
      isSuperAdmin: user.isSuperAdmin || false,
    });
    setIsEditModalOpen(true);
  };

  const handleOpenDelete = (user: any) => {
    setSelectedUser(user);
    setIsDeleteModalOpen(true);
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
  };

  if (!user) {
    return <PageLoading label="Loading users…" />;
  }

  return (
    <div className="flex flex-col gap-6 p-6 max-w-7xl mx-auto w-full">
      {/* Page heading */}
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground tracking-tight">
            User Management
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Manage all users in the system
          </p>
        </div>
        <Button
          onClick={() => setIsCreateModalOpen(true)}
          className="flex items-center gap-2 text-sm"
        >
          <Plus className="w-4 h-4" />
          Create User
        </Button>
      </header>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-4">
            {/* Search */}
            <form onSubmit={handleSearch} className="flex-1 min-w-[200px]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  placeholder="Search by name, email, or student ID..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-10"
                />
              </div>
            </form>

            {/* Role Filter */}
            <Select value={roleFilter} onValueChange={(v) => { setRoleFilter(v); setPage(1); }}>
              <SelectTrigger className="w-[140px]" aria-label="Filter by role">
                <SelectValue placeholder="Role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Roles</SelectItem>
                <SelectItem value="student">Student</SelectItem>
                <SelectItem value="lecturer">Lecturer</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
              </SelectContent>
            </Select>

            {/* Status Filter */}
            <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1); }}>
              <SelectTrigger className="w-[140px]" aria-label="Filter by status">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Users Table */}
      <Card className="overflow-hidden">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : users.length === 0 ? (
            <EmptyState
              icon={Users}
              title="No users found"
              description="No users matched the current search or filters."
              withCard={false}
            />
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead>
                      User
                    </TableHead>
                    <TableHead>
                      Role
                    </TableHead>
                    <TableHead>
                      Status
                    </TableHead>
                    <TableHead>
                      Last Login
                    </TableHead>
                    <TableHead className="text-right">
                      Actions
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((u: any) => (
                    <TableRow key={u._id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-accent flex items-center justify-center text-accent-foreground text-sm font-medium">
                            {u.name.charAt(0)}
                          </div>
                          <div>
                            <p className="text-sm font-medium text-foreground">{u.name}</p>
                            <p className="text-xs text-muted-foreground">{u.email}</p>
                            {u.studentId && (
                              <p className="text-xs text-muted-foreground">ID: {u.studentId}</p>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {u.role === "admin" ? (
                            <Badge variant="destructive">
                              {u.isSuperAdmin ? (
                                <>
                                  <ShieldCheck className="w-3 h-3" /> Super Admin
                                </>
                              ) : (
                                <>
                                  <Shield className="w-3 h-3" /> Admin
                                </>
                              )}
                            </Badge>
                          ) : u.role === "lecturer" ? (
                            <Badge variant="info">Lecturer</Badge>
                          ) : (
                            <Badge variant="success">Student</Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {u.isActive ? (
                          <Badge variant="success">
                            <UserCheck className="w-3 h-3" /> Active
                          </Badge>
                        ) : (
                          <Badge>
                            <UserX className="w-3 h-3" /> Inactive
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {u.lastLogin
                          ? new Date(u.lastLogin).toLocaleDateString()
                          : "Never"}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleOpenEdit(u)}
                            className="text-muted-foreground hover:text-primary hover:bg-accent"
                            aria-label={`Edit ${u.name}`}
                            title={`Edit ${u.name}`}
                          >
                            <Edit2 className="w-4 h-4" />
                          </Button>
                          {user.isSuperAdmin && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleOpenDelete(u)}
                              className="text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                              aria-label={`Delete ${u.name}`}
                              title={`Delete ${u.name}`}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              <TablePagination
                page={pagination.page}
                pages={pagination.pages}
                total={pagination.total}
                limit={15}
                onPageChange={setPage}
                itemName="users"
              />
            </>
          )}
        </Card>

      {/* Create User Modal */}
      <Dialog open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New User</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={createForm.email}
                onChange={(e) =>
                  setCreateForm({ ...createForm, email: e.target.value })
                }
                placeholder="user@example.com"
              />
            </div>
            <div>
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                value={createForm.name}
                onChange={(e) =>
                  setCreateForm({ ...createForm, name: e.target.value })
                }
                placeholder="Full Name"
              />
            </div>
            <div>
              <Label htmlFor="role">Role</Label>
              <Select
                value={createForm.role}
                onValueChange={(v) =>
                  setCreateForm({ ...createForm, role: v })
                }
              >
                <SelectTrigger aria-label="Create user role">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="lecturer">Lecturer</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsCreateModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={() => createMutation.mutate(createForm)}
              disabled={createMutation.isPending}
            >
              {createMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                "Create User"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit User Modal */}
      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit User</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label>Email</Label>
              <Input value={selectedUser?.email ?? ""} disabled />
            </div>
            <div>
              <Label htmlFor="edit-name">Name</Label>
              <Input
                id="edit-name"
                value={editForm.name}
                onChange={(e) =>
                  setEditForm({ ...editForm, name: e.target.value })
                }
              />
            </div>
            <div>
              <Label htmlFor="edit-role">Role</Label>
              <Select
                value={editForm.role}
                onValueChange={(v) =>
                  setEditForm({ ...editForm, role: v })
                }
              >
                <SelectTrigger aria-label="Edit user role">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="student">Student</SelectItem>
                  <SelectItem value="lecturer">Lecturer</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {editForm.role === "admin" && user.isSuperAdmin && (
              <div className="flex items-center gap-2">
                <Checkbox
                  id="edit-super"
                  checked={editForm.isSuperAdmin}
                  onCheckedChange={(checked) =>
                    setEditForm({
                      ...editForm,
                      isSuperAdmin: checked === true,
                    })
                  }
                />
                <Label htmlFor="edit-super">Super Admin</Label>
              </div>
            )}
            <div className="flex items-center gap-2">
              <Checkbox
                id="edit-active"
                checked={editForm.isActive}
                onCheckedChange={(checked) =>
                  setEditForm({ ...editForm, isActive: checked === true })
                }
              />
              <Label htmlFor="edit-active">Active</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditModalOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() =>
                updateMutation.mutate({
                  id: selectedUser._id,
                  data: {
                    ...editForm,
                    isSuperAdmin:
                      editForm.role === "admin" ? editForm.isSuperAdmin : false,
                  },
                })
              }
              disabled={updateMutation.isPending}
            >
              {updateMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                "Save Changes"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Modal */}
      <ConfirmDeleteDialog
        open={isDeleteModalOpen}
        onOpenChange={setIsDeleteModalOpen}
        title="Delete User"
        description={
          <>
            Are you sure you want to delete user{" "}
            <strong>{selectedUser?.name}</strong> ({selectedUser?.email})?
            <br />
            This action cannot be undone.
          </>
        }
        onConfirm={() => deleteMutation.mutate(selectedUser._id)}
        isDeleting={deleteMutation.isPending}
        confirmLabel="Delete User"
      />
    </div>
  );
}
