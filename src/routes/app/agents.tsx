import { useEffect, useState, type FormEvent } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { agentsFn, createAgentFn, deleteAgentFn, updateAgentFn } from "@/lib/wallet/fns";
import { Area, Button, Field, messageOf, Notice, Panel, TextInput } from "@/components/ui";

export const Route = createFileRoute("/app/agents")({ component: AgentsPage });

type Agent = Awaited<ReturnType<typeof agentsFn>>[number];

function AgentsPage() {
  const [agents, setAgents] = useState<Agent[] | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState("");

  function load() {
    agentsFn().then(setAgents).catch((cause) => setError(messageOf(cause)));
  }
  useEffect(load, []);

  async function create(event: FormEvent) {
    event.preventDefault();
    setError("");
    try {
      await createAgentFn({ data: { name, description } });
      setName("");
      setDescription("");
      load();
    } catch (cause) {
      setError(messageOf(cause));
    }
  }

  return (
    <div className="space-y-5">
      <h1 className="font-serif text-4xl">Agents</h1>
      <Panel title="New agent">
        <form className="space-y-3" onSubmit={(event) => void create(event)}>
          <Field label="Name"><TextInput value={name} onChange={(event) => setName(event.target.value)} required /></Field>
          <Field label="What it is allowed to work on"><Area value={description} onChange={(event) => setDescription(event.target.value)} /></Field>
          <Button type="submit">Create agent</Button>
        </form>
      </Panel>
      {error && <Notice tone="bad">{error}</Notice>}
      {!agents && <p className="text-muted">Loading agents…</p>}
      {agents?.length === 0 && <p className="text-sm text-muted">No agents yet. Create one, then attach a wallet and a policy.</p>}
      {agents?.map((agent) => (
        <article key={agent.id} className="rounded-lg border border-border bg-surface p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="font-serif text-2xl">{agent.name}</h2>
              <p className="text-sm text-muted">{agent.description || "No description."}</p>
              <p className="mt-1 text-xs text-muted">{agent.status} · {agent.id}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {(["active", "paused", "suspended"] as const).map((status) => (
                <Button key={status} type="button" tone="ghost" onClick={() => void updateAgentFn({ data: { id: agent.id, status } }).then(load).catch((cause) => setError(messageOf(cause)))}>{status}</Button>
              ))}
              <Button type="button" tone="ghost" onClick={() => void deleteAgentFn({ data: agent.id }).then(load).catch((cause) => setError(messageOf(cause)))}>Delete</Button>
            </div>
          </div>
        </article>
      ))}
    </div>
  );
}
