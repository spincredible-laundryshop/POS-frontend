import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import Navbar from "./components/Navbar";
import Inventory from "./pages/Inventory";
import Services from "./pages/Services";
import OpenSales from "./pages/OpenSales";
import ClosedSales from "./pages/ClosedSales";
import Reporting from "./pages/Reporting";
import ProtectedRoute from "./components/ProtectedRoute";
import Footer from "./components/Footer";
import OpenSalesOffline from "./pages/OpenSalesOffline";

function App() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors duration-300">
      <Router>
        <Navbar />
        <main className="px-4 sm:px-6 md:px-8 py-4 sm:py-6">
          <Routes>
            <Route path="/" element={<Navigate to="/open-sales" />} />
            <Route
              path="/inventory"
              element={
                <ProtectedRoute>
                  <Inventory />
                </ProtectedRoute>
              }
            />
            <Route
              path="/services"
              element={
                <ProtectedRoute>
                  <Services />
                </ProtectedRoute>
              }
            />
            {/* ✅ New Offline Sales Route */}
            <Route path="/open-sales-offline" element={<OpenSalesOffline />} />
            <Route path="/open-sales" element={<OpenSales />} />
            <Route path="/closed-sales" element={<ClosedSales />} />
            <Route
              path="/reporting"
              element={
                <ProtectedRoute>
                  <Reporting />
                </ProtectedRoute>
              }
            />
          </Routes>
        </main>
      </Router>
      <Footer />
    </div>
  );
}

export default App;
