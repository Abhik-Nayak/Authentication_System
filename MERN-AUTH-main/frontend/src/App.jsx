import React from "react";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import Home from "./pages/Home";
import Signup from "./pages/Signup";
import Login from "./pages/Login";
import VerifyEmail from "./pages/VerifyEmail";
import Verify from "./pages/Verify";
import ProtectedRoute from "./components/ProtectedRoute";
import ForgotPassword from "./pages/ForgotPassword";
import VerifyOTP from "./pages/VerifyOTP";
import ChangePassword from "./pages/ChangePassword";
import AuthSuccess from "./pages/AuthSuccess";
import TwoFactorSettings from "./pages/TwoFactorSettings";
import TwoFactorLogin from "./pages/TwoFactorLogin";
import NotFound from "./pages/NotFound";
import Layout from "./components/Layout";
import Settings from "./pages/Settings";
import Todos from "./pages/Todos";

const router = createBrowserRouter([
  // Protected routes with Navbar
  {
    element: (
      <ProtectedRoute>
        <Layout />
      </ProtectedRoute>
    ),
    children: [
      {
        path: "/",
        element: <Home />,
      },
      {
        path: "/settings",
        element: <Settings />,
      },
      {
        path: "/todos",
        element: <Todos />,
      },
      {
        path: "/2fa-setup",
        element: <TwoFactorSettings />,
      },
    ],
  },

  // Public auth routes
  {
    path: "/signup",
    element: <Signup />,
  },
  {
    path: "/login",
    element: <Login />,
  },
  {
    path: "/2fa-login",
    element: <TwoFactorLogin />,
  },
  {
    path: "/verify",
    element: <VerifyEmail />,
  },
  {
    path: "/verify/:token",
    element: <Verify />,
  },
  {
    path: "/auth-success",
    element: <AuthSuccess />,
  },
  {
    path: "/forgot-password",
    element: <ForgotPassword />,
  },
  {
    path: "/verify-otp/:email",
    element: <VerifyOTP />,
  },
  {
    path: "/change-password/:email",
    element: <ChangePassword />,
  },

  // 404 catch-all
  {
    path: "*",
    element: <NotFound />,
  },
]);

const App = () => {
  return (
    <div>
      <RouterProvider router={router} />
    </div>
  );
};

export default App;
