import { Button } from "@/components/ui/button";
import { MessageCircle, Users, Mic, Shield } from "lucide-react";

interface LoginScreenProps {
  onGoogleLogin: () => Promise<void>;
  loading: boolean;
}

export function LoginScreen({ onGoogleLogin, loading }: LoginScreenProps) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background p-4">
      <div className="max-w-md w-full text-center space-y-8">
        {/* Logo & Title */}
        <div className="space-y-4">
          <div className="w-20 h-20 mx-auto bg-primary/10 rounded-2xl flex items-center justify-center">
            <MessageCircle className="w-10 h-10 text-primary" />
          </div>
          <h1 className="text-4xl font-display font-bold text-foreground">
            Lets Panic
          </h1>
          <p className="text-muted-foreground text-lg">
            Real-time messaging, channels & voice rooms
          </p>
        </div>

        {/* Features */}
        <div className="grid grid-cols-2 gap-4 py-8">
          <div className="glass-card p-4 space-y-2">
            <Users className="w-6 h-6 text-primary mx-auto" />
            <p className="text-sm text-foreground font-medium">Groups & Channels</p>
          </div>
          <div className="glass-card p-4 space-y-2">
            <Mic className="w-6 h-6 text-primary mx-auto" />
            <p className="text-sm text-foreground font-medium">Live Audio</p>
          </div>
          <div className="glass-card p-4 space-y-2">
            <MessageCircle className="w-6 h-6 text-primary mx-auto" />
            <p className="text-sm text-foreground font-medium">Real-time Chat</p>
          </div>
          <div className="glass-card p-4 space-y-2">
            <Shield className="w-6 h-6 text-primary mx-auto" />
            <p className="text-sm text-foreground font-medium">Secure & Private</p>
          </div>
        </div>

        {/* Login Button */}
        <Button
          onClick={onGoogleLogin}
          disabled={loading}
          size="lg"
          className="w-full h-14 text-lg font-medium"
        >
          <svg className="w-5 h-5 mr-3" viewBox="0 0 24 24">
            <path
              fill="currentColor"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            />
            <path
              fill="currentColor"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
              fill="currentColor"
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
            />
            <path
              fill="currentColor"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
            />
          </svg>
          {loading ? "Signing in..." : "Continue with Google"}
        </Button>

        <p className="text-xs text-muted-foreground">
          By continuing, you agree to our Terms of Service and Privacy Policy
        </p>
      </div>
    </div>
  );
}
