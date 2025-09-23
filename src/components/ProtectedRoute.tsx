// src/components/ProtectedRoute.tsx
import { useState } from "react";
import DubbingInterface from "./DubbingInterface";

export default function ProtectedRoute() {
  const [authenticated, setAuthenticated] = useState(false);
  const [password, setPassword] = useState("");

  const handleLogin = () => {
    if (password === "operator123") {  // 🔑 Set your password here
      setAuthenticated(true);
    } else {
      alert("Wrong password!");
    }
  };

  if (!authenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900 text-white">
        <div className="p-6 bg-gray-800 rounded-xl flex flex-col gap-4">
          <h2 className="text-lg font-bold">Operator Login</h2>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Enter password"
            className="p-2 rounded bg-gray-700 focus:outline-none"
          />
          <button
            onClick={handleLogin}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded"
          >
            Login
          </button>
        </div>
      </div>
    );
  }

  return <DubbingInterface />;
}
