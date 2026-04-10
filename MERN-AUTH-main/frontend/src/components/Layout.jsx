import React from "react";
import { Outlet } from "react-router-dom";
import Navbar from "./Navbar";

const Layout = () => {
  return (
    <div className="min-h-screen bg-[#0B0F19]">
      <Navbar />
      <Outlet />
    </div>
  );
};

export default Layout;
