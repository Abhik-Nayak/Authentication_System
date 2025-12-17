import { BookA, BookOpen, BrainCircuitIcon, LogOut, User } from "lucide-react";
import React from "react";
import { Link } from "react-router-dom";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import { getData } from "@/context/userContext";
import axios from "axios";
import { toast } from "sonner";
import api from "@/lib/axios";

const Navbar = () => {
  const { user, setUser } = getData();
  const accessToken = localStorage.getItem("accessToken");
  console.log(user);

  const logoutHandler = async () => {
    try {
      const res = await api.post(
        `/user/logout`,
        {},
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      );
      if (res.data.success) {
        setUser(null);
        toast.success(res.data.message);
        localStorage.clear();
      }
    } catch (error) {
      console.log(error);
    }
  };

  const profileDetails = async () => {
    console.log(user);
  };

  return (
    <nav className="sticky top-0 z-50 w-full backdrop-blur-xl bg-[#0B0F19]/70 border-b border-white/10">
      <div className="max-w-7xl mx-auto flex justify-between items-center px-4 py-3">
        {/* Logo */}
        <div className="flex gap-2 items-center">
          <BrainCircuitIcon className="h-6 w-6 text-emerald-400" />
          <h1 className="font-bold text-xl text-white">
            <span className="bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent">
              AI
            </span>
            Notes
          </h1>
        </div>

        {/* Right */}
        <ul className="flex gap-6 items-center text-sm font-medium text-gray-300">
          <li className="hover:text-white cursor-pointer transition">
            Features
          </li>

          <li className="hover:text-white cursor-pointer transition">
            Pricing
          </li>

          <li className="hover:text-white cursor-pointer transition">About</li>

          {user ? (
            <DropdownMenu>
              <DropdownMenuTrigger className="outline-none">
                <Avatar className="h-8 w-8 border border-white/10 hover:ring-2 hover:ring-emerald-400 transition">
                  <AvatarImage src={user?.avatar} />
                  <AvatarFallback className="bg-white/10 text-white">
                    {user?.username?.[0]?.toUpperCase()}
                  </AvatarFallback>
                </Avatar>
              </DropdownMenuTrigger>

              <DropdownMenuContent
                align="end"
                className="mt-2 backdrop-blur-xl bg-[#0B0F19]/90 border border-white/10 text-gray-300"
              >
                <DropdownMenuLabel className="text-gray-400">
                  My Account
                </DropdownMenuLabel>

                <DropdownMenuSeparator className="bg-white/10" />

                <DropdownMenuItem
                  className="flex gap-2 hover:bg-white/5 cursor-pointer"
                  onClick={() => profileDetails()}
                >
                  <User className="h-4 w-4" />
                  Profile
                </DropdownMenuItem>

                <DropdownMenuItem className="flex gap-2 hover:bg-white/5 cursor-pointer">
                  <BookA className="h-4 w-4" />
                  Notes
                </DropdownMenuItem>

                <DropdownMenuSeparator className="bg-white/10" />

                <DropdownMenuItem
                  onClick={logoutHandler}
                  className="flex gap-2 text-red-400 hover:bg-red-500/10 cursor-pointer"
                >
                  <LogOut className="h-4 w-4" />
                  Logout
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Link
              to="/login"
              className="px-4 py-2 rounded-lg bg-gradient-to-r from-emerald-500 to-cyan-500 text-black font-semibold hover:opacity-90 transition"
            >
              Login
            </Link>
          )}
        </ul>
      </div>
    </nav>
  );
};

export default Navbar;
