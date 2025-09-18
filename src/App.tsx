import React, { useEffect } from 'react';

function App() {
  // Temporary log to confirm mount in production build
  useEffect(() => {
    console.log('App mounted');
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-900 text-white">
      <h1>Hello World!</h1>
    </div>
  );
}

export default App;