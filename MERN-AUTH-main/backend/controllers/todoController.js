import { Todo } from "../models/todoModel.js";

export const getTodos = async (req, res) => {
  try {
    const todos = await Todo.find({ userId: req.userId }).sort({ createdAt: -1 });
    return res.status(200).json({ success: true, todos });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const createTodo = async (req, res) => {
  try {
    const { title } = req.body;
    if (!title || !title.trim()) {
      return res.status(400).json({ success: false, message: "Title is required" });
    }
    const todo = await Todo.create({ userId: req.userId, title: title.trim() });
    return res.status(201).json({ success: true, todo });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const updateTodo = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, completed } = req.body;

    const todo = await Todo.findOne({ _id: id, userId: req.userId });
    if (!todo) {
      return res.status(404).json({ success: false, message: "Todo not found" });
    }

    if (title !== undefined) todo.title = title.trim();
    if (completed !== undefined) todo.completed = completed;
    await todo.save();

    return res.status(200).json({ success: true, todo });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const deleteTodo = async (req, res) => {
  try {
    const { id } = req.params;
    const todo = await Todo.findOneAndDelete({ _id: id, userId: req.userId });
    if (!todo) {
      return res.status(404).json({ success: false, message: "Todo not found" });
    }
    return res.status(200).json({ success: true, message: "Todo deleted" });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};
