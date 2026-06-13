import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { toast } from "sonner";
import {
  Plus,
  Compass,
  LogOut,
  User as UserIcon,
  Calendar,
  ArrowRight,
  BookOpen,
  Users,
  Search,
  Hash,
  X,
} from "lucide-react";

interface Room {
  id: string;
  title: string;
  description: string | null;
  ownerId: string;
  createdAt: string;
  owner: {
    id: string;
    name: string;
    email: string;
  };
  _count: {
    participants: number;
  };
}

export const Dashboard: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  // Create Room Modal State
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [createTitle, setCreateTitle] = useState("");
  const [createDesc, setCreateDesc] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  // Join Room State
  const [joinRoomId, setJoinRoomId] = useState("");
  const [isJoining, setIsJoining] = useState(false);

  const fetchRooms = async () => {
    try {
      const response = await fetch("/api/rooms");
      if (response.ok) {
        const data = await response.json();
        setRooms(data.rooms || []);
      } else {
        toast.error("Failed to fetch coding rooms.");
      }
    } catch (error) {
      console.error("Fetch rooms error:", error);
      toast.error("Network error fetching rooms.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRooms();
  }, []);

  const handleCreateRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createTitle.trim()) {
      toast.error("Room title is required.");
      return;
    }

    setIsCreating(true);
    try {
      const response = await fetch("/api/rooms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: createTitle, description: createDesc }),
      });

      const data = await response.json();
      if (response.ok) {
        if (navigator.clipboard) {
          await navigator.clipboard.writeText(data.room.id);
          toast.success("Room created! Invite code copied to clipboard.");
        } else {
          toast.success("Room created successfully!");
        }
        setIsCreateModalOpen(false);
        setCreateTitle("");
        setCreateDesc("");
        // Redirect to new room
        navigate(`/rooms/${data.room.id}`);
      } else {
        toast.error(data.message || "Failed to create room.");
      }
    } catch (err) {
      console.error("Create room error:", err);
      toast.error("Could not create room. Try again.");
    } finally {
      setIsCreating(false);
    }
  };

  const handleJoinRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanId = joinRoomId.trim();
    if (!cleanId) {
      toast.error("Please enter a room ID.");
      return;
    }

    setIsJoining(true);
    try {
      const response = await fetch(`/api/rooms/${cleanId}/join`, {
        method: "POST",
      });

      const data = await response.json();
      if (response.ok) {
        toast.success(data.message || "Joined room!");
        navigate(`/rooms/${cleanId}`);
      } else {
        toast.error(data.message || "Could not join room. Double check the ID.");
      }
    } catch (err) {
      console.error("Join room error:", err);
      toast.error("Connection failed joining room.");
    } finally {
      setIsJoining(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    toast.success("Signed out successfully.");
    navigate("/login");
  };

  const filteredRooms = rooms.filter(
    (room) =>
      room.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (room.description && room.description.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="min-h-screen bg-neutral-950 text-white font-sans selection:bg-indigo-500/30 selection:text-white">
      {/* Top Banner Grid background */}
      <div className="absolute top-0 left-0 w-full h-[300px] bg-gradient-to-b from-indigo-950/20 to-transparent pointer-events-none"></div>

      {/* Navigation Header */}
      <header className="border-b border-neutral-800/80 bg-neutral-900/40 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-gradient-to-tr from-indigo-600 to-violet-500 rounded-lg shadow-lg">
              <Compass className="w-6 h-6 text-white" />
            </div>
            <span className="text-xl font-bold tracking-tight bg-gradient-to-r from-white to-neutral-400 bg-clip-text text-transparent">
              PrepRoom
            </span>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 bg-neutral-900 px-3 py-1.5 rounded-xl border border-neutral-800">
              <UserIcon className="w-4 h-4 text-indigo-400" />
              <span className="text-sm font-medium text-neutral-300">{user?.name}</span>
            </div>
            <button
              onClick={handleLogout}
              className="flex items-center gap-1.5 px-3 py-1.5 border border-neutral-800 rounded-xl text-sm font-medium text-neutral-400 hover:text-white hover:bg-neutral-900/60 transition cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
              Logout
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 relative z-10">
        {/* Welcome Area */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10">
          <div>
            <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight bg-gradient-to-r from-white via-neutral-100 to-neutral-500 bg-clip-text text-transparent">
              Developer Dashboard
            </h1>
            <p className="mt-2 text-neutral-400 text-sm sm:text-base">
              Create, join, and collaborate in secure rooms in real-time.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={() => setIsCreateModalOpen(true)}
              className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold px-4 py-2.5 rounded-xl shadow-lg shadow-indigo-600/10 cursor-pointer transition-all duration-200 transform hover:-translate-y-0.5 active:translate-y-0"
            >
              <Plus className="w-5 h-5" />
              Create Room
            </button>
          </div>
        </div>

        {/* Top Control Panels (Join room by code & Search) */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-10">
          {/* Join card */}
          <div className="lg:col-span-1 bg-neutral-900/40 backdrop-blur border border-neutral-800/80 rounded-2xl p-6 shadow-xl flex flex-col justify-between">
            <div>
              <h3 className="text-lg font-bold text-white mb-2 flex items-center gap-2">
                <Hash className="w-5 h-5 text-indigo-400" />
                Join Existing Room
              </h3>
              <p className="text-sm text-neutral-400 mb-4">
                Enter a room invitation code/ID to join other developers.
              </p>
            </div>
            <form onSubmit={handleJoinRoom} className="space-y-3">
              <input
                type="text"
                value={joinRoomId}
                onChange={(e) => setJoinRoomId(e.target.value)}
                placeholder="Enter Room ID"
                className="w-full px-3 py-2 bg-neutral-950/80 border border-neutral-800 rounded-xl text-sm text-white placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition"
              />
              <button
                type="submit"
                disabled={isJoining}
                className="w-full flex justify-center items-center gap-2 py-2.5 px-4 bg-neutral-800 hover:bg-neutral-700 text-white rounded-xl text-sm font-semibold transition cursor-pointer disabled:opacity-50"
              >
                {isJoining ? (
                  <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
                ) : (
                  <>
                    Join Room <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>
          </div>

          {/* Search Room controls & Stats */}
          <div className="lg:col-span-2 bg-neutral-900/40 backdrop-blur border border-neutral-800/80 rounded-2xl p-6 shadow-xl flex flex-col justify-between">
            <div>
              <h3 className="text-lg font-bold text-white mb-2 flex items-center gap-2">
                <Search className="w-5 h-5 text-violet-400" />
                Search & Filter
              </h3>
              <p className="text-sm text-neutral-400 mb-4">
                Quickly locate coding sessions by title or description details.
              </p>
            </div>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className="h-5 w-5 text-neutral-500" />
              </div>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Filter room list..."
                className="w-full pl-10 pr-4 py-2.5 bg-neutral-950/80 border border-neutral-800 rounded-xl text-sm text-white placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition"
              />
            </div>
          </div>
        </div>

        {/* Room Grid Section */}
        <div>
          <h2 className="text-xl font-bold mb-6 text-white flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-emerald-400" />
            Your Collaborative Rooms
          </h2>

          {loading ? (
            <div className="flex flex-col items-center justify-center py-20">
              <div className="w-10 h-10 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin mb-4"></div>
              <span className="text-neutral-400 text-sm">Scanning active workspaces...</span>
            </div>
          ) : filteredRooms.length === 0 ? (
            <div className="border border-dashed border-neutral-800/80 rounded-2xl p-12 text-center bg-neutral-900/10 backdrop-blur-sm">
              <BookOpen className="w-12 h-12 text-neutral-600 mx-auto mb-4" />
              <h3 className="text-lg font-bold text-neutral-300">No rooms found</h3>
              <p className="text-neutral-500 text-sm mt-1 max-w-sm mx-auto">
                {searchQuery
                  ? "Try adjusting your search criteria to match active names."
                  : "You haven't joined or created any rooms yet. Click Create Room above to start!"}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredRooms.map((room) => (
                <div
                  key={room.id}
                  onClick={() => navigate(`/rooms/${room.id}`)}
                  className="group relative bg-neutral-900/50 hover:bg-neutral-900 border border-neutral-850 hover:border-indigo-500/50 rounded-2xl p-6 cursor-pointer shadow-xl transition-all duration-300 transform hover:-translate-y-1"
                >
                  {/* Subtle hover accent border glow */}
                  <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/5 to-violet-500/5 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"></div>

                  <div className="flex justify-between items-start gap-4 mb-3">
                    <h3 className="text-lg font-bold text-white group-hover:text-indigo-400 transition-colors truncate">
                      {room.title}
                    </h3>
                    <div className="flex items-center gap-1 text-xs font-semibold text-neutral-400 bg-neutral-800/80 px-2.5 py-1 rounded-full border border-neutral-700">
                      <Users className="w-3.5 h-3.5" />
                      {room._count.participants}
                    </div>
                  </div>

                  <p className="text-neutral-400 text-sm mb-6 line-clamp-2 min-h-[40px]">
                    {room.description || "No description provided."}
                  </p>

                  <div className="border-t border-neutral-800/80 pt-4 flex items-center justify-between text-xs text-neutral-500">
                    <div className="flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5" />
                      <span>{new Date(room.createdAt).toLocaleDateString()}</span>
                    </div>
                    <div className="text-neutral-400 font-medium">
                      Owner: <span className="text-neutral-300">{room.owner.name}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      {/* Create Room Modal */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/70 backdrop-blur-sm transition-opacity"
            onClick={() => setIsCreateModalOpen(false)}
          ></div>

          {/* Modal Content */}
          <div className="bg-neutral-900 border border-neutral-800/80 rounded-2xl w-full max-w-md shadow-2xl relative z-10 p-6 transform transition-all animate-in fade-in zoom-in-95 duration-200">
            <button
              onClick={() => setIsCreateModalOpen(false)}
              className="absolute top-4 right-4 text-neutral-400 hover:text-white transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-xl font-bold text-white mb-2">Create Collaborate Room</h3>
            <p className="text-sm text-neutral-400 mb-6">
              Establish a shared workspace for programming and chat.
            </p>

            <form onSubmit={handleCreateRoom} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-neutral-300 mb-1.5">
                  Room Title
                </label>
                <input
                  type="text"
                  required
                  value={createTitle}
                  onChange={(e) => setCreateTitle(e.target.value)}
                  placeholder="e.g. System Design Mock Prep"
                  className="w-full px-3 py-2 bg-neutral-950/80 border border-neutral-800 rounded-xl text-sm text-white placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-neutral-300 mb-1.5">
                  Description <span className="text-xs text-neutral-500">(Optional)</span>
                </label>
                <textarea
                  value={createDesc}
                  onChange={(e) => setCreateDesc(e.target.value)}
                  placeholder="e.g. Focus on graph algorithms and system API schemas."
                  rows={3}
                  className="w-full px-3 py-2 bg-neutral-950/80 border border-neutral-800 rounded-xl text-sm text-white placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition resize-none"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="flex-1 py-2.5 px-4 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded-xl text-sm font-semibold transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isCreating}
                  className="flex-1 py-2.5 px-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-sm font-semibold shadow-lg shadow-indigo-600/10 transition cursor-pointer disabled:opacity-50"
                >
                  {isCreating ? (
                    <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin mx-auto"></div>
                  ) : (
                    "Create"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
