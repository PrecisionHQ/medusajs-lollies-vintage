import { defineRouteConfig } from "@medusajs/admin-sdk";
import { Button, Container, Heading, Input, Select, Text } from "@medusajs/ui";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { sdk } from "../../lib/sdk";

type Role = { id: string; name: string; description?: string | null };
type Policy = { id: string; name?: string | null; resource: string; operation: string };
type User = { id: string; email: string };

/**
 * Phase 5 (R2) — staff management over native RBAC. Roles with policy
 * attach, users with role assignment, invites carrying roles. Everything
 * here 404s while MEDUSA_FF_RBAC is off — the page says so instead of
 * rendering an empty shell, because with the flag off there is nothing
 * to manage (everyone is full admin by design).
 */
const StaffPage = () => {
  const [roleName, setRoleName] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("");
  const [openRole, setOpenRole] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [flagOff, setFlagOff] = useState(false);

  const rolesQ = useQuery<{ roles: Role[] }>({
    queryKey: ["rbac-roles"],
    queryFn: () =>
      sdk.client.fetch<{ roles: Role[] }>("/admin/rbac/roles").catch((e: any) => {
        if (String(e?.message ?? e).includes("404")) setFlagOff(true);
        throw e;
      }),
    refetchInterval: 300_000,
    retry: false,
  });
  const policiesQ = useQuery<{ policies: Policy[] }>({
    queryKey: ["rbac-policies"],
    queryFn: () => sdk.client.fetch("/admin/rbac/policies?limit=500"),
    retry: false,
  });
  const usersQ = useQuery<{ users: User[] }>({
    queryKey: ["admin-users"],
    queryFn: () => sdk.client.fetch("/admin/users?fields=id,email"),
    retry: false,
  });

  const roles = rolesQ.data?.roles ?? [];
  const policies = policiesQ.data?.policies ?? [];
  const users = usersQ.data?.users ?? [];

  const fail = (e: unknown) => setError(e instanceof Error ? e.message : "Request failed.");

  const reload = () => Promise.all([rolesQ.refetch(), policiesQ.refetch(), usersQ.refetch()]);

  const createRole = async () => {
    if (!roleName.trim()) {
      setError("Name the role first (e.g. fulfillment).");
      return;
    }
    setBusy("role-add");
    setError(null);
    try {
      await sdk.client.fetch("/admin/rbac/roles", {
        method: "POST",
        body: { name: roleName.trim() },
      });
      setRoleName("");
      await reload();
    } catch (e) {
      fail(e);
    } finally {
      setBusy(null);
    }
  };

  const invite = async () => {
    if (!inviteEmail.includes("@")) {
      setError("Enter the staff email to invite.");
      return;
    }
    setBusy("invite");
    setError(null);
    try {
      await sdk.client.fetch("/admin/invites", {
        method: "POST",
        body: {
          email: inviteEmail.trim().toLowerCase(),
          ...(inviteRole ? { roles: [inviteRole] } : {}),
        },
      });
      setInviteEmail("");
      setInviteRole("");
      setError("Invite sent — they sign up from the emailed link.");
    } catch (e) {
      fail(e);
    } finally {
      setBusy(null);
    }
  };

  if (flagOff) {
    return (
      <div className="flex flex-col gap-3 max-w-2xl">
        <Container className="px-5 py-4">
          <Heading level="h2">Staff</Heading>
          <Text className="text-ui-fg-subtle">
            Role-based access is OFF (MEDUSA_FF_RBAC unset) — every admin is
            full admin and there is nothing to manage. Follow
            docs/staff-roles.md to switch on.
          </Text>
        </Container>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 max-w-2xl">
      <Container className="px-5 py-4">
        <Heading level="h2">Staff</Heading>
        <Text className="text-ui-fg-subtle">
          Roles, policies, and invites. Enforcement is native (route-declared
          policies); this page only administers who holds what.
        </Text>
        {error ? <Text>{error}</Text> : null}
        <div className="flex items-center gap-2 mt-2">
          <Input
            placeholder="New role (e.g. fulfillment)"
            value={roleName}
            onChange={(e) => setRoleName(e.target.value)}
          />
          <Button disabled={busy !== null} onClick={createRole}>
            {busy === "role-add" ? "…" : "Add role"}
          </Button>
        </div>
        <div className="flex items-center gap-2 mt-2">
          <Input
            placeholder="staff@example.com"
            value={inviteEmail}
            onChange={(e) => setInviteEmail(e.target.value)}
          />
          <Select value={inviteRole} onValueChange={setInviteRole}>
            <Select.Trigger>
              <Select.Value placeholder="Role (optional)" />
            </Select.Trigger>
            <Select.Content>
              {roles.map((r) => (
                <Select.Item key={r.id} value={r.id}>
                  {r.name}
                </Select.Item>
              ))}
            </Select.Content>
          </Select>
          <Button disabled={busy !== null} onClick={invite}>
            {busy === "invite" ? "…" : "Invite"}
          </Button>
        </div>
      </Container>

      {rolesQ.isLoading ? (
        <Container className="px-5 py-4">
          <Text>Loading…</Text>
        </Container>
      ) : null}

      {roles.map((r) => (
        <RoleCard
          key={r.id}
          role={r}
          policies={policies}
          users={users}
          open={openRole === r.id}
          onToggle={() => setOpenRole(openRole === r.id ? null : r.id)}
          busy={busy}
          setBusy={setBusy}
          fail={fail}
          reload={reload}
        />
      ))}
    </div>
  );
};

const RoleCard = ({
  role,
  policies,
  users,
  open,
  onToggle,
  busy,
  setBusy,
  fail,
  reload,
}: {
  role: Role;
  policies: Policy[];
  users: User[];
  open: boolean;
  onToggle: () => void;
  busy: string | null;
  setBusy: (v: string | null) => void;
  fail: (e: unknown) => void;
  reload: () => Promise<unknown>;
}) => {
  const [rolePolicies, setRolePolicies] = useState<Policy[] | null>(null);
  const [roleUsers, setRoleUsers] = useState<User[] | null>(null);
  const [attach, setAttach] = useState("");
  const [addUser, setAddUser] = useState("");

  const expand = async () => {
    onToggle();
    if (rolePolicies !== null) return;
    try {
      const [p, u] = await Promise.all([
        sdk.client.fetch(`/admin/rbac/roles/${role.id}/policies`) as Promise<{ policies: Policy[] }>,
        sdk.client.fetch(`/admin/rbac/roles/${role.id}/users`) as Promise<{ users: User[] }>,
      ]);
      setRolePolicies(p.policies ?? []);
      setRoleUsers(u.users ?? []);
    } catch (e) {
      fail(e);
    }
  };

  const attachPolicy = async () => {
    if (!attach) return;
    setBusy(`pol-${role.id}`);
    try {
      await sdk.client.fetch(`/admin/rbac/roles/${role.id}/policies`, {
        method: "POST",
        body: { policies: [attach] },
      });
      setAttach("");
      setRolePolicies(null);
      expand();
    } catch (e) {
      fail(e);
    } finally {
      setBusy(null);
    }
  };

  const assignUser = async () => {
    if (!addUser) return;
    setBusy(`usr-${role.id}`);
    try {
      await sdk.client.fetch(`/admin/rbac/roles/${role.id}/users`, {
        method: "POST",
        body: { users: [addUser] },
      });
      setAddUser("");
      setRolePolicies(null);
      setRoleUsers(null);
      expand();
      await reload();
    } catch (e) {
      fail(e);
    } finally {
      setBusy(null);
    }
  };

  const held = new Set((rolePolicies ?? []).map((p) => p.id));

  return (
    <Container className="px-5 py-4">
      <div className="flex items-center justify-between">
        <Heading level="h3">{role.name}</Heading>
        <Button variant="secondary" onClick={expand}>
          {open ? "Close" : "Manage"}
        </Button>
      </div>
      {role.description ? <Text className="text-ui-fg-subtle">{role.description}</Text> : null}
      {open ? (
        <>
          <Text className="mt-2">
            Policies ({rolePolicies?.length ?? "…"}):{" "}
            {(rolePolicies ?? []).map((p) => `${p.resource}:${p.operation}`).join(", ") || "none yet"}
          </Text>
          <div className="flex items-center gap-2 mt-2">
            <Select value={attach} onValueChange={setAttach}>
              <Select.Trigger>
                <Select.Value placeholder="Attach policy" />
              </Select.Trigger>
              <Select.Content>
                {policies
                  .filter((p) => !held.has(p.id))
                  .slice(0, 100)
                  .map((p) => (
                    <Select.Item key={p.id} value={p.id}>
                      {p.resource}:{p.operation}
                    </Select.Item>
                  ))}
              </Select.Content>
            </Select>
            <Button variant="secondary" disabled={busy !== null || !attach} onClick={attachPolicy}>
              {busy === `pol-${role.id}` ? "…" : "Attach"}
            </Button>
          </div>
          <Text className="mt-2">
            Users ({roleUsers?.length ?? "…"}):{" "}
            {(roleUsers ?? []).map((u) => u.email).join(", ") || "none yet"}
          </Text>
          <div className="flex items-center gap-2 mt-2">
            <Select value={addUser} onValueChange={setAddUser}>
              <Select.Trigger>
                <Select.Value placeholder="Assign user" />
              </Select.Trigger>
              <Select.Content>
                {users.map((u) => (
                  <Select.Item key={u.id} value={u.id}>
                    {u.email}
                  </Select.Item>
                ))}
              </Select.Content>
            </Select>
            <Button variant="secondary" disabled={busy !== null || !addUser} onClick={assignUser}>
              {busy === `usr-${role.id}` ? "…" : "Assign"}
            </Button>
          </div>
        </>
      ) : null}
    </Container>
  );
};

export const config = defineRouteConfig({
  label: "Staff",
});

export default StaffPage;
