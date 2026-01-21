
import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";

interface UsernameSetupProps {
  onComplete: () => void;
}

export function UsernameSetup({ onComplete }: UsernameSetupProps) {
  const [username, setUsername] = useState("");
  const [checking, setChecking] = useState(false);
  const [available, setAvailable] = useState<boolean | null>(null);
  const [error, setError] = useState("");
  const { toast } = useToast();

  const validateUsername = (val: string) => {
    if (val.length < 3) return "Username must be at least 3 characters";
    if (val.length > 20) return "Username must be at most 20 characters";
    if (!/^[a-zA-Z0-9_]+$/.test(val)) return "Only letters, numbers, and underscores allowed";
    return "";
  };

  const handleUsernameChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "");
    setUsername(val);
    setAvailable(null);
    setError("");

    if (val.length < 3) return;

    setChecking(true);
    try {
      // Debounce this in a real app, but for now direct check is okay for low volume
      const { data, error } = await supabase.rpc("check_username_available" as any, {
        username_input: val,
      });
      if (error) throw error;
      setAvailable(data as boolean);
    } catch (err) {
      console.error("Error checking username:", err);
    } finally {
      setChecking(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const validationError = validateUsername(username);
    if (validationError) {
      setError(validationError);
      return;
    }

    if (!available) {
      setError("Username is not available");
      return;
    }

    setChecking(true);
    try {
      const { error } = await supabase.rpc("update_username" as any, {
        username_input: username,
      });

      if (error) throw error;

      toast({
        title: "Success",
        description: "Username set successfully!",
      });
      onComplete();
    } catch (err: any) {
      setError(err.message || "Failed to set username");
      toast({
        title: "Error",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setChecking(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-card border border-border rounded-xl shadow-lg p-6 space-y-6">
        <div className="space-y-2 text-center">
          <h2 className="text-2xl font-bold tracking-tight">Choose a Username</h2>
          <p className="text-muted-foreground">
            Create a unique username to connect with others. This cannot be changed later.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="username" className="text-sm font-medium">
              Username
            </label>
            <div className="relative">
              <Input
                id="username"
                value={username}
                onChange={handleUsernameChange}
                placeholder="username"
                className={`pr-10 ${
                   available === true ? "border-success focus-visible:ring-success" : 
                   available === false ? "border-destructive focus-visible:ring-destructive" : ""
                }`}
                autoComplete="off"
              />
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                {checking ? (
                   <span className="w-4 h-4 block rounded-full border-2 border-primary border-t-transparent animate-spin" />
                ) : available === true ? (
                  <span className="text-success text-sm font-bold">✓</span>
                ) : available === false ? (
                  <span className="text-destructive text-sm font-bold">✕</span>
                ) : null}
              </div>
            </div>
            {error && <p className="text-xs text-destructive">{error}</p>}
            {available === false && <p className="text-xs text-destructive">Username is already taken</p>}
          </div>

          <Button 
            type="submit" 
            className="w-full" 
            disabled={!username || !available || checking}
          >
            {checking ? "Saving..." : "Set Username"}
          </Button>
        </form>
      </div>
    </div>
  );
}
