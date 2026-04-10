import React, { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Check, Loader2, Plus, Trash2, Undo2 } from "lucide-react";
import { toast } from "sonner";
import api from "@/lib/axios";

const Todos = () => {
  const [todos, setTodos] = useState([]);
  const [newTitle, setNewTitle] = useState("");
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const accessToken = localStorage.getItem("accessToken");

  const headers = { Authorization: `Bearer ${accessToken}` };

  const fetchTodos = async () => {
    try {
      const res = await api.get("/todos", { headers });
      setTodos(res.data.todos);
    } catch (error) {
      toast.error("Failed to load todos");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTodos();
  }, []);

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!newTitle.trim()) return;
    try {
      setAdding(true);
      const res = await api.post("/todos", { title: newTitle }, { headers });
      setTodos((prev) => [res.data.todo, ...prev]);
      setNewTitle("");
      toast.success("Todo added");
    } catch (error) {
      toast.error("Failed to add todo");
    } finally {
      setAdding(false);
    }
  };

  const handleToggle = async (id, completed) => {
    try {
      const res = await api.put(`/todos/${id}`, { completed: !completed }, { headers });
      setTodos((prev) =>
        prev.map((t) => (t._id === id ? res.data.todo : t))
      );
    } catch (error) {
      toast.error("Failed to update todo");
    }
  };

  const handleDelete = async (id) => {
    try {
      await api.delete(`/todos/${id}`, { headers });
      setTodos((prev) => prev.filter((t) => t._id !== id));
      toast.success("Todo deleted");
    } catch (error) {
      toast.error("Failed to delete todo");
    }
  };

  const completedCount = todos.filter((t) => t.completed).length;

  return (
    <div className="relative min-h-[calc(100vh-64px)] w-full overflow-hidden bg-[#0B0F19]">
      {/* Gradient blobs */}
      <div className="absolute -top-40 left-1/2 -translate-x-1/2 h-[500px] w-[500px] rounded-full bg-emerald-500/20 blur-[160px]" />
      <div className="absolute top-40 -right-40 h-[400px] w-[400px] rounded-full bg-cyan-500/20 blur-[160px]" />

      <div className="relative z-10 max-w-2xl mx-auto px-4 py-12">
        {/* Header */}
        <div className="text-center space-y-2 mb-8">
          <h1 className="text-3xl font-bold text-white">My Todos</h1>
          <p className="text-gray-400 text-sm">
            {todos.length === 0
              ? "No todos yet. Add one below!"
              : `${completedCount} of ${todos.length} completed`}
          </p>
        </div>

        {/* Add Todo */}
        <form onSubmit={handleAdd} className="flex gap-3 mb-8">
          <Input
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder="What needs to be done?"
            className="flex-1 bg-white/5 border-white/10 text-white placeholder:text-gray-500 focus:border-emerald-400"
          />
          <Button
            type="submit"
            disabled={adding || !newTitle.trim()}
            className="rounded-xl bg-gradient-to-r from-emerald-500 to-cyan-500 text-black font-semibold hover:opacity-90 transition px-6"
          >
            {adding ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Plus className="h-4 w-4" />
            )}
          </Button>
        </form>

        {/* Todo List */}
        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-emerald-400" />
          </div>
        ) : todos.length === 0 ? (
          <Card className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl">
            <CardContent className="py-12 text-center">
              <p className="text-gray-500">Your todo list is empty</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {todos.map((todo) => (
              <div
                key={todo._id}
                className="flex items-center gap-3 p-4 rounded-xl backdrop-blur-xl bg-white/5 border border-white/10 group transition hover:bg-white/[0.07]"
              >
                {/* Toggle */}
                <button
                  onClick={() => handleToggle(todo._id, todo.completed)}
                  className={`flex-shrink-0 h-6 w-6 rounded-full border-2 flex items-center justify-center transition ${
                    todo.completed
                      ? "bg-emerald-500 border-emerald-500"
                      : "border-white/20 hover:border-emerald-400"
                  }`}
                >
                  {todo.completed && <Check className="h-3.5 w-3.5 text-black" />}
                </button>

                {/* Title */}
                <span
                  className={`flex-1 text-sm transition ${
                    todo.completed
                      ? "line-through text-gray-500"
                      : "text-white"
                  }`}
                >
                  {todo.title}
                </span>

                {/* Delete */}
                <button
                  onClick={() => handleDelete(todo._id)}
                  className="opacity-0 group-hover:opacity-100 text-gray-500 hover:text-red-400 transition"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Todos;
