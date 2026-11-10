import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Show, SignIn, SignUp } from "@clerk/react";
import { Toaster } from "@/components/ui/sonner";
import ClerkAuthProvider from "@/components/auth/ClerkAuthProvider";
import { FinanceProvider, useFinance } from "@/context/FinanceContext";
import AppShell from "@/components/AppShell";
import Landing from "@/pages/Landing";
import Onboarding from "@/pages/Onboarding";
import Overview from "@/pages/Overview";
import NextMoney from "@/pages/NextMoney";
import Allocator from "@/pages/Allocator";
import Predictor from "@/pages/Predictor";
import Expenses from "@/pages/Expenses";
import Opportunities from "@/pages/Opportunities";
import ProfileEditor from "@/pages/ProfileEditor";
import Privacy from "@/pages/Privacy";

const AuthPage = ({ children }) => (
  <div className="min-h-screen flex items-center justify-center p-4 auth-bg">{children}</div>
);

const Gate = () => {
  const { profile } = useFinance();
  if (profile === undefined) return <div data-testid="app-loading" className="min-h-screen grid place-items-center text-slate-500 text-sm">Loading your finances…</div>;
  if (profile === null) return <Onboarding />;
  return <AppShell />;
};

const Protected = () => (
  <>
    <Show when="signed-in"><FinanceProvider><Gate /></FinanceProvider></Show>
    <Show when="signed-out"><Navigate to="/sign-in" replace /></Show>
  </>
);

const Home = () => (
  <>
    <Show when="signed-in"><Navigate to="/app" replace /></Show>
    <Show when="signed-out"><Landing /></Show>
  </>
);

function App() {
  return (
    <BrowserRouter>
      <ClerkAuthProvider>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/sign-in/*" element={<AuthPage><SignIn routing="path" path="/sign-in" signUpUrl="/sign-up" withSignUp /></AuthPage>} />
          <Route path="/sign-up/*" element={<AuthPage><SignUp routing="path" path="/sign-up" signInUrl="/sign-in" /></AuthPage>} />
          <Route path="/app" element={<Protected />}>
            <Route index element={<Overview />} />
            <Route path="next" element={<NextMoney />} />
            <Route path="allocator" element={<Allocator />} />
            <Route path="predictor" element={<Predictor />} />
            <Route path="expenses" element={<Expenses />} />
            <Route path="opportunities" element={<Opportunities />} />
            <Route path="profile" element={<ProfileEditor />} />
            <Route path="privacy" element={<Privacy />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </ClerkAuthProvider>
      <Toaster theme="dark" position="bottom-right" />
    </BrowserRouter>
  );
}

export default App;
